import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import dayjs from 'dayjs';
import { Chip } from '@heroui/react';
import { DataTable } from './DataTable';
import { useCommandStore } from '../store/useCommandStore';
import type { CommandReceivedEvent, CommandStateChange } from '../types/command';

const columnHelper = createColumnHelper<CommandReceivedEvent>();

/** Plain-English summary of what a command actually changed on the device. */
function formatStateChange(change: CommandStateChange | null): string {
  if (!change) return '—';
  const parts: string[] = [];
  if (change.lightState) {
    parts.push(`Light ${change.lightState.from ? 'ON' : 'OFF'} → ${change.lightState.to ? 'ON' : 'OFF'}`);
  }
  if (change.dimLevel) {
    parts.push(`Dim ${change.dimLevel.from}% → ${change.dimLevel.to}%`);
  }
  if (change.overrideExpiresAt !== undefined) {
    parts.push(
      change.overrideExpiresAt === null
        ? 'Override cleared'
        : `Override until ${dayjs(change.overrideExpiresAt).format('HH:mm:ss')}`,
    );
  }
  return parts.join(', ');
}

/** Expandable full JSON -- native <details>, no modal/dependency needed. */
function JsonDetails({ value, label }: { value: unknown; label: string }) {
  if (value === null || value === undefined) return <span className="text-muted">—</span>;
  const json = JSON.stringify(value, null, 2);
  return (
    <details>
      <summary className="cursor-pointer text-accent hover:underline">{label}</summary>
      <pre className="mt-1 max-w-md whitespace-pre-wrap break-all rounded bg-surface-secondary p-2 font-mono text-xs">
        {json}
      </pre>
    </details>
  );
}

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
  columnHelper.display({
    id: 'payload',
    header: 'Payload',
    cell: (info) => <JsonDetails value={info.row.original.command.payload} label="view" />,
  }),
  columnHelper.accessor('latencyMs', {
    header: 'Execution Time',
    cell: (info) => `${info.getValue()} ms`,
  }),
  columnHelper.display({
    id: 'response',
    header: 'Response',
    cell: (info) => <JsonDetails value={info.row.original.response?.payload} label="view" />,
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
  columnHelper.accessor((row) => formatStateChange(row.stateChange), {
    id: 'stateChange',
    header: 'Changes',
    cell: (info) => (
      <span className={info.getValue() === '—' ? 'text-muted' : ''}>{info.getValue()}</span>
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
