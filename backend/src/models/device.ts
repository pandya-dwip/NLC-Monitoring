import { loadPayloadTemplate } from '../telemetry/payloadTemplate';
import { getPath } from '../utils/objectPath';

/** Fallback for devices.json entries that don't carry a ratedWattage (e.g. hand-written credentials). */
const DEFAULT_RATED_WATTAGE_W = 70;

/**
 * Deterministic ~50% on / 25% dim / 25% off split across the fleet. `seed` is
 * typically `${clientId}:${timeWindowIndex}` so the split reshuffles every
 * window while staying stable (no flicker) within it -- see deviceBehavior.ts.
 */
export function assignLightMode(seed: string): 'on' | 'dim' | 'off' {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  // MurmurHash3 finalizer: seeds differing only in a low-order digit (e.g. adjacent
  // time-window indices) still avalanche into decorrelated buckets, not near-identical ones.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
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

/** One recorded publish for a device's light-state history (Device History page). */
export interface LightHistoryEntry {
  ts: number;
  lightState: 0 | 1;
  dimLevel: number;
}

/** Mutable simulated physical/operational state for one device, evolved every publish tick. */
export interface DeviceState {
  clientId: string;
  nlcId: string;
  status: ConnectionStatus;
  lightState: 0 | 1;
  /** Brightness percentage (0-100). 100 = full ON, 0 = OFF, 1-99 = dimmed. Drives actualLightState. */
  dimLevel: number;
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
  /** Set by an RPC/dimming command; overrides the fleet's on/dim/off assignment until it expires. */
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
