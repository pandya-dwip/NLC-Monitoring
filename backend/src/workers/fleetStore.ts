import os from 'node:os';
import { EventEmitter } from 'node:events';
import { config } from '../config';
import type { DeviceState, LightHistoryEntry } from '../models/device';
import type { MqttMessageEvent } from '../mqtt/deviceClient';
import type { CommandReceivedEvent } from '../models/workerMessages';
import type { MetricsSnapshot } from '../models/metrics';

const MQTT_RING_BUFFER_SIZE = 2000;
const COMMAND_RING_BUFFER_SIZE = 500;
const LATENCY_SAMPLE_WINDOW = 500;
const LIGHT_HISTORY_PER_DEVICE = 200;

interface Totals {
  messagesSent: number;
  messagesReceived: number;
  publishSuccess: number;
  publishFailure: number;
  reconnects: number;
  bytesSent: number;
  bytesReceived: number;
  droppedMessages: number;
  commandsReceived: number;
  rpcRequests: number;
}

/**
 * Central in-memory aggregator fed by the worker pool. The API and
 * Socket.IO layers read from this; nothing here talks to MQTT directly.
 */
export class FleetStore extends EventEmitter {
  private readonly devices = new Map<string, DeviceState>();
  private readonly lightHistory = new Map<string, LightHistoryEntry[]>();
  private mqttRingBuffer: MqttMessageEvent[] = [];
  private commandRingBuffer: CommandReceivedEvent[] = [];
  private readonly workerStatus = new Map<number, { deviceCount: number; alive: boolean }>();
  private latencySamples: number[] = [];
  private totals: Totals = {
    messagesSent: 0,
    messagesReceived: 0,
    publishSuccess: 0,
    publishFailure: 0,
    reconnects: 0,
    bytesSent: 0,
    bytesReceived: 0,
    droppedMessages: 0,
    commandsReceived: 0,
    rpcRequests: 0,
  };
  private windowStartedAt = Date.now();
  private messagesInWindow = 0;
  private bytesInWindow = 0;
  private lastMessagesPerSecond = 0;
  private lastBytesPerSecond = 0;
  private running = false;
  private paused = false;

