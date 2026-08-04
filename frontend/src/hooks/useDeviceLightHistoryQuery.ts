import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { LightHistoryEntry } from '../types/device';

/**
 * Per-device publish history (timestamp + light state/dim level), one entry per actual
 * publish -- unlike the shared fleet-wide MQTT/command ring buffers, this is scoped to a
 * single device server-side (FleetStore.getLightHistory), so it stays meaningful even with
 * hundreds of devices. Only fetched for whichever device is currently selected.
 */
export function useDeviceLightHistoryQuery(clientId: string | null) {
  return useQuery({
    queryKey: ['device-light-history', clientId],
    queryFn: () => apiGet<{ items: LightHistoryEntry[] }>(`/api/devices/${clientId}/history`),
    enabled: clientId !== null,
    refetchInterval: clientId !== null ? 5000 : false,
  });
}
