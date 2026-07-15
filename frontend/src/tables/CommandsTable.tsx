import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import dayjs from 'dayjs';
import { Chip } from '@heroui/react';
import { DataTable } from './DataTable';
import { useCommandStore } from '../store/useCommandStore';
import type { CommandReceivedEvent } from '../types/command';

const columnHelper = createColumnHelper<CommandReceivedEvent>();

const columns = [
  columnHelper.accessor((row) => row.command.receivedAt, {
    id: 'receivedAt',
    header: 'Timestamp',
    cell: (info) => dayjs(info.getValue()).format('HH:mm:ss.SSS'),
  }),
  columnHelper.accessor((row) => row.command.clientId, {
    id: 'clientId',
    header: 'Device',
  }),
  columnHelper.accessor((row) => row.command.kind, {
    id: 'kind',
    header: 'Kind',
    cell: (info) => (
      <Chip color="accent" variant="soft" size="sm">
        {info.getValue()}
      </Chip>
    ),
  }),
  columnHelper.accessor((row) => row.command.method ?? '—', {
    id: 'method',
    header: 'Command',
  }),
  columnHelper.accessor((row) => row.command.topic, {
    id: 'topic',
    header: 'Topic',
  }),
  columnHelper.accessor((row) => JSON.stringify(row.command.payload), {
    id: 'payload',
    header: 'Payload',
    cell: (info) => (
      <span className="block max-w-xs truncate font-mono text-xs" title={info.getValue()}>
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('latencyMs', {
    header: 'Execution Time',
    cell: (info) => `${info.getValue()} ms`,
  }),
  columnHelper.accessor((row) => (row.response ? JSON.stringify(row.response.payload) : ''), {
    id: 'response',
    header: 'Response',
    cell: (info) =>
      info.getValue() ? (
        <span className="block max-w-xs truncate font-mono text-xs" title={info.getValue()}>
          {info.getValue()}
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  }),
  columnHelper.accessor((row) => (row.response ? 'acknowledged' : 'no response'), {
    id: 'status',
    header: 'Status',
    cell: (info) => (
      <Chip color={info.getValue() === 'acknowledged' ? 'success' : 'default'} variant="soft" size="sm">
        {info.getValue()}
      </Chip>
    ),
  }),
];

export function CommandsTable() {
  const commands = useCommandStore((s) => s.commands);
  const stableColumns = useMemo(() => columns, []);
  const displayed = useMemo(() => [...commands].reverse(), [commands]);

  return (
    <DataTable
      columns={stableColumns}
      data={displayed}
      searchPlaceholder="Search by device, method, or topic..."
      emptyMessage="No commands received yet."
      pageSize={50}
    />
  );
}
