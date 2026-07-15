import { Chip } from '@heroui/react';
import { useMetricsStore } from '../store/useMetricsStore';

export function SocketConnectionIndicator() {
  const connected = useMetricsStore((s) => s.socketConnected);
  return (
    <Chip color={connected ? 'success' : 'danger'} variant="soft" size="sm">
      {connected ? 'Live' : 'Disconnected'}
    </Chip>
  );
}