  setRunning(running: boolean): void {
    this.running = running;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  registerWorker(workerId: number, deviceCount: number): void {
    this.workerStatus.set(workerId, { deviceCount, alive: true });
  }

  markWorkerStopped(workerId: number): void {
    const entry = this.workerStatus.get(workerId);
    if (entry) entry.alive = false;
  }

  applyDeviceStates(states: DeviceState[]): void {
    for (const state of states) {
      const previous = this.devices.get(state.clientId);
      const publishedAt = state.lastPublishAt;
      if (publishedAt !== null && publishedAt !== (previous?.lastPublishAt ?? null)) {
        this.recordLightHistory(state, publishedAt);
      }
      this.devices.set(state.clientId, state);
      if (state.lastLatencyMs !== null && config.features.latencyTracking) {
        this.latencySamples.push(state.lastLatencyMs);
        if (this.latencySamples.length > LATENCY_SAMPLE_WINDOW) {
          this.latencySamples = this.latencySamples.slice(-LATENCY_SAMPLE_WINDOW);
        }
      }
    }
    this.emit('device:status', states);
  }

  /** One entry per actual publish (not per 500ms status-batch tick) -- see applyDeviceStates. */
  private recordLightHistory(state: DeviceState, publishedAt: number): void {
    const entry: LightHistoryEntry = { ts: publishedAt, lightState: state.lightState, dimLevel: state.dimLevel };
    const history = this.lightHistory.get(state.clientId) ?? [];
    history.push(entry);
    if (history.length > LIGHT_HISTORY_PER_DEVICE) {
      history.splice(0, history.length - LIGHT_HISTORY_PER_DEVICE);
    }
    this.lightHistory.set(state.clientId, history);
  }

  applyMqttEvents(events: MqttMessageEvent[], droppedCount: number): void {
    if (events.length > 0) {
      this.mqttRingBuffer.push(...events);
      if (this.mqttRingBuffer.length > MQTT_RING_BUFFER_SIZE) {
        this.mqttRingBuffer = this.mqttRingBuffer.slice(-MQTT_RING_BUFFER_SIZE);
      }
      this.messagesInWindow += events.length;
      this.bytesInWindow += events.reduce((sum, e) => sum + e.sizeBytes, 0);
      this.emit('mqtt:message', events);
    }
    this.totals.droppedMessages += droppedCount;
  }

  applyCommands(commands: CommandReceivedEvent[]): void {
    if (commands.length === 0) return;
    this.commandRingBuffer.push(...commands);
    if (this.commandRingBuffer.length > COMMAND_RING_BUFFER_SIZE) {
      this.commandRingBuffer = this.commandRingBuffer.slice(-COMMAND_RING_BUFFER_SIZE);
    }
    this.totals.commandsReceived += commands.length;
    this.totals.rpcRequests += commands.filter((c) => c.command.kind === 'rpc').length;
    this.emit('command:received', commands);
  }

  applyStatsTick(delta: Omit<Totals, 'commandsReceived' | 'rpcRequests'>): void {
    this.totals.messagesSent += delta.messagesSent;
    this.totals.messagesReceived += delta.messagesReceived;
    this.totals.publishSuccess += delta.publishSuccess;
    this.totals.publishFailure += delta.publishFailure;
    this.totals.reconnects += delta.reconnects;
    this.totals.bytesSent += delta.bytesSent;
    this.totals.bytesReceived += delta.bytesReceived;
    this.totals.droppedMessages += delta.droppedMessages;
  }

  getDevices(): DeviceState[] {
    return [...this.devices.values()];
  }

  getMqttEvents(limit = 200): MqttMessageEvent[] {
    return this.mqttRingBuffer.slice(-limit);
  }

  getCommands(limit = 100): CommandReceivedEvent[] {
    return this.commandRingBuffer.slice(-limit);
  }

  getLightHistory(clientId: string, limit = LIGHT_HISTORY_PER_DEVICE): LightHistoryEntry[] {
    return (this.lightHistory.get(clientId) ?? []).slice(-limit);
  }

  reset(): void {
    this.devices.clear();
    this.lightHistory.clear();
    this.mqttRingBuffer = [];
    this.commandRingBuffer = [];
    this.workerStatus.clear();
    this.latencySamples = [];
    this.totals = {
      messagesSent: 0,
      messagesReceived: 0,
      publishSuccess: 0,
      publishFailure: 0,
      reconnects: 0,
      bytesSent: 0,
      bytesReceived: 0,
      droppedMessages: 0,
      commandsReceived: 0,
      rpcRequests: 0,
    };
    this.windowStartedAt = Date.now();
    this.messagesInWindow = 0;
    this.bytesInWindow = 0;
    this.paused = false;
  }

  buildMetricsSnapshot(): MetricsSnapshot {
    const now = Date.now();
    const windowSeconds = (now - this.windowStartedAt) / 1000;
    if (windowSeconds >= 1) {
      this.lastMessagesPerSecond = this.messagesInWindow / windowSeconds;
      this.lastBytesPerSecond = this.bytesInWindow / windowSeconds;
      this.messagesInWindow = 0;
      this.bytesInWindow = 0;
      this.windowStartedAt = now;
    }

    const devices = this.getDevices();
    const avgLatencyMs =
      this.latencySamples.length > 0
        ? this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
        : 0;

    const memUsage = process.memoryUsage();
    const cpuUsagePercent = estimateCpuPercent(os.cpus().length);

    return {
      timestamp: now,
      devicesTotal: devices.length,
      devicesConnected: devices.filter((d) => d.status === 'connected').length,
      devicesDisconnected: devices.filter(
        (d) => d.status === 'disconnected' || d.status === 'offline' || d.status === 'error',
      ).length,
      devicesPublishing: devices.filter((d) => d.lastPublishAt && now - d.lastPublishAt < 60_000)
        .length,
      messagesSentTotal: this.totals.messagesSent,
      messagesReceivedTotal: this.totals.messagesReceived,
      messagesPerSecond: Math.round(this.lastMessagesPerSecond * 100) / 100,
      commandsReceivedTotal: this.totals.commandsReceived,
      rpcRequestsTotal: this.totals.rpcRequests,
      avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
      publishSuccessTotal: this.totals.publishSuccess,
      publishFailureTotal: this.totals.publishFailure,
      reconnectTotal: this.totals.reconnects,
      bytesPerSecond: Math.round(this.lastBytesPerSecond),
      packetsPerSecond: Math.round(this.lastMessagesPerSecond * 100) / 100,
      droppedMessages: this.totals.droppedMessages,
      retryCount: this.totals.reconnects,
      workerCount: this.workerStatus.size,
      workerStatus: [...this.workerStatus.entries()].map(([workerId, s]) => ({
        workerId,
        deviceCount: s.deviceCount,
        alive: s.alive,
      })),
      cpuUsagePercent,
      memoryUsedMb: Math.round(memUsage.rss / 1024 / 1024),
      memoryTotalMb: Math.round(os.totalmem() / 1024 / 1024),
      simulationMode: config.simulation.mode,
      simulationRunning: this.running,
      simulationPaused: this.paused,
    };
  }
}

let previousCpuUsage = process.cpuUsage();
let previousCpuTime = Date.now();

/** Percent of total available CPU capacity (normalized by core count) consumed by this process. */
function estimateCpuPercent(coreCount: number): number {
  const currentUsage = process.cpuUsage();
  const currentTime = Date.now();
  const elapsedMicros = (currentTime - previousCpuTime) * 1000;
  const userDelta = currentUsage.user - previousCpuUsage.user;
  const systemDelta = currentUsage.system - previousCpuUsage.system;
  previousCpuUsage = currentUsage;
  previousCpuTime = currentTime;
  if (elapsedMicros <= 0 || coreCount <= 0) return 0;
  const percent = ((userDelta + systemDelta) / elapsedMicros / coreCount) * 100;
  return Math.round(percent * 100) / 100;
}

export const fleetStore = new FleetStore();
