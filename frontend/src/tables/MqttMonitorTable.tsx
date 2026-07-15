import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import dayjs from 'dayjs';
import { Chip } from '@heroui/react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { DataTable } from './DataTable';
import { useMqttMonitorStore } from '../store/useMqttMonitorStore';
import type { MqttMessageEvent } from '../types/mqtt';

const columnHelper = createColumnHelper<MqttMessageEvent>();

const columns = [
  columnHelper.accessor('timestamp', {
    header: 'Timestamp',
    cell: (info) => dayjs(info.getValue()).format('HH:mm:ss.SSS'),
  }),
  columnHelper.accessor('direction', {
    header: 'Direction',
    cell: (info) =>
      info.getValue() === 'publish' ? (
        <span className="flex items-center gap-1 text-accent">
          <ArrowUpFromLine className="h-3.5 w-3.5" aria-hidden /> Publish
        </span>
      ) : (
        <span className="flex items-center gap-1 text-muted">
          <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden /> Receive
        </span>
      ),
  }),
  columnHelper.accessor('clientId', { header: 'Device' }),
  columnHelper.accessor('topic', { header: 'Topic' }),
  columnHelper.accessor('payloadPreview', {
    header: 'Payload',
    cell: (info) => (
      <span className="block max-w-xs truncate font-mono text-xs" title={info.getValue()}>
        {info.getValue() || '—'}
      </span>
    ),
  }),
  columnHelper.accessor('qos', { header: 'QoS' }),
  columnHelper.accessor('sizeBytes', { header: 'Size', cell: (info) => `${info.getValue()} B` }),
  columnHelper.accessor('latencyMs', {
    header: 'Latency',
    cell: (info) => (info.getValue() !== null ? `${info.getValue()} ms` : '—'),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => (
      <Chip color={info.getValue() === 'ok' ? 'success' : 'danger'} variant="soft" size="sm">
        {info.getValue()}
      </Chip>
    ),
  }),
];

export function MqttMonitorTable() {
  const events = useMqttMonitorStore((s) => s.events);
  const stableColumns = useMemo(() => columns, []);
  const displayed = useMemo(() => [...events].reverse(), [events]);

  return (
    <DataTable
      columns={stableColumns}
      data={displayed}
      searchPlaceholder="Search by topic or device..."
      emptyMessage="No MQTT traffic observed yet."
      pageSize={50}
    />
  );
}
