import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { History, PlugZap, Radio, Terminal, Unplug } from 'lucide-react';
import { Button, Card, Input } from '@heroui/react';
import { StatTile } from '../components/StatTile';
import { ConnectionStatusBadge } from '../components/ConnectionStatusBadge';
import { LightModeBadge } from '../components/LightModeBadge';
import { useDeviceList } from '../store/useDeviceStore';
import { useMqttMonitorStore } from '../store/useMqttMonitorStore';
import { useCommandStore } from '../store/useCommandStore';
import { useDeviceLightHistoryQuery } from '../hooks/useDeviceLightHistoryQuery';
import { useDeviceConnectionMutation } from '../hooks/useDeviceConnectionMutation';

const RECENT_LIMIT = 30;

function formatTime(ts: number | null): string {
  return ts ? dayjs(ts).format('HH:mm:ss') : '—';
}

export function DeviceHistoryPage() {
  const devices = useDeviceList();
  const mqttEvents = useMqttMonitorStore((s) => s.events);
  const commands = useCommandStore((s) => s.commands);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { disconnect, reconnect } = useDeviceConnectionMutation();

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) => d.clientId.toLowerCase().includes(q) || d.nlcId.toLowerCase().includes(q));
  }, [devices, search]);

  const selected = useMemo(() => devices.find((d) => d.clientId === selectedId) ?? null, [devices, selectedId]);

  // Real per-device history from the backend (FleetStore.getLightHistory) -- one entry per
  // actual publish for this specific device, unlike the shared fleet-wide buffers below.
  const { data: lightHistoryData, isLoading: lightHistoryLoading } = useDeviceLightHistoryQuery(
    selected?.clientId ?? null,
  );
  const lightHistory = useMemo(() => [...(lightHistoryData?.items ?? [])].reverse(), [lightHistoryData]);

  // These come from the same live-activity ring buffers that feed the MQTT Monitor / Commands
  // pages -- a recent-activity window across the whole fleet, not a persisted per-device log.
  const deviceMessages = useMemo(
    () =>
      selected
        ? mqttEvents
            .filter((e) => e.clientId === selected.clientId)
            .slice(-RECENT_LIMIT)
            .reverse()
        : [],
    [mqttEvents, selected],
  );
  const deviceCommands = useMemo(
    () =>
      selected
        ? commands
            .filter((c) => c.command.clientId === selected.clientId)
            .slice(-RECENT_LIMIT)
            .reverse()
        : [],
    [commands, selected],
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Device History</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <Card.Root className="flex max-h-[80vh] flex-col overflow-hidden p-0">
          <div className="border-b border-border p-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search devices..."
              fullWidth
            />
          </div>
          <div className="thin-scrollbar flex-1 overflow-y-auto">
            {filteredDevices.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted">No devices found.</div>
            ) : (
              filteredDevices.map((d) => (
                <button
                  key={d.clientId}
                  type="button"
                  onClick={() => setSelectedId(d.clientId)}
                  className={`flex w-full items-center justify-between gap-2 border-b border-separator px-3 py-2 text-left text-sm transition-colors hover:bg-surface-secondary ${
                    selectedId === d.clientId ? 'bg-accent-soft' : ''
                  }`}
                >
                  <span className="font-medium">{d.clientId}</span>
                  <LightModeBadge device={d} />
                </button>
              ))
            )}
          </div>
        </Card.Root>

        {!selected ? (
          <Card.Root className="flex items-center justify-center p-12">
            <span className="text-muted">Select a device from the list to see its details.</span>
          </Card.Root>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-base font-semibold">{selected.clientId}</h3>
              <ConnectionStatusBadge status={selected.status} />
              {selected.manuallyDisconnected ? (
                <span className="text-sm text-muted">(manually disconnected)</span>
              ) : null}
              <LightModeBadge device={selected} />
              {selected.manualLightOverride ? (
                <span className="text-sm text-muted">
                  Override until {dayjs(selected.manualLightOverride.expiresAt).format('HH:mm:ss')}
                </span>
              ) : null}
              <div className="ml-auto flex gap-2">
                {selected.manuallyDisconnected ? (
                  <Button
                    size="sm"
                    variant="outline"
                    isDisabled={reconnect.isPending}
                    onPress={() => reconnect.mutate(selected.clientId)}
                  >
                    <PlugZap className="h-4 w-4" aria-hidden />
                    Reconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    isDisabled={disconnect.isPending || selected.status !== 'connected'}
                    onPress={() => disconnect.mutate(selected.clientId)}
                  >
                    <Unplug className="h-4 w-4" aria-hidden />
                    Disconnect
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <StatTile label="Voltage" value={`${selected.voltageBaseline.toFixed(1)} V`} />
              <StatTile label="Current" value={`${selected.lastCurrentAmps.toFixed(3)} A`} />
              <StatTile label="Power" value={`${selected.lastActivePowerW.toFixed(1)} W`} />
              <StatTile label="Rated Wattage" value={`${selected.ratedWattage} W`} />
              <StatTile label="Daily kWh" value={selected.dailyKwh.toFixed(3)} />
              <StatTile label="Cumulative kWh" value={selected.cumKwh.toFixed(2)} />
              <StatTile label="Operating Hours" value={selected.operatingHours.toFixed(1)} />
              <StatTile
                label="Latency"
                value={selected.lastLatencyMs !== null ? `${selected.lastLatencyMs} ms` : '—'}
              />
              <StatTile label="Reconnects" value={String(selected.reconnectCount)} />
              <StatTile label="Msgs Sent" value={String(selected.messagesSent)} />
              <StatTile label="Msgs Received" value={String(selected.messagesReceived)} />
              <StatTile
                label="Publish Failures"
                value={String(selected.publishFailures)}
                tone={selected.publishFailures > 0 ? 'warning' : 'default'}
              />
              <StatTile
                label="Errors"
                value={String(selected.errors)}
                tone={selected.errors > 0 ? 'danger' : 'default'}
              />
              <StatTile label="Firmware" value={selected.swVersion} />
              <StatTile label="Last Publish" value={formatTime(selected.lastPublishAt)} />
              <StatTile label="Last Command" value={formatTime(selected.lastCommandAt)} />
            </div>

            <Card.Root className="p-4">
              <Card.Header className="p-0 pb-2">
                <Card.Title className="flex items-center gap-2 text-sm font-medium text-muted">
                  <History className="h-4 w-4" aria-hidden /> Light State History
                </Card.Title>
              </Card.Header>
              <Card.Content className="p-0">
                {lightHistoryLoading ? (
                  <p className="text-sm text-muted">Loading...</p>
                ) : lightHistory.length === 0 ? (
                  <p className="text-sm text-muted">
                    No publishes recorded for this device yet -- history is captured going forward
                    from when the backend started (not backfilled from before it was running).
                  </p>
                ) : (
                  <div className="thin-scrollbar max-h-64 overflow-y-auto rounded-md border border-border">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-surface-secondary text-left">
                        <tr>
                          <th className="px-2 py-1 font-medium text-muted">Time</th>
                          <th className="px-2 py-1 font-medium text-muted">Light State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lightHistory.map((h, i) => (
                          <tr key={i} className="border-t border-separator">
                            <td className="px-2 py-1 tabular-nums">{dayjs(h.ts).format('HH:mm:ss')}</td>
                            <td className="px-2 py-1">
                              <LightModeBadge device={h} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card.Content>
            </Card.Root>

            <Card.Root className="p-4">
              <Card.Header className="p-0 pb-2">
                <Card.Title className="flex items-center gap-2 text-sm font-medium text-muted">
                  <Radio className="h-4 w-4" aria-hidden /> Recent MQTT Activity
                </Card.Title>
              </Card.Header>
              <Card.Content className="p-0">
                {deviceMessages.length === 0 ? (
                  <p className="text-sm text-muted">
                    No recent MQTT activity captured for this device (recent-activity window across the
                    fleet, not a full log -- try again shortly after its next publish).
                  </p>
                ) : (
                  <div className="thin-scrollbar max-h-64 overflow-y-auto rounded-md border border-border">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-surface-secondary text-left">
                        <tr>
                          <th className="px-2 py-1 font-medium text-muted">Time</th>
                          <th className="px-2 py-1 font-medium text-muted">Direction</th>
                          <th className="px-2 py-1 font-medium text-muted">Topic</th>
                          <th className="px-2 py-1 font-medium text-muted">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deviceMessages.map((m, i) => (
                          <tr key={i} className="border-t border-separator">
                            <td className="px-2 py-1 tabular-nums">{dayjs(m.timestamp).format('HH:mm:ss')}</td>
                            <td className="px-2 py-1">{m.direction}</td>
                            <td className="px-2 py-1 font-mono text-xs">{m.topic}</td>
                            <td className="px-2 py-1">{m.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card.Content>
            </Card.Root>

            <Card.Root className="p-4">
              <Card.Header className="p-0 pb-2">
                <Card.Title className="flex items-center gap-2 text-sm font-medium text-muted">
                  <Terminal className="h-4 w-4" aria-hidden /> Recent Commands
                </Card.Title>
              </Card.Header>
              <Card.Content className="p-0">
                {deviceCommands.length === 0 ? (
                  <p className="text-sm text-muted">No commands sent to this device yet.</p>
                ) : (
                  <div className="thin-scrollbar max-h-64 overflow-y-auto rounded-md border border-border">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-surface-secondary text-left">
                        <tr>
                          <th className="px-2 py-1 font-medium text-muted">Time</th>
                          <th className="px-2 py-1 font-medium text-muted">Kind</th>
                          <th className="px-2 py-1 font-medium text-muted">Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deviceCommands.map((c) => (
                          <tr key={c.command.id} className="border-t border-separator">
                            <td className="px-2 py-1 tabular-nums">
                              {dayjs(c.command.receivedAt).format('HH:mm:ss')}
                            </td>
                            <td className="px-2 py-1">{c.command.kind}</td>
                            <td className="px-2 py-1">{c.command.method ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card.Content>
            </Card.Root>
          </div>
        )}
      </div>
    </div>
  );
}
