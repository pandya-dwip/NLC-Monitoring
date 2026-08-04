import dayjs from 'dayjs';
import { assignLightMode, type DeviceState } from '../models/device';
import type { TelemetryPayload } from '../models/telemetry';
import { cloneTemplate, resolveTimestamp } from '../telemetry/payloadTemplate';
import { applyRandomization } from '../telemetry/randomizer';
import { randomFloat } from '../utils/random';
import { setPath } from '../utils/objectPath';

const RATED_POWER_FACTOR = 0.98;
/** Power fluctuates naturally around each device's rated wattage instead of holding dead flat. */
const POWER_JITTER_FRACTION = 0.05;
const DIM_LEVEL_PERCENT = 50;
/** How often the fleet's on/dim/off assignment reshuffles (per device, deterministically). */
const FLEET_MODE_WINDOW_MS = 5 * 60 * 1000;

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
    const windowIndex = Math.floor(Date.now() / FLEET_MODE_WINDOW_MS);
    const mode = assignLightMode(`${state.clientId}:${windowIndex}`);
    state.lightState = mode === 'off' ? 0 : 1;
    state.dimLevel = mode === 'on' ? 100 : mode === 'dim' ? DIM_LEVEL_PERCENT : 0;
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

/**
 * One-off "going offline" payload for a manual disconnect (Device History page / API) --
 * explicitly reports light-off as the device's last known values, rather than leaving
 * ThingsBoard's Latest Telemetry frozen at whatever it was mid-tick. Does not advance
 * elapsed-time energy counters (not a scheduled publish) and does not re-derive the
 * fleet's on/dim/off assignment (this is a deliberate override to off).
 *
 * Does NOT set communicationFailure=1 here -- confirmed via a raw MQTT publish bypassing
 * this app entirely that ThingsBoard's rule chain silently overrides any self-reported
 * communicationFailure back to 0 on a live message (logically: a message that arrives
 * disproves its own "failure" claim). It's computed server-side from actual silence, and
 * will flip to 1 on its own once this device has been quiet long enough -- no payload we
 * send can make it show 1 while still being received.
 */
export function renderOfflinePayload(state: DeviceState): TelemetryPayload {
  state.lightState = 0;
  state.dimLevel = 0;
  state.lastCurrentAmps = 0;
  state.lastActivePowerW = 0;

  const payload = cloneTemplate();
  resolveTimestamp(payload);

  payload['NLCId'] = state.nlcId;
  setPath(payload, 'values.supplyVoltage', roundTo(state.voltageBaseline, 3));
  setPath(payload, 'values.supplyCurrent', 0);
  setPath(payload, 'values.activePower', 0);
  setPath(payload, 'values.CumKwh', roundTo(state.cumKwh, 5));
  setPath(payload, 'values.cum_kWh', roundTo(state.cumKwh, 5));
  setPath(payload, 'values.Daily_kWh', roundTo(state.dailyKwh, 5));
  setPath(payload, 'values.operatingHours', roundTo(state.operatingHours, 2));
  setPath(payload, 'values.actualLightState', 0);
  setPath(payload, 'values.lampStatus', 0);
  setPath(payload, 'values.feedbacklightcommand.state.value', 0);

  return payload;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
