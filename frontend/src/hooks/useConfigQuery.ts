import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { AppConfigResponse } from '../types/config';

export function useConfigQuery() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => apiGet<AppConfigResponse>('/api/config'),
    staleTime: 60_000,
  });
}
