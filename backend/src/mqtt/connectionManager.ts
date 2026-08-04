import { EventEmitter } from 'node:events';
import { config } from '../config';
import type { DeviceCredentials, DeviceState } from '../models/device';
import type { CommandStateChange, IncomingCommand } from '../models/command';
import { DeviceClient, type MqttMessageEvent } from './deviceClient';
import { renderTelemetry } from '../simulator/deviceBehavior';
import { createStressModeStrategy } from '../simulator/stressModes';
import { chunk } from '../utils/random';

/**
 * Owns a shard of DeviceClients (one MQTT connection each), stages their
 * startup in batches, and drives their publish cadence via the configured
 * stress-mode strategy. Runs inside a worker thread. Emits: 'status',
 * 'mqtt-message', 'command'.
 */
export class ConnectionManager extends EventEmitter {
  private readonly clients = new Map<string, DeviceClient>();
  private readonly publishTimers = new Map<string, NodeJS.Timeout>();
  private readonly strategy = createStressModeStrategy(config.simulation.mode, {
    rampUpTimeMs: config.simulation.rampUpTime,
    rampDownTimeMs: config.simulation.rampDownTime,
    spikeIntervalMs: config.simulation.spikeIntervalMs,
    spikeDurationMs: config.simulation.spikeDurationMs,
    spikeFactor: config.simulation.spikeFactor,
    burstSize: config.simulation.burstSize,
    burstQuietMs: config.simulation.burstQuietMs,
    peakHourStart: config.simulation.peakHourStart,
    peakHourEnd: config.simulation.peakHourEnd,
    peakHourRateMultiplier: config.simulation.peakHourRateMultiplier,
    nightRateMultiplier: config.simulation.nightRateMultiplier,
    chaosMinFactor: config.simulation.chaosMinFactor,
    chaosMaxFactor: config.simulation.chaosMaxFactor,
  });
  private running = false;
  private paused = false;
  private startedAt = 0;
  private tokens: number;
  private readonly capPerSecond: number;
  private tokenRefillTimer: NodeJS.Timeout | null = null;
  private droppedMessages = 0;

  constructor(private readonly devices: DeviceCredentials[]) {
    super();
    this.capPerSecond = Math.max(
      1,
      Math.ceil(config.simulation.maxMessagesPerSecond / config.workers.count),
    );
    this.tokens = this.capPerSecond;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startedAt = Date.now();
    this.tokenRefillTimer = setInterval(() => {
      this.tokens = this.capPerSecond;
    }, 1000);
    this.tokenRefillTimer.unref();

    const batches = chunk(this.devices, Math.max(1, config.devices.batchSize));
    const batchIntervalMs =
      batches.length > 1
        ? config.simulation.rampUpTime > 0
          ? config.simulation.rampUpTime / batches.length
          : 100
        : 0;

    batches.forEach((batch, batchIndex) => {
      const delay = config.simulation.startDelay + batchIndex * batchIntervalMs;
      setTimeout(() => {
        if (!this.running) return;
        batch.forEach((creds) => this.startDevice(creds));
      }, delay);
    });
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    if (this.tokenRefillTimer) clearInterval(this.tokenRefillTimer);
    for (const timer of this.publishTimers.values()) clearTimeout(timer);
    this.publishTimers.clear();
    for (const client of this.clients.values()) client.disconnect();
    this.clients.clear();
  }

  /** Halts publishing but leaves every MQTT connection intact -- unlike stop(), no reconnect on resume(). */
  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    for (const timer of this.publishTimers.values()) clearTimeout(timer);
    this.publishTimers.clear();
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    for (const client of this.clients.values()) {
      this.schedulePublish(client);
    }
  }

  getStates(): DeviceState[] {
    return [...this.clients.values()].map((c) => c.state);
  }

  private startDevice(creds: DeviceCredentials): void {
    const client = new DeviceClient(creds);
    this.clients.set(creds.clientId, client);

    client.on('status', (state: DeviceState) => this.emit('status', state));
    client.on('mqtt-message', (evt: MqttMessageEvent) => this.emit('mqtt-message', evt));
    client.on(
      'command',
      (
        cmd: IncomingCommand,
        latencyMs: number,
        response: { topic: string; payload: unknown } | null,
        stateChange: CommandStateChange | null,
      ) => this.emit('command', cmd, latencyMs, response, stateChange),
    );

    client.connect();
    this.schedulePublish(client);
  }

  private schedulePublish(client: DeviceClient): void {
    if (!this.running || this.paused) return;
    const elapsedMs = Date.now() - this.startedAt;
    const intervalMs = this.strategy.nextIntervalMs(config.simulation.publishIntervalMs, elapsedMs);

    const timer = setTimeout(() => {
      if (!this.running || this.paused) return;
      if (this.tokens > 0) {
        this.tokens -= 1;
        const payload = renderTelemetry(client.state, intervalMs, config.devices.enableRandomization);
        client.publishTelemetry(payload);
      } else {
        this.droppedMessages += 1;
      }
      this.schedulePublish(client);
    }, intervalMs);

    this.publishTimers.set(client.state.clientId, timer);
  }

  consumeDroppedMessages(): number {
    const value = this.droppedMessages;
    this.droppedMessages = 0;
    return value;
  }
}
