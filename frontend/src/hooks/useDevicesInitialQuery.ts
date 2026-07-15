import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { useDeviceStore } from '../store/useDeviceStore';
import type { DeviceState } from '../types/device';

interface DevicesResponse {
  items: DeviceState[];
  total: number;
  page: number;
  pageSize: number;
}

/** Hydrates the device store before/independent of the socket's own initial snapshot. */
export function useDevicesInitialQuery(): void {
  const setAll = useDeviceStore((s) => s.setAll);
  const { data } = useQuery({
    queryKey: ['devices-initial'],
    queryFn: () => apiGet<DevicesResponse>('/api/devices?pageSize=1000'),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data) setAll(data.items);
  }, [data, setAll]);
}
