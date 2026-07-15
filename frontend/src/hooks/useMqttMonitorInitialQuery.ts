import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { useMqttMonitorStore } from '../store/useMqttMonitorStore';
import type { MqttMessageEvent } from '../types/mqtt';

export function useMqttMonitorInitialQuery(): void {
  const hydrate = useMqttMonitorStore((s) => s.hydrate);
  const { data } = useQuery({
    queryKey: ['mqtt-monitor-initial'],
    queryFn: () => apiGet<{ items: MqttMessageEvent[] }>('/api/mqtt/messages?limit=500'),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data) hydrate(data.items);
  }, [data, hydrate]);
}
