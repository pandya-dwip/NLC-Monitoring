import { Chip } from '@heroui/react';
import type { ConnectionStatus } from '../types/device';

const STATUS_COLOR: Record<ConnectionStatus, 'success' | 'warning' | 'default' | 'danger'> = {
  connected: 'success',
  connecting: 'warning',
  disconnected: 'default',
  offline: 'default',
  error: 'danger',
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting',
  disconnected: 'Disconnected',
  offline: 'Offline',
  error: 'Error',
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  return (
    <Chip color={STATUS_COLOR[status]} variant="soft" size="sm">
      {STATUS_LABEL[status]}
    </Chip>
  );
}
