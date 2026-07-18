import dayjs from 'dayjs';
import type { DeviceState } from '../models/device';
import type { TelemetryPayload } from '../models/telemetry';
import { cloneTemplate, resolveTimestamp } from '../telemetry/payloadTemplate';
import { applyRandomization } from '../telemetry/randomizer';
import { randomFloat } from '../utils/random';
import { setPath } from '../utils/objectPath';

const RATED_POWER_FACTOR = 0.98;
/** Power fluctuates naturally around each device's rated wattage instead of holding dead flat. */
const POWER_JITTER_FRACTION = 0.05;
const DIM_LEVEL_PERCENT = 50;

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
      state.dimLevel = state.manualLightOverride.dimLevel;
    }
  }
  if (!state.manualLightOverride) {
    state.lightState = state.lightMode === 'off' ? 0 : 1;
    state.dimLevel = state.lightMode === 'on' ? 100 : state.lightMode === 'dim' ? DIM_LEVEL_PERCENT : 0;
  }

  const voltageDrift = randomFloat(-1.5, 1.5);
  state.voltageBaseline = clamp(state.voltageBaseline + voltageDrift, 210, 250);

  const powerJitter = 1 + randomFloat(-POWER_JITTER_FRACTION, POWER_JITTER_FRACTION);
  const activePower =
    state.lightState === 1 ? state.ratedWattage * (state.dimLevel / 100) * powerJitter : 0;
  const supplyCurrent =
    state.lightState === 1 ? activePower / (state.voltageBaseline * RATED_POWER_FACTOR) : 0;
  state.lastCurrentAmps = roundTo(supplyCurrent, 4);
  state.lastActivePowerW = roundTo(activePower, 3);

  const today = now.format('YYYY-MM-DD');
  if (state.dailyKwhDate !== today) {
    state.dailyKwh = 0;
    state.dailyKwhDate = today;
  }

  const elapsedHours = elapsedMs / 3_600_000;
  if (state.lightState === 1) {
    const kwh = (activePower * elapsedHours) / 1000;
    state.cumKwh += kwh;
    state.dailyKwh += kwh;
  }
  state.operatingHours += elapsedHours;

  const payload = cloneTemplate();
  resolveTimestamp(payload);

  payload['NLCId'] = state.nlcId;
  setPath(payload, 'values.supplyVoltage', roundTo(state.voltageBaseline, 3));
  setPath(payload, 'values.supplyCurrent', roundTo(supplyCurrent, 4));
  setPath(payload, 'values.activePower', roundTo(activePower, 3));
  setPath(payload, 'values.CumKwh', roundTo(state.cumKwh, 5));
  // Downstream EnergySavingsService reads this exact key name (snake_case) -- kept alongside
  // CumKwh so any existing ThingsBoard dashboard widgets bound to the original name still work.
  setPath(payload, 'values.cum_kWh', roundTo(state.cumKwh, 5));
  setPath(payload, 'values.Daily_kWh', roundTo(state.dailyKwh, 5));
  setPath(payload, 'values.operatingHours', roundTo(state.operatingHours, 2));
  setPath(payload, 'values.actualLightState', state.dimLevel);
  // ON: lampStatus=1 & actualLightState=100. OFF: lampStatus=0. DIM: lampStatus=1 & 0<actualLightState<100.
  setPath(payload, 'values.lampStatus', state.lightState);
  setPath(payload, 'values.feedbacklightcommand.state.value', state.dimLevel);

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
