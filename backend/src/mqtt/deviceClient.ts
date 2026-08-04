import { EventEmitter } from 'node:events';
import mqtt, { type MqttClient } from 'mqtt';
import { config } from '../config';
import { createInitialDeviceState } from '../models/device';
import type { DeviceCredentials, DeviceState } from '../models/device';
import type { IncomingCommand } from '../models/command';
import { applyCommandAndBuildResponse, parseIncomingMessage } from '../rpc/commandHandler';
import { renderOfflinePayload } from '../simulator/deviceBehavior';

export interface MqttMessageEvent {
  clientId: string;
  direction: 'publish' | 'receive';
  topic: string;
  qos: number;
  sizeBytes: number;
  latencyMs: number | null;
  status: 'ok' | 'error';
  timestamp: number;
  /** Truncated payload text for the live MQTT monitor -- not the full message. */
  payloadPreview: string;
}

const ATTRIBUTES_TOPIC = 'v1/devices/me/attributes';
const STANDARD_SUBSCRIBE_TOPICS = [
  'v1/devices/me/rpc/request/+',
  ATTRIBUTES_TOPIC,
  'v1/devices/me/attributes/response/+',
];

const PAYLOAD_PREVIEW_MAX_CHARS = 500;

function toPayloadPreview(body: string | Buffer): string {
  const text = typeof body === 'string' ? body : body.toString('utf-8');
  return text.length > PAYLOAD_PREVIEW_MAX_CHARS
    ? `${text.slice(0, PAYLOAD_PREVIEW_MAX_CHARS)}…`
    : text;
}

/**
 * Wraps a single independent MQTT.js connection for one simulated device,
 * using that device's own clientId/username/password (no shared client).
 * Emits: 'status' (DeviceState), 'mqtt-message' (MqttMessageEvent),
 * 'command' (IncomingCommand, latencyMs, response, stateChange, forcePublish).
 */
export class DeviceClient extends EventEmitter {
  readonly state: DeviceState;
  private client: MqttClient | null = null;

  constructor(
    private readonly creds: DeviceCredentials,
    nlcIdOverride?: string,
  ) {
    super();
    this.state = createInitialDeviceState(creds, nlcIdOverride ?? creds.clientId);
  }

  connect(): void {
    const url = `${config.mqtt.protocol}://${config.mqtt.host}:${config.mqtt.port}`;
    this.client = mqtt.connect(url, {
      clientId: this.creds.clientId,
      username: this.creds.userName,
      password: this.creds.password,
      keepalive: config.mqtt.keepalive,
      clean: config.mqtt.cleanSession,
      reconnectPeriod: config.mqtt.autoReconnect ? config.mqtt.reconnectPeriod : 0,
      connectTimeout: 15_000,
    });

    this.client.on('connect', () => this.handleConnect());
    this.client.on('reconnect', () => this.handleReconnect());
    this.client.on('close', () => this.handleClose());
    this.client.on('error', (err) => this.handleError(err));
    this.client.on('message', (topic, payload) => this.handleIncoming(topic, payload));
  }

  disconnect(): void {
    this.client?.end(true);
  }

  /** Manual disconnect (Device History page / API) -- mqtt.js does not auto-reconnect after
   * an explicit end(), so this stays disconnected until manualReconnect() is called. Reports
   * light-off + a communication failure as its last known values before actually closing
   * (graceful end(false), not force -- so that final publish has a chance to flush first). */
  manualDisconnect(): void {
    this.state.manuallyDisconnected = true;
    if (this.client && this.state.status === 'connected') {
      const offlinePayload = renderOfflinePayload(this.state);
      this.publish(config.mqtt.topic, JSON.stringify(offlinePayload), config.mqtt.retain);
    }
    this.client?.end(false);
    this.emitStatus();
  }

  manualReconnect(): void {
    this.state.manuallyDisconnected = false;
    this.connect();
  }

