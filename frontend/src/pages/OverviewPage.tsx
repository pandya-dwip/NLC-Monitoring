import { Card } from '@heroui/react';
import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  Gauge,
  MemoryStick,
  Radio,
  RefreshCw,
  Terminal,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { StatTile } from '../components/StatTile';
import { TimeSeriesChart } from '../charts/TimeSeriesChart';
import { useMetricsStore } from '../store/useMetricsStore';
import { formatBytes, formatCompactNumber, formatMs, formatPercent } from '../lib/format';

export function OverviewPage() {
  const latest = useMetricsStore((s) => s.latest);
  const history = useMetricsStore((s) => s.history);

  const chartData = history.map((h) => ({
    timestamp: h.timestamp,
    connected: h.devicesConnected,
    messagesPerSecond: h.messagesPerSecond,
    avgLatencyMs: h.avgLatencyMs,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatTile label="Connected devices" value={formatCompactNumber(latest?.devicesConnected ?? 0)} icon={Wifi} tone="success" />
        <StatTile label="Disconnected devices" value={formatCompactNumber(latest?.devicesDisconnected ?? 0)} icon={WifiOff} />
        <StatTile label="Publishing devices" value={formatCompactNumber(latest?.devicesPublishing ?? 0)} icon={Radio} tone="success" />
        <StatTile label="Messages / sec" value={(latest?.messagesPerSecond ?? 0).toFixed(1)} icon={Zap} />
        <StatTile label="Avg latency" value={formatMs(latest?.avgLatencyMs ?? 0)} icon={Gauge} />
        <StatTile label="Commands received" value={formatCompactNumber(latest?.commandsReceivedTotal ?? 0)} icon={Terminal} />
        <StatTile label="RPC requests" value={formatCompactNumber(latest?.rpcRequestsTotal ?? 0)} icon={Terminal} />
        <StatTile label="Publish success" value={formatCompactNumber(latest?.publishSuccessTotal ?? 0)} icon={Activity} tone="success" />
        <StatTile
          label="Publish failure"
          value={formatCompactNumber(latest?.publishFailureTotal ?? 0)}
          icon={AlertTriangle}
          tone={latest && latest.publishFailureTotal > 0 ? 'danger' : 'default'}
        />
        <StatTile label="Reconnects" value={formatCompactNumber(latest?.reconnectTotal ?? 0)} icon={RefreshCw} />
        <StatTile
          label="Dropped messages"
          value={formatCompactNumber(latest?.droppedMessages ?? 0)}
          icon={AlertTriangle}
          tone={latest && latest.droppedMessages > 0 ? 'warning' : 'default'}
        />
        <StatTile label="MQTT throughput" value={`${formatBytes(latest?.bytesPerSecond ?? 0)}/s`} icon={Database} />
        <StatTile label="CPU usage" value={formatPercent(latest?.cpuUsagePercent ?? 0)} icon={Cpu} />
        <StatTile
          label="RAM usage"
          value={`${latest?.memoryUsedMb ?? 0} / ${latest?.memoryTotalMb ?? 0} MB`}
          icon={MemoryStick}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card.Root className="p-4">
          <Card.Header className="p-0 pb-2">
            <Card.Title className="text-sm font-medium text-muted">Connected devices</Card.Title>
          </Card.Header>
          <Card.Content className="p-0">
            <TimeSeriesChart
              data={chartData}
              series={[{ key: 'connected', label: 'Connected', color: 'var(--color-accent)' }]}
            />
          </Card.Content>
        </Card.Root>
        <Card.Root className="p-4">
          <Card.Header className="p-0 pb-2">
            <Card.Title className="text-sm font-medium text-muted">Messages / sec</Card.Title>
          </Card.Header>
          <Card.Content className="p-0">
            <TimeSeriesChart
              data={chartData}
              series={[{ key: 'messagesPerSecond', label: 'Messages/sec', color: 'var(--color-accent)' }]}
              valueFormatter={(v) => v.toFixed(0)}
            />
          </Card.Content>
        </Card.Root>
        <Card.Root className="p-4">
          <Card.Header className="p-0 pb-2">
            <Card.Title className="text-sm font-medium text-muted">Average latency (ms)</Card.Title>
          </Card.Header>
          <Card.Content className="p-0">
            <TimeSeriesChart
              data={chartData}
              series={[{ key: 'avgLatencyMs', label: 'Latency', color: 'var(--color-accent)' }]}
              valueFormatter={(v) => v.toFixed(0)}
            />
          </Card.Content>
        </Card.Root>
      </div>

      <Card.Root className="p-4">
        <Card.Header className="p-0 pb-2">
          <Card.Title className="text-sm font-medium text-muted">Worker status</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-wrap gap-2 p-0">
          {(latest?.workerStatus ?? []).map((w) => (
            <div
              key={w.workerId}
              className={`rounded-md border px-3 py-2 text-sm ${
                w.alive ? 'border-border' : 'border-danger/40 bg-danger-soft'
              }`}
            >
              <div className="font-medium">Worker {w.workerId}</div>
              <div className="text-muted">
                {w.deviceCount} devices · {w.alive ? 'alive' : 'stopped'}
              </div>
            </div>
          ))}
          {!latest?.workerStatus.length ? <span className="text-muted">No worker data yet.</span> : null}
        </Card.Content>
      </Card.Root>
    </div>
  );
}
