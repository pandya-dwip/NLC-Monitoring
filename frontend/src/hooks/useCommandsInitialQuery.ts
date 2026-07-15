import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { useCommandStore } from '../store/useCommandStore';
import type { CommandReceivedEvent } from '../types/command';

export function useCommandsInitialQuery(): void {
  const hydrate = useCommandStore((s) => s.hydrate);
  const { data } = useQuery({
    queryKey: ['commands-initial'],
    queryFn: () => apiGet<{ items: CommandReceivedEvent[] }>('/api/commands?limit=200'),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data) hydrate(data.items);
  }, [data, hydrate]);
}
