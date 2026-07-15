import dayjs from 'dayjs';
import type { DeviceState } from '../models/device';
import type { TelemetryPayload } from '../models/telemetry';
import { cloneTemplate, resolveTimestamp } from '../telemetry/payloadTemplate';
import { applyRandomization } from '../telemetry/randomizer';
import { randomFloat } from '../utils/random';
import { setPath } from '../utils/objectPath';

const RATED_CURRENT_AMPS = 0.45;
const RATED_POWER_FACTOR = 0.98;

/** Simple day/night model: lights off 06:00-18:00, on otherwise. Not geo-aware; good enough for load testing. */
function isNightTime(now: dayjs.Dayjs): boolean {
  const hour = now.hour();
  return hour < 6 || hour >= 18;
}

/**
 * Advances one device's simulated physical state by `elapsedMs` and renders
 * a telemetry payload for the current instant. Mutates `state` in place.
 */
export function renderTelemetry(
  state: DeviceState,
  elapsedMs: number,
  enableRandomization: boolean,
): TelemetryPayload {
  const now = dayjs();

  if (state.manualLightOverride) {
    if (Date.now() >= state.manualLightOverride.expiresAt) {
      state.manualLightOverride = null;
    } else {
      state.lightState = state.manualLightOverride.value;
    }
  }
  if (!state.manualLightOverride) {
    state.lightState = isNightTime(now) ? 1 : 0;
  }

  const voltageDrift = randomFloat(-1.5, 1.5);
  state.voltageBaseline = clamp(state.voltageBaseline + voltageDrift, 210, 250);

  const supplyCurrent = state.lightState === 1 ? RATED_CURRENT_AMPS + randomFloat(-0.02, 0.02) : 0;
  const activePower =
    state.lightState === 1 ? state.voltageBaseline * supplyCurrent * RATED_POWER_FACTOR : 0;
  state.lastCurrentAmps = roundTo(supplyCurrent, 4);
  state.lastActivePowerW = roundTo(activePower, 3);

  const elapsedHours = elapsedMs / 3_600_000;
  if (state.lightState === 1) {
    state.cumKwh += (activePower * elapsedHours) / 1000;
  }
  state.operatingHours += elapsedHours;

  const payload = cloneTemplate();
  resolveTimestamp(payload);

  payload['NLCId'] = state.nlcId;
  setPath(payload, 'values.supplyVoltage', roundTo(state.voltageBaseline, 3));
  setPath(payload, 'values.supplyCurrent', roundTo(supplyCurrent, 4));
  setPath(payload, 'values.activePower', roundTo(activePower, 3));
  setPath(payload, 'values.CumKwh', roundTo(state.cumKwh, 5));
  setPath(payload, 'values.operatingHours', roundTo(state.operatingHours, 2));
  setPath(payload, 'values.actualLightState', state.lightState);
  setPath(payload, 'values.lampStatus', state.lightState);
  setPath(payload, 'values.feedbacklightcommand.state.value', state.lightState);

  if (enableRandomization) {
    applyRandomization(payload);
  }

  return payload;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
