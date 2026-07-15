import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { useMetricsStore } from '../store/useMetricsStore';
import type { MetricsSnapshot } from '../types/metrics';

/** Paints the KPI tiles before the socket handshake completes / first snapshot arrives. */
export function useMetricsInitialQuery(): void {
  const latest = useMetricsStore((s) => s.latest);
  const setSnapshot = useMetricsStore((s) => s.setSnapshot);
  const { data } = useQuery({
    queryKey: ['metrics-initial'],
    queryFn: () => apiGet<MetricsSnapshot>('/api/metrics/snapshot'),
    staleTime: Infinity,
    enabled: latest === null,
  });

  useEffect(() => {
    if (data && latest === null) setSnapshot(data);
  }, [data, latest, setSnapshot]);
}
