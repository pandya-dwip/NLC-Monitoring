// Mirrors backend/src/models/device.ts -- kept in sync manually (separate packages).

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'offline';

export interface DeviceState {
  clientId: string;
  nlcId: string;
  status: ConnectionStatus;
  /** True after a manual disconnect until explicitly reconnected -- no auto-reconnect while set. */
  manuallyDisconnected: boolean;
  lightState: 0 | 1;
  /** Brightness percentage (0-100). 100 = full ON, 0 = OFF, 1-99 = dimmed. */
  dimLevel: number;
  cumKwh: number;
  /** Resets to 0 at local midnight. */
  dailyKwh: number;
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
  manualLightOverride: { value: 0 | 1; dimLevel: number; expiresAt: number } | null;
  lastCurrentAmps: number;
  lastActivePowerW: number;
  hwVersion: string;
  swVersion: string;
}

/** One recorded publish for a device's light-state history (Device History page). */
export interface LightHistoryEntry {
  ts: number;
  lightState: 0 | 1;
  dimLevel: number;
}

export type LightMode = 'on' | 'dim' | 'off';

/** Matches the exact ON/OFF/DIM contract the ThingsBoard dashboard widgets use. */
export function classifyLightMode(device: Pick<DeviceState, 'lightState' | 'dimLevel'>): LightMode {
  if (device.lightState === 0) return 'off';
  return device.dimLevel >= 100 ? 'on' : 'dim';
}
