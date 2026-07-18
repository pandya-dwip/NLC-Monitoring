import { loadPayloadTemplate } from '../telemetry/payloadTemplate';
import { getPath } from '../utils/objectPath';

/** Fallback for devices.json entries that don't carry a ratedWattage (e.g. hand-written credentials). */
const DEFAULT_RATED_WATTAGE_W = 70;

/** Deterministic ~50% on / 25% dim / 25% off split across the fleet, stable per clientId. */
function assignLightMode(clientId: string): 'on' | 'dim' | 'off' {
  let hash = 0;
  for (let i = 0; i < clientId.length; i += 1) {
    hash = (hash * 31 + clientId.charCodeAt(i)) | 0;
  }
  const bucket = Math.abs(hash) % 100;
  if (bucket < 50) return 'on';
  if (bucket < 75) return 'dim';
  return 'off';
}

/** A single entry from devices.json — mirrors real device credentials. */
export interface DeviceCredentials {
  clientId: string;
  userName: string;
  password: string;
  /** Lamp's rated power draw when lit, in watts -- drives per-device current/power simulation. */
  ratedWattage?: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'offline';

/** Mutable simulated physical/operational state for one device, evolved every publish tick. */
export interface DeviceState {
  clientId: string;
  nlcId: string;
  status: ConnectionStatus;
  lightState: 0 | 1;
  /** Brightness percentage (0-100). 100 = full ON, 0 = OFF, 1-99 = dimmed. Drives actualLightState. */
  dimLevel: number;
  /** Fixed per-device fleet split (~50% on / 25% dim / 25% off), assigned once at startup. */
  lightMode: 'on' | 'dim' | 'off';
  cumKwh: number;
  /** Resets to 0 at local midnight; accumulates the same way cumKwh does otherwise. */
  dailyKwh: number;
  /** Local date (YYYY-MM-DD) dailyKwh last reset on. */
  dailyKwhDate: string;
  operatingHours: number;
  voltageBaseline: number;
  ratedWattage: number;
  lastPublishAt: number | null;
  lastCommandAt: number | null;
  lastLatencyMs: number | null;
  reconnectCount: number;
  messagesSent: number;
  messagesReceived: number;
  publishFailures: number;
  errors: number;
  /** Set by an RPC/dimming command; overrides the day/night light schedule until it expires. */
  manualLightOverride: { value: 0 | 1; dimLevel: number; expiresAt: number } | null;
  lastCurrentAmps: number;
  lastActivePowerW: number;
  hwVersion: string;
  swVersion: string;
}

export function createInitialDeviceState(creds: DeviceCredentials, nlcId: string): DeviceState {
  return {
    clientId: creds.clientId,
    nlcId,
    status: 'connecting',
    lightState: 0,
    dimLevel: 0,
    lightMode: assignLightMode(creds.clientId),
    cumKwh: 1500 + Math.random() * 500,
    dailyKwh: 0,
    dailyKwhDate: '', // forces a reset on the first renderTelemetry() tick
    operatingHours: 20000 + Math.random() * 2000,
    voltageBaseline: 225 + Math.random() * 15,
    ratedWattage: creds.ratedWattage ?? DEFAULT_RATED_WATTAGE_W,
    lastPublishAt: null,
    lastCommandAt: null,
    lastLatencyMs: null,
    reconnectCount: 0,
    messagesSent: 0,
    messagesReceived: 0,
    publishFailures: 0,
    errors: 0,
    manualLightOverride: null,
    lastCurrentAmps: 0,
    lastActivePowerW: 0,
    hwVersion: readTemplateVersion('values.hwVersion'),
    swVersion: readTemplateVersion('values.swVersion'),
  };
}

function readTemplateVersion(dotPath: string): string {
  const value = getPath(loadPayloadTemplate().template, dotPath);
  return typeof value === 'string' ? value : 'unknown';
}
