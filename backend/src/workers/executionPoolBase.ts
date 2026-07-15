import { config } from '../config';
import { fleetStore } from './fleetStore';
import { loadDeviceCredentials, shardDevices } from '../utils/deviceLoader';
import { getLogger, logError } from '../logger';
import type { MainToWorkerMessage, WorkerToMainMessage } from '../models/workerMessages';
import type { PoolUnit } from './poolUnit';

const systemLogger = getLogger('system');
const mqttLogger = getLogger('mqtt');
const commandsLogger = getLogger('commands');
const performanceLogger = getLogger('performance');

/**
 * Orchestrates a shard-per-unit device fleet (bootstrap/start/stop/pause/
 * resume/shutdown/rescale) and routes WorkerToMainMessages into fleetStore.
 * Transport-agnostic: works identically whether `spawnUnit` creates a
 * worker_thread (workerPool.ts) or a forked child_process (processPool.ts).
 */
export class BaseExecutionPool {
  private units: PoolUnit[] = [];
  private running = false;
  private paused = false;

  constructor(
    private readonly label: string,
    private readonly spawnUnit: (unitId: number) => PoolUnit,
  ) {}

  async bootstrap(): Promise<void> {
    const devices = loadDeviceCredentials();
    if (devices.length === 0) {
      systemLogger.warn('No devices loaded from devices.json (check DEVICE_LIMIT / file contents)');
    }
    const shards = shardDevices(devices, config.workers.count);

    fleetStore.reset();
    this.paused = false;

    this.units = shards.map((shard, unitId) => this.spawnAndInit(unitId, shard));

    systemLogger.info(
      { label: this.label, unitCount: this.units.length, deviceCount: devices.length },
      'Execution pool bootstrapped',
    );
  }

  start(): void {
    this.running = true;
    fleetStore.setRunning(true);
    this.broadcast({ type: 'start' });
    systemLogger.info({ label: this.label }, 'Simulation started');
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    fleetStore.setRunning(false);
    fleetStore.setPaused(false);
    this.broadcast({ type: 'stop' });
    systemLogger.info({ label: this.label }, 'Simulation stopped');
  }

  /** Halts publishing but leaves every MQTT connection intact -- unlike stop(), resume() doesn't reconnect. */
  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    fleetStore.setPaused(true);
    this.broadcast({ type: 'pause' });
    systemLogger.info({ label: this.label }, 'Simulation paused');
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    fleetStore.setPaused(false);
    this.broadcast({ type: 'resume' });
    systemLogger.info({ label: this.label }, 'Simulation resumed');
  }

  isRunning(): boolean {
    return this.running;
  }

  isPaused(): boolean {
    return this.paused;
  }

  async shutdown(): Promise<void> {
    this.broadcast({ type: 'shutdown' });
    await Promise.all(
      this.units.map(
        (unit) =>
          new Promise<void>((resolve) => {
            let resolved = false;
            const done = (): void => {
              if (resolved) return;
              resolved = true;
              resolve();
            };
            unit.onExit(done);
            setTimeout(done, 3000);
          }),
      ),
    );
    await Promise.all(this.units.map((unit) => unit.terminate().catch(() => undefined)));
    this.units = [];
    systemLogger.info({ label: this.label }, 'Execution pool shut down');
  }

  /** Reloads devices.json / .env-derived limits and restarts the fleet (used by the scale API). */
  async rescale(): Promise<void> {
    const wasRunning = this.running;
    const wasPaused = this.paused;
    if (this.units.length > 0) {
      await this.shutdown();
    }
    await this.bootstrap();
    if (wasRunning) {
      this.start();
      if (wasPaused) this.pause();
    }
  }

  private spawnAndInit(unitId: number, devices: ReturnType<typeof loadDeviceCredentials>): PoolUnit {
    const unit = this.spawnUnit(unitId);

    unit.onMessage((msg) => this.handleUnitMessage(msg));
    unit.onError((err) => {
      logError('system', `${this.label} unit ${unitId} crashed`, err);
      fleetStore.markWorkerStopped(unitId);
    });
    unit.onExit((code) => {
      if (code !== 0) {
        systemLogger.warn({ label: this.label, unitId, code }, 'Unit exited unexpectedly');
      }
      fleetStore.markWorkerStopped(unitId);
    });

    const initMsg: MainToWorkerMessage = { type: 'init', workerId: unitId, devices };
    unit.postMessage(initMsg);

    return unit;
  }

  private broadcast(message: MainToWorkerMessage): void {
    for (const unit of this.units) {
      unit.postMessage(message);
    }
  }

  private handleUnitMessage(msg: WorkerToMainMessage): void {
    switch (msg.type) {
      case 'ready':
        fleetStore.registerWorker(msg.workerId, msg.deviceCount);
        systemLogger.info(
          { label: this.label, workerId: msg.workerId, deviceCount: msg.deviceCount },
          'Unit ready',
        );
        break;

      case 'device-status-batch':
        fleetStore.applyDeviceStates(msg.states);
        break;

      case 'mqtt-message-batch':
        fleetStore.applyMqttEvents(msg.events, msg.droppedCount);
        for (const evt of msg.events) {
          mqttLogger.info(evt, 'mqtt-message');
        }
        break;

      case 'command-received-batch':
        fleetStore.applyCommands(msg.commands);
        for (const c of msg.commands) {
          commandsLogger.info(c, 'command-received');
        }
        break;

      case 'stats-tick':
        fleetStore.applyStatsTick({
          messagesSent: msg.messagesSent,
          messagesReceived: msg.messagesReceived,
          publishSuccess: msg.publishSuccess,
          publishFailure: msg.publishFailure,
          reconnects: msg.reconnects,
          bytesSent: msg.bytesSent,
          bytesReceived: msg.bytesReceived,
          droppedMessages: msg.droppedMessages,
        });
        performanceLogger.debug(msg, 'stats-tick');
        break;

      case 'log':
        getLogger(msg.category).info(msg.data, msg.message);
        break;

      case 'stopped':
        fleetStore.markWorkerStopped(msg.workerId);
        break;
    }
  }
}
