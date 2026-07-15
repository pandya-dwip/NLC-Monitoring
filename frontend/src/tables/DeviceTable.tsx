import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import dayjs from 'dayjs';
import { DataTable } from './DataTable';
import { ConnectionStatusBadge } from '../components/ConnectionStatusBadge';
import { useDeviceList } from '../store/useDeviceStore';
import type { DeviceState } from '../types/device';

const columnHelper = createColumnHelper<DeviceState>();

function formatTime(ts: number | null): string {
  return ts ? dayjs(ts).format('HH:mm:ss') : '—';
}

const columns = [
  columnHelper.accessor('clientId', { header: 'Client ID' }),
  columnHelper.accessor('nlcId', { header: 'NLC ID' }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <ConnectionStatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor('lastPublishAt', {
    header: 'Last Publish',
    cell: (info) => formatTime(info.getValue()),
  }),
  columnHelper.accessor('lastCommandAt', {
    header: 'Last Command',
    cell: (info) => formatTime(info.getValue()),
  }),
  columnHelper.accessor('lastLatencyMs', {
    header: 'Latency',
    cell: (info) => (info.getValue() !== null ? `${info.getValue()} ms` : '—'),
  }),
  columnHelper.accessor('voltageBaseline', {
    header: 'Voltage',
    cell: (info) => `${info.getValue().toFixed(1)} V`,
  }),
  columnHelper.accessor('lastCurrentAmps', {
    header: 'Current',
    cell: (info) => `${info.getValue().toFixed(3)} A`,
  }),
  columnHelper.accessor('lastActivePowerW', {
    header: 'Power',
    cell: (info) => `${info.getValue().toFixed(1)} W`,
  }),
  columnHelper.accessor('lightState', {
    header: 'Light State',
    cell: (info) => (info.getValue() === 1 ? 'On' : 'Off'),
  }),
  columnHelper.accessor('swVersion', { header: 'Firmware' }),
  columnHelper.accessor('reconnectCount', { header: 'Reconnects' }),
  columnHelper.accessor('messagesSent', { header: 'Msgs Sent' }),
  columnHelper.accessor('messagesReceived', { header: 'Msgs Recv' }),
  columnHelper.accessor('errors', { header: 'Errors' }),
];

export function DeviceTable() {
  const devices = useDeviceList();
  const stableColumns = useMemo(() => columns, []);

  return (
    <DataTable
      columns={stableColumns}
      data={devices}
      searchPlaceholder="Search by Client ID or NLC ID..."
      emptyMessage="No devices connected yet."
    />
  );
}
