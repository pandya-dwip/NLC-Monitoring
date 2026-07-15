// Mirrors backend/src/mqtt/deviceClient.ts's MqttMessageEvent.

export interface MqttMessageEvent {
  clientId: string;
  direction: 'publish' | 'receive';
  topic: string;
  qos: number;
  sizeBytes: number;
  latencyMs: number | null;
  status: 'ok' | 'error';
  timestamp: number;
  payloadPreview: string;
}
