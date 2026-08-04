import type { CommandKind, CommandStateChange, IncomingCommand } from '../models/command';
import type { DeviceState } from '../models/device';
import { randomUUID } from 'node:crypto';

const RPC_REQUEST_RE = /^v1\/devices\/me\/rpc\/request\/(.+)$/;
const ATTR_RESPONSE_RE = /^v1\/devices\/me\/attributes\/response\/(.+)$/;
const ATTRIBUTES_TOPIC = 'v1/devices/me/attributes';
const MANUAL_OVERRIDE_MS = 5 * 60 * 1000;

/** Classifies an inbound topic/payload into a typed IncomingCommand, or null if unrecognized. */
export function parseIncomingMessage(
  clientId: string,
  topic: string,
  payloadBuffer: Buffer,
): IncomingCommand | null {
  let payload: unknown;
  try {
    payload = JSON.parse(payloadBuffer.toString('utf-8'));
  } catch {
    payload = payloadBuffer.toString('utf-8');
  }

  const rpcMatch = RPC_REQUEST_RE.exec(topic);
  if (rpcMatch) {
    const method =
      payload && typeof payload === 'object' && 'method' in payload
        ? String((payload as Record<string, unknown>)['method'])
        : null;
    return {
      id: randomUUID(),
      clientId,
      kind: 'rpc',
      topic,
      method,
      requestId: rpcMatch[1] ?? null,
      payload,
      receivedAt: Date.now(),
    };
  }

  const attrResponseMatch = ATTR_RESPONSE_RE.exec(topic);
  if (attrResponseMatch) {
    return {
      id: randomUUID(),
      clientId,
      kind: 'attribute-response',
      topic,
      method: null,
      requestId: attrResponseMatch[1] ?? null,
      payload,
      receivedAt: Date.now(),
    };
  }

  if (topic === ATTRIBUTES_TOPIC) {
    return {
      id: randomUUID(),
      clientId,
      kind: 'attribute-update' as CommandKind,
      topic,
      method: null,
      requestId: null,
      payload,
      receivedAt: Date.now(),
    };
  }

  return null;
}

/**
 * Applies a command's side effects to simulated device state (e.g. a light/
 * dimming RPC toggles lightState) and builds the ack/response to publish
 * back to ThingsBoard.
 */
export function applyCommandAndBuildResponse(
  command: IncomingCommand,
  state: DeviceState,
): { responseTopic: string | null; responsePayload: unknown; stateChange: CommandStateChange | null } {
  state.lastCommandAt = Date.now();
  const before = {
    lightState: state.lightState,
    dimLevel: state.dimLevel,
    overrideExpiresAt: state.manualLightOverride?.expiresAt ?? null,
  };

  let responseTopic: string | null = null;
  let responsePayload: unknown = null;

  if (command.kind === 'rpc') {
    const params =
      command.payload && typeof command.payload === 'object'
        ? (command.payload as Record<string, unknown>)['params']
        : undefined;

    if (command.method === 'setLightState' || command.method === 'setDimLevel') {
      const value = extractLightValue(params);
      if (value !== null) {
        // setLightState is a plain on/off toggle (full brightness when on); setDimLevel
        // carries an actual 0-100 brightness percentage.
        const dimLevel = command.method === 'setDimLevel' ? clamp(value, 0, 100) : value > 0 ? 100 : 0;
        const light = dimLevel > 0 ? 1 : 0;
        state.lightState = light;
        state.dimLevel = dimLevel;
        // Overrides the day/night schedule until it expires, mirroring the
        // payload template's own feedbacklightcommand.expiration semantics.
        state.manualLightOverride = { value: light, dimLevel, expiresAt: Date.now() + MANUAL_OVERRIDE_MS };
      }
    }

    responseTopic = command.requestId ? `v1/devices/me/rpc/response/${command.requestId}` : null;
    responsePayload = { status: 'ok', method: command.method, appliedAt: Date.now() };
  } else if (command.kind === 'attribute-update') {
    applyAttributeLightCommand(command.payload, state);
  }

  return { responseTopic, responsePayload, stateChange: buildStateChange(before, state) };
}

function buildStateChange(
  before: { lightState: 0 | 1; dimLevel: number; overrideExpiresAt: number | null },
  state: DeviceState,
): CommandStateChange | null {
  const change: CommandStateChange = {};
  let changed = false;

  if (before.lightState !== state.lightState) {
    change.lightState = { from: before.lightState, to: state.lightState };
    changed = true;
  }
  if (before.dimLevel !== state.dimLevel) {
    change.dimLevel = { from: before.dimLevel, to: state.dimLevel };
    changed = true;
  }
  const afterExpiresAt = state.manualLightOverride?.expiresAt ?? null;
  if (before.overrideExpiresAt !== afterExpiresAt) {
    change.overrideExpiresAt = afterExpiresAt;
    changed = true;
  }

  return changed ? change : null;
}

/**
 * ThingsBoard's built-in "Turn On/Off/Dim" device widget doesn't send an RPC --
 * it pushes a shared attribute shaped like:
 *   { targetLightCommand: { expiration, state: { name: "LevelState", value: 46 } } }
 * ("targetCommand" carries the same payload; targetLightCommand takes precedence
 * when both are present). A LevelState value is a 0-100 dim percentage; an
 * IntegerState value of -1 is the widget's "cancel override" sentinel. Anything
 * else (get-data Invoke, currentTime sync, ...) is a shared attribute we don't
 * act on and is left alone.
 */
function applyAttributeLightCommand(payload: unknown, state: DeviceState): void {
  if (!payload || typeof payload !== 'object') return;
  const body = payload as Record<string, unknown>;
  const cmd = (body['targetLightCommand'] ?? body['targetCommand']) as Record<string, unknown> | undefined;
  const cmdState = cmd?.['state'] as Record<string, unknown> | undefined;
  if (!cmdState || typeof cmdState['value'] !== 'number') return;

  const name = cmdState['name'];
  const value = cmdState['value'] as number;

  if (name === 'IntegerState' && value < 0) {
    state.manualLightOverride = null; // cancel override, resume the fleet's fixed on/dim/off split
    return;
  }
  if (name !== 'LevelState') return;

  const dimLevel = clamp(value, 0, 100);
  const light = dimLevel > 0 ? 1 : 0;
  state.lightState = light;
  state.dimLevel = dimLevel;

  const expiration = cmd?.['expiration'];
  const expiresAt =
    typeof expiration === 'string' && !Number.isNaN(Date.parse(expiration))
      ? Date.parse(expiration)
      : Date.now() + MANUAL_OVERRIDE_MS;
  state.manualLightOverride = { value: light, dimLevel, expiresAt };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function extractLightValue(params: unknown): number | null {
  if (typeof params === 'number') return params;
  if (params && typeof params === 'object' && 'value' in params) {
    const v = (params as Record<string, unknown>)['value'];
    return typeof v === 'number' ? v : null;
  }
  return null;
}
