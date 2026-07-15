import type { DeviceCredentials, DeviceState } from './device';
import type { IncomingCommand } from './command';
import type { MqttMessageEvent } from '../mqtt/deviceClient';

/** Main thread -> worker */
export type MainToWorkerMessage =
  | { type: 'init'; workerId: number; devices: DeviceCredentials[] }
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'shutdown' };

export interface CommandReceivedEvent {
  command: IncomingCommand;
  latencyMs: number;
  /** The ack/response published back for this command, if any (null for e.g. attribute updates). */
  response: { topic: string; payload: unknown } | null;
}

/**
 * Worker -> main thread. Per-device status and per-message MQTT traffic are
 * sent as periodic batches (buffered in the worker, flushed on a timer) so a
 * fleet of thousands of devices doesn't flood the main thread's event loop
 * with one postMessage per state change / packet.
 */
export type WorkerToMainMessage =
  | { type: 'ready'; workerId: number; deviceCount: number }
  | { type: 'device-status-batch'; workerId: number; states: DeviceState[] }
  | { type: 'mqtt-message-batch'; workerId: number; events: MqttMessageEvent[]; droppedCount: number }
  | { type: 'command-received-batch'; workerId: number; commands: CommandReceivedEvent[] }
  | {
      type: 'stats-tick';
      workerId: number;
      messagesSent: number;
      messagesReceived: number;
      publishSuccess: number;
      publishFailure: number;
      reconnects: number;
      bytesSent: number;
      bytesReceived: number;
      droppedMessages: number;
    }
  | { type: 'log'; workerId: number; category: LogCategory; level: string; message: string; data?: unknown }
  | { type: 'stopped'; workerId: number };

export type LogCategory = 'mqtt' | 'commands' | 'errors' | 'system' | 'performance';
