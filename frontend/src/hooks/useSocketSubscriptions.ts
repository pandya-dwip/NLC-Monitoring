import { useEffect } from 'react';
import { socket } from '../websocket/socketClient';
import { useDeviceStore } from '../store/useDeviceStore';
import { useMqttMonitorStore } from '../store/useMqttMonitorStore';
import { useCommandStore } from '../store/useCommandStore';
import { useMetricsStore } from '../store/useMetricsStore';
import type { DeviceState } from '../types/device';
import type { MqttMessageEvent } from '../types/mqtt';
import type { CommandReceivedEvent } from '../types/command';
import type { MetricsSnapshot } from '../types/metrics';

/**
 * Mounted once at the app root. This is the single place that touches the
 * socket -- every component reads live data from the Zustand stores instead.
 */
export function useSocketSubscriptions(): void {
  const patchDevices = useDeviceStore((s) => s.patchMany);
  const appendMqttEvents = useMqttMonitorStore((s) => s.append);
  const appendCommands = useCommandStore((s) => s.append);
  const setMetricsSnapshot = useMetricsStore((s) => s.setSnapshot);
  const setSocketConnected = useMetricsStore((s) => s.setSocketConnected);

  useEffect(() => {
    const onConnect = (): void => setSocketConnected(true);
    const onDisconnect = (): void => setSocketConnected(false);
    const onDeviceStatus = (states: DeviceState[]): void => patchDevices(states);
    const onMqttMessage = (events: MqttMessageEvent[]): void => appendMqttEvents(events, 0);
    const onCommandReceived = (commands: CommandReceivedEvent[]): void => appendCommands(commands);
    const onMetricsSnapshot = (snapshot: MetricsSnapshot): void => setMetricsSnapshot(snapshot);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('device:status', onDeviceStatus);
    socket.on('mqtt:message', onMqttMessage);
    socket.on('command:received', onCommandReceived);
    socket.on('metrics:snapshot', onMetricsSnapshot);

    setSocketConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('device:status', onDeviceStatus);
      socket.off('mqtt:message', onMqttMessage);
      socket.off('command:received', onCommandReceived);
      socket.off('metrics:snapshot', onMetricsSnapshot);
    };
  }, [patchDevices, appendMqttEvents, appendCommands, setMetricsSnapshot, setSocketConnected]);
}
