import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../lib/api';

/**
 * Manual per-device disconnect/reconnect. No cache invalidation needed --
 * the resulting status change arrives via the existing device:status socket
 * push (see useSocketSubscriptions), same as every other live device update.
 */
export function useDeviceConnectionMutation() {
  const disconnect = useMutation({
    mutationFn: (clientId: string) => apiPost<{ ok: boolean }>(`/api/devices/${clientId}/disconnect`),
  });
  const reconnect = useMutation({
    mutationFn: (clientId: string) => apiPost<{ ok: boolean }>(`/api/devices/${clientId}/reconnect`),
  });
  return { disconnect, reconnect };
}
