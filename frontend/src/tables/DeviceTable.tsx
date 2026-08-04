import { useMemo, useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import dayjs from 'dayjs';
import { Button } from '@heroui/react';
import { DataTable } from './DataTable';
import { ConnectionStatusBadge } from '../components/ConnectionStatusBadge';
import { LightModeBadge } from '../components/LightModeBadge';
import { useDeviceList } from '../store/useDeviceStore';
import { classifyLightMode, type ConnectionStatus, type DeviceState, type LightMode } from '../types/device';

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
  columnHelper.display({
    id: 'lightMode',
    header: 'Light Mode',
    cell: (info) => <LightModeBadge device={info.row.original} />,
  }),
  columnHelper.accessor(
    (row) => (row.manualLightOverride ? dayjs(row.manualLightOverride.expiresAt).format('HH:mm:ss') : '—'),
    {
      id: 'override',
      header: 'Override Until',
    },
  ),
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
  columnHelper.accessor('ratedWattage', {
    header: 'Rated W',
    cell: (info) => `${info.getValue()} W`,
  }),
  columnHelper.accessor('dailyKwh', {
    header: 'Daily kWh',
    cell: (info) => info.getValue().toFixed(3),
  }),
  columnHelper.accessor('cumKwh', {
    header: 'Cum kWh',
    cell: (info) => info.getValue().toFixed(2),
  }),
  columnHelper.accessor('swVersion', { header: 'Firmware' }),
  columnHelper.accessor('reconnectCount', { header: 'Reconnects' }),
  columnHelper.accessor('messagesSent', { header: 'Msgs Sent' }),
  columnHelper.accessor('messagesReceived', { header: 'Msgs Recv' }),
  columnHelper.accessor('publishFailures', { header: 'Pub Failures' }),
  columnHelper.accessor('errors', { header: 'Errors' }),
];

const LIGHT_MODE_FILTERS: Array<{ value: LightMode | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'on', label: 'On' },
  { value: 'dim', label: 'Dim' },
  { value: 'off', label: 'Off' },
];

const STATUS_FILTERS: Array<{ value: ConnectionStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'connected', label: 'Connected' },
  { value: 'connecting', label: 'Connecting' },
  { value: 'disconnected', label: 'Disconnected' },
  { value: 'error', label: 'Error' },
  { value: 'offline', label: 'Offline' },
];

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">{label}:</span>
      <div className="flex gap-1">
        {options.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={value === opt.value ? 'primary' : 'outline'}
            onPress={() => onChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function DeviceTable() {
  const devices = useDeviceList();
  const stableColumns = useMemo(() => columns, []);
  const [lightModeFilter, setLightModeFilter] = useState<LightMode | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ConnectionStatus | 'all'>('all');

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (lightModeFilter !== 'all' && classifyLightMode(d) !== lightModeFilter) return false;
      return true;
    });
  }, [devices, lightModeFilter, statusFilter]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <FilterGroup label="Light Mode" options={LIGHT_MODE_FILTERS} value={lightModeFilter} onChange={setLightModeFilter} />
        <FilterGroup label="Status" options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
        <span className="text-sm text-muted">
          {filtered.length} of {devices.length} devices
        </span>
      </div>
      <DataTable
        columns={stableColumns}
        data={filtered}
        searchPlaceholder="Search by Client ID or NLC ID..."
        emptyMessage="No devices match the current filters."
      />
    </div>
  );
}