  publishTelemetry(payload: unknown): void {
    if (!this.client || this.state.status !== 'connected') return;
    this.publish(config.mqtt.topic, JSON.stringify(payload), config.mqtt.retain);
  }

  private handleConnect(): void {
    this.state.status = 'connected';
    this.emitStatus();
    const topics = [...STANDARD_SUBSCRIBE_TOPICS, ...config.mqtt.extraSubscribeTopics];
    this.client?.subscribe(topics, { qos: config.mqtt.qos });
    // Static device characteristic (not a telemetry reading) -- the downstream
    // EnergySavingsService needs this attribute to compute consumption/savings.
    this.publish(ATTRIBUTES_TOPIC, JSON.stringify({ Wattage: this.state.ratedWattage }), false);
  }

  private handleReconnect(): void {
    this.state.reconnectCount += 1;
    this.state.status = 'connecting';
    this.emitStatus();
  }

  private handleClose(): void {
    if (this.state.status !== 'error') {
      this.state.status = 'disconnected';
      this.emitStatus();
    }
  }

  private handleError(err: Error): void {
    this.state.status = 'error';
    this.state.errors += 1;
    this.emitStatus();
    this.emit('mqtt-message', {
      clientId: this.creds.clientId,
      direction: 'publish',
      topic: config.mqtt.topic,
      qos: config.mqtt.qos,
      sizeBytes: 0,
      latencyMs: null,
      status: 'error',
      timestamp: Date.now(),
      payloadPreview: '',
    } satisfies MqttMessageEvent);
    void err;
  }

  private handleIncoming(topic: string, payload: Buffer): void {
    const receivedAt = Date.now();
    this.state.messagesReceived += 1;
    this.emitStatus();
    this.emit('mqtt-message', {
      clientId: this.creds.clientId,
      direction: 'receive',
      topic,
      qos: config.mqtt.qos,
      sizeBytes: payload.length,
      latencyMs: null,
      status: 'ok',
      timestamp: receivedAt,
      payloadPreview: toPayloadPreview(payload),
    } satisfies MqttMessageEvent);

    const command = parseIncomingMessage(this.creds.clientId, topic, payload);
    if (!command) return;

    const { responseTopic, responsePayload, stateChange, forcePublish } = applyCommandAndBuildResponse(
      command,
      this.state,
    );
    const latencyMs = Date.now() - command.receivedAt;
    const response =
      responseTopic && responsePayload ? { topic: responseTopic, payload: responsePayload } : null;
    this.emit('command', command satisfies IncomingCommand, latencyMs, response, stateChange, forcePublish);

    if (response) {
      this.publish(response.topic, JSON.stringify(response.payload), false);
    }
  }

  private publish(topic: string, body: string, retain: boolean): void {
    const startedAt = Date.now();
    this.client?.publish(topic, body, { qos: config.mqtt.qos, retain }, (err) => {
      const latencyMs = Date.now() - startedAt;
      if (err) {
        this.state.publishFailures += 1;
        this.emitStatus();
        this.emit('mqtt-message', {
          clientId: this.creds.clientId,
          direction: 'publish',
          topic,
          qos: config.mqtt.qos,
          sizeBytes: Buffer.byteLength(body),
          latencyMs,
          status: 'error',
          timestamp: Date.now(),
          payloadPreview: toPayloadPreview(body),
        } satisfies MqttMessageEvent);
        return;
      }
      this.state.messagesSent += 1;
      this.state.lastPublishAt = Date.now();
      this.state.lastLatencyMs = latencyMs;
      this.emitStatus();
      this.emit('mqtt-message', {
        clientId: this.creds.clientId,
        direction: 'publish',
        topic,
        qos: config.mqtt.qos,
        sizeBytes: Buffer.byteLength(body),
        latencyMs,
        status: 'ok',
        timestamp: Date.now(),
        payloadPreview: toPayloadPreview(body),
      } satisfies MqttMessageEvent);
    });
  }

  private emitStatus(): void {
    this.emit('status', this.state);
  }
}
