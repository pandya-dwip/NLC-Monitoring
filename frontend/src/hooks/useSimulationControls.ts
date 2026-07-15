import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../lib/api';

interface SimulationStatusResponse {
  running: boolean;
  paused?: boolean;
}

export function useSimulationControls() {
  const start = useMutation({
    mutationFn: () => apiPost<SimulationStatusResponse>('/api/simulation/start'),
  });
  const stop = useMutation({
    mutationFn: () => apiPost<SimulationStatusResponse>('/api/simulation/stop'),
  });
  const pause = useMutation({
    mutationFn: () => apiPost<SimulationStatusResponse>('/api/simulation/pause'),
  });
  const resume = useMutation({
    mutationFn: () => apiPost<SimulationStatusResponse>('/api/simulation/resume'),
  });
  const scale = useMutation({
    mutationFn: () => apiPost<SimulationStatusResponse>('/api/simulation/scale'),
  });

  return { start, stop, pause, resume, scale };
}
