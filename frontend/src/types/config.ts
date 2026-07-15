// Mirrors the response shape of GET /api/config (backend/src/api/routes/config.ts).

export interface AppConfigResponse {
  mqtt: {
    host: string;
    port: number;
    protocol: string;
    topic: string;
    qos: number;
    retain: boolean;
    extraSubscribeTopics: string[];
    keepalive: number;
    cleanSession: boolean;
    autoReconnect: boolean;
    reconnectPeriod: number;
  };
  devices: {
    limit: number;
    selectionMode: string;
    batchSize: number;
    enableRandomization: boolean;
  };
  simulation: {
    publishIntervalMs: number;
    payloadMode: string;
    mode: string;
    maxMessagesPerSecond: number;
    startDelay: number;
    rampUpTime: number;
    rampDownTime: number;
    heartbeatInterval: number;
  };
  features: {
    enableReconnect: boolean;
    enableRpc: boolean;
    enableAttributeUpdates: boolean;
    enableLogging: boolean;
    enableWebsocket: boolean;
    enableUi: boolean;
    latencyTracking: boolean;
  };
  workers: {
    count: number;
  };
  servers: {
    socketPort: number;
    apiPort: number;
  };
  metrics: {
    interval: number;
  };
}
