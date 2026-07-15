import { loadPayloadTemplate } from '../telemetry/payloadTemplate';
import { getPath } from '../utils/objectPath';

/** A single entry from devices.json — mirrors real device credentials. */
export interface DeviceCredentials {
  clientId: string;
  userName: string;
  password: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'offline';

/** Mutable simulated physical/operational state for one device, evolved every publish tick. */
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
  /** Set by an RPC/dimming command; overrides the day/night light schedule until it expires. */
  manualLightOverride: { value: 0 | 1; expiresAt: number } | null;
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
    cumKwh: 1500 + Math.random() * 500,
    operatingHours: 20000 + Math.random() * 2000,
    voltageBaseline: 225 + Math.random() * 15,
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
