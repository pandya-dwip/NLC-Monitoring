import { useMemo } from 'react';
import { Card } from '@heroui/react';
import { TimeSeriesChart } from '../charts/TimeSeriesChart';
import { useMetricsStore } from '../store/useMetricsStore';
import { computeRateSeries } from '../lib/rateSeries';
import { formatBytes } from '../lib/format';

interface ChartDef {
  title: string;
  data: Array<Record<string, number> & { timestamp: number }>;
  seriesKey: string;
  color: string;
  valueFormatter?: (v: number) => string;
}

function ChartCard({ title, data, seriesKey, color, valueFormatter }: ChartDef) {
  return (
    <Card.Root className="p-4">
      <Card.Header className="p-0 pb-2">
        <Card.Title className="text-sm font-medium text-muted">{title}</Card.Title>
      </Card.Header>
      <Card.Content className="p-0">
        <TimeSeriesChart
          data={data}
          series={[{ key: seriesKey, label: title, color }]}
          valueFormatter={valueFormatter}
        />
      </Card.Content>
    </Card.Root>
  );
}

export function ChartsPage() {
  const history = useMetricsStore((s) => s.history);

  const charts = useMemo<ChartDef[]>(() => {
    const base = history.map((h) => ({
      timestamp: h.timestamp,
      devicesConnected: h.devicesConnected,
      bytesPerSecond: h.bytesPerSecond,
      messagesPerSecond: h.messagesPerSecond,
      avgLatencyMs: h.avgLatencyMs,
      cpuUsagePercent: h.cpuUsagePercent,
      memoryUsedMb: h.memoryUsedMb,
      reconnectTotal: h.reconnectTotal,
      publishFailureTotal: h.publishFailureTotal,
    }));
    const publishRate = computeRateSeries(history, 'publishSuccessTotal').map((d) => ({
      timestamp: d.timestamp,
      rate: d.rate,
    }));
    const commandRate = computeRateSeries(history, 'commandsReceivedTotal').map((d) => ({
      timestamp: d.timestamp,
      rate: d.rate,
    }));

    return [
      { title: 'Connected devices', data: base, seriesKey: 'devicesConnected', color: 'var(--color-accent)' },
      {
        title: 'MQTT throughput',
        data: base,
        seriesKey: 'bytesPerSecond',
        color: 'var(--color-accent)',
        valueFormatter: (v: number) => formatBytes(v),
      },
      { title: 'Messages / sec', data: base, seriesKey: 'messagesPerSecond', color: 'var(--color-accent)' },
      {
        title: 'Average latency (ms)',
        data: base,
        seriesKey: 'avgLatencyMs',
        color: 'var(--color-accent)',
      },
      { title: 'Publish / telemetry rate (per sec)', data: publishRate, seriesKey: 'rate', color: 'var(--color-accent)' },
      { title: 'Commands / sec', data: commandRate, seriesKey: 'rate', color: 'var(--color-accent)' },
      {
        title: 'CPU usage (%)',
        data: base,
        seriesKey: 'cpuUsagePercent',
        color: 'var(--color-accent)',
        valueFormatter: (v: number) => `${v.toFixed(1)}%`,
      },
      {
        title: 'Memory used (MB)',
        data: base,
        seriesKey: 'memoryUsedMb',
        color: 'var(--color-accent)',
      },
      { title: 'Reconnects (cumulative)', data: base, seriesKey: 'reconnectTotal', color: 'var(--color-accent)' },
      {
        title: 'Publish failures (cumulative)',
        data: base,
        seriesKey: 'publishFailureTotal',
        color: 'var(--color-accent)',
      },
    ];
  }, [history]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Charts</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {charts.map((chart) => (
          <ChartCard key={chart.title} {...chart} />
        ))}
      </div>
    </div>
  );
}
