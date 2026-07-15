import { ConnectionManager } from '../mqtt/connectionManager';
import type { DeviceState } from '../models/device';
import type { MqttMessageEvent } from '../mqtt/deviceClient';
import type { CommandReceivedEvent, MainToWorkerMessage, WorkerToMainMessage } from '../models/workerMessages';
import type { IncomingCommand } from '../models/command';

const FLUSH_INTERVAL_MS = 500;
const MAX_MQTT_EVENTS_PER_FLUSH = 500;

export interface DeviceRunnerIo {
  post(message: WorkerToMainMessage): void;
  onMessage(handler: (msg: MainToWorkerMessage) => void): void;
}

/**
 * Shared execution-unit logic: buffers device-status/mqtt-message/command
 * events, flushes them every 500ms (not per-message) so a fleet of thousands
 * of devices doesn't flood the primary process's event loop, and wires a
 * ConnectionManager to the given device shard. Runs identically inside a
 * worker_thread (deviceWorker.ts) or a forked child_process (deviceProcess.ts)
 * -- only the `io` transport differs between the two entrypoints.
 */
export function runDeviceRunner(io: DeviceRunnerIo): void {
  let workerId = -1;
  let manager: ConnectionManager | null = null;

  const statusBuffer = new Map<string, DeviceState>();
  let mqttEventBuffer: MqttMessageEvent[] = [];
  let commandBuffer: CommandReceivedEvent[] = [];
  let lastReconnectTotal = 0;
  let flushTimer: NodeJS.Timeout | null = null;

  function flush(): void {
    if (!manager) return;

    if (statusBuffer.size > 0) {
      io.post({ type: 'device-status-batch', workerId, states: [...statusBuffer.values()] });
      statusBuffer.clear();
    }

    const droppedMessages = manager.consumeDroppedMessages();

    if (mqttEventBuffer.length > 0 || droppedMessages > 0) {
      io.post({
        type: 'mqtt-message-batch',
        workerId,
        events: mqttEventBuffer,
        droppedCount: droppedMessages,
      });
    }

    const messagesSent = mqttEventBuffer.filter(
      (e) => e.direction === 'publish' && e.status === 'ok',
    ).length;
    const publishFailure = mqttEventBuffer.filter(
      (e) => e.direction === 'publish' && e.status === 'error',
    ).length;
    const messagesReceived = mqttEventBuffer.filter((e) => e.direction === 'receive').length;
    const bytesSent = mqttEventBuffer
      .filter((e) => e.direction === 'publish')
      .reduce((sum, e) => sum + e.sizeBytes, 0);
    const bytesReceived = mqttEventBuffer
      .filter((e) => e.direction === 'receive')
      .reduce((sum, e) => sum + e.sizeBytes, 0);

    const reconnectTotal = manager.getStates().reduce((sum, s) => sum + s.reconnectCount, 0);
    const reconnects = Math.max(0, reconnectTotal - lastReconnectTotal);
    lastReconnectTotal = reconnectTotal;

    io.post({
      type: 'stats-tick',
      workerId,
      messagesSent,
      messagesReceived,
      publishSuccess: messagesSent,
      publishFailure,
      reconnects,
      bytesSent,
      bytesReceived,
      droppedMessages,
    });

    mqttEventBuffer = [];

    if (commandBuffer.length > 0) {
      io.post({ type: 'command-received-batch', workerId, commands: commandBuffer });
      commandBuffer = [];
    }
  }

  io.onMessage((msg) => {
    switch (msg.type) {
      case 'init': {
        workerId = msg.workerId;
        manager = new ConnectionManager(msg.devices);

        manager.on('status', (state: DeviceState) => {
          statusBuffer.set(state.clientId, { ...state });
        });

        manager.on('mqtt-message', (evt: MqttMessageEvent) => {
          if (mqttEventBuffer.length < MAX_MQTT_EVENTS_PER_FLUSH) {
            mqttEventBuffer.push(evt);
          }
        });

        manager.on(
          'command',
          (
            command: IncomingCommand,
            latencyMs: number,
            response: { topic: string; payload: unknown } | null,
          ) => {
            commandBuffer.push({ command, latencyMs, response });
          },
        );

        flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
        flushTimer.unref();

        io.post({ type: 'ready', workerId, deviceCount: msg.devices.length });
        break;
      }

      case 'start':
        manager?.start();
        break;

      case 'pause':
        manager?.pause();
        break;

      case 'resume':
        manager?.resume();
        break;

      case 'stop':
        // Note: the flush timer intentionally keeps running after stop --
        // disconnecting MQTT clients raises 'close' events asynchronously, and
        // those status updates (e.g. -> 'disconnected') still need to reach
        // the primary process on the next tick even though publishing has halted.
        manager?.stop();
        io.post({ type: 'stopped', workerId });
        break;

      case 'shutdown':
        manager?.stop();
        if (flushTimer) clearInterval(flushTimer);
        flush();
        io.post({ type: 'stopped', workerId });
        process.exit(0);
    }
  });
}
