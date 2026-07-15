import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from '../config';
import { getLogger } from '../logger';
import { fleetStore } from '../workers/fleetStore';
import type { DeviceState } from '../models/device';
import type { MqttMessageEvent } from '../mqtt/deviceClient';
import type { CommandReceivedEvent } from '../models/workerMessages';

const systemLogger = getLogger('system');

export interface SocketServerHandle {
  io: SocketIOServer;
  httpServer: http.Server;
  close: () => Promise<void>;
}

/**
 * Push-only real-time layer: 'device:status', 'mqtt:message',
 * 'command:received', 'metrics:snapshot'. No client polling -- the server
 * emits on state change and on a fixed METRICS_INTERVAL heartbeat.
 */
export function startSocketServer(): SocketServerHandle | null {
  if (!config.features.enableWebsocket) {
    systemLogger.info('Socket.IO disabled via ENABLE_WEBSOCKET=false');
    return null;
  }

  const httpServer = http.createServer();
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  const onDeviceStatus = (states: DeviceState[]): void => {
    io.emit('device:status', states);
  };
  const onMqttMessage = (events: MqttMessageEvent[]): void => {
    io.emit('mqtt:message', events);
  };
  const onCommandReceived = (commands: CommandReceivedEvent[]): void => {
    io.emit('command:received', commands);
  };

  fleetStore.on('device:status', onDeviceStatus);
  fleetStore.on('mqtt:message', onMqttMessage);
  fleetStore.on('command:received', onCommandReceived);

  const metricsTimer = setInterval(() => {
    io.emit('metrics:snapshot', fleetStore.buildMetricsSnapshot());
  }, config.metrics.interval);
  metricsTimer.unref();

  io.on('connection', (socket) => {
    systemLogger.debug({ socketId: socket.id }, 'Socket.IO client connected');
    socket.emit('metrics:snapshot', fleetStore.buildMetricsSnapshot());
    socket.emit('device:status', fleetStore.getDevices());
  });

  httpServer.listen(config.servers.socketPort, () => {
    systemLogger.info({ port: config.servers.socketPort }, 'Socket.IO server listening');
  });

  return {
    io,
    httpServer,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(metricsTimer);
        fleetStore.off('device:status', onDeviceStatus);
        fleetStore.off('mqtt:message', onMqttMessage);
        fleetStore.off('command:received', onCommandReceived);
        io.close(() => httpServer.close(() => resolve()));
      }),
  };
}
