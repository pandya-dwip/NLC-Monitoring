// Mirrors backend/src/models/device.ts -- kept in sync manually (separate packages).

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'offline';

export interface DeviceState {
  clientId: string;
  nlcId: string;
  status: ConnectionStatus;
  lightState: 0 | 1;
  cumKwh: number;
  operatingHours: number;
  voltageBaseline: number;
  lastPublishAt: number | null;
  lastCommandAt: number | null;
  lastLatencyMs: number | null;
  reconnectCount: number;
  messagesSent: number;
  messagesReceived: number;
  publishFailures: number;
  errors: number;
  manualLightOverride: { value: 0 | 1; expiresAt: number } | null;
  lastCurrentAmps: number;
  lastActivePowerW: number;
  hwVersion: string;
  swVersion: string;
}
