import type { CommandKind, IncomingCommand } from '../models/command';
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
): { responseTopic: string | null; responsePayload: unknown } {
  state.lastCommandAt = Date.now();

  if (command.kind === 'rpc') {
    const params =
      command.payload && typeof command.payload === 'object'
        ? (command.payload as Record<string, unknown>)['params']
        : undefined;

    if (command.method === 'setLightState' || command.method === 'setDimLevel') {
      const value = extractLightValue(params);
      if (value !== null) {
        const light = value > 0 ? 1 : 0;
        state.lightState = light;
        // Overrides the day/night schedule until it expires, mirroring the
        // payload template's own feedbacklightcommand.expiration semantics.
        state.manualLightOverride = { value: light, expiresAt: Date.now() + MANUAL_OVERRIDE_MS };
      }
    }

    const responseTopic = command.requestId
      ? `v1/devices/me/rpc/response/${command.requestId}`
      : null;
    return {
      responseTopic,
      responsePayload: { status: 'ok', method: command.method, appliedAt: Date.now() },
    };
  }

  return { responseTopic: null, responsePayload: null };
}

function extractLightValue(params: unknown): number | null {
  if (typeof params === 'number') return params;
  if (params && typeof params === 'object' && 'value' in params) {
    const v = (params as Record<string, unknown>)['value'];
    return typeof v === 'number' ? v : null;
  }
  return null;
}
