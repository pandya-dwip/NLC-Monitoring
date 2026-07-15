import { Button, Chip } from '@heroui/react';
import { Pause, Play, RotateCw, Square } from 'lucide-react';
import { useMetricsStore } from '../store/useMetricsStore';
import { useSimulationControls } from '../hooks/useSimulationControls';

export function SimulationControls() {
  const running = useMetricsStore((s) => s.latest?.simulationRunning ?? false);
  const paused = useMetricsStore((s) => s.latest?.simulationPaused ?? false);
  const mode = useMetricsStore((s) => s.latest?.simulationMode ?? '—');
  const { start, stop, pause, resume, scale } = useSimulationControls();

  const handleScale = (): void => {
    if (window.confirm('Rescaling reloads devices.json and restarts the fleet. Continue?')) {
      scale.mutate();
    }
  };

  const statusLabel = !running ? 'Stopped' : paused ? `Paused (${mode})` : `Running (${mode})`;
  const statusColor = !running ? 'default' : paused ? 'warning' : 'success';

  return (
    <div className="flex items-center gap-2">
      <Chip color={statusColor} variant="soft" size="sm">
        {statusLabel}
      </Chip>
      <Button
        variant="primary"
        size="sm"
        isDisabled={running || start.isPending}
        onPress={() => start.mutate()}
      >
        <Play className="h-4 w-4" aria-hidden />
        Start
      </Button>
      <Button
        variant="outline"
        size="sm"
        isDisabled={!running || paused || pause.isPending}
        onPress={() => pause.mutate()}
      >
        <Pause className="h-4 w-4" aria-hidden />
        Pause
      </Button>
      <Button
        variant="outline"
        size="sm"
        isDisabled={!running || !paused || resume.isPending}
        onPress={() => resume.mutate()}
      >
        <Play className="h-4 w-4" aria-hidden />
        Resume
      </Button>
      <Button
        variant="outline"
        size="sm"
        isDisabled={!running || stop.isPending}
        onPress={() => stop.mutate()}
      >
        <Square className="h-4 w-4" aria-hidden />
        Stop
      </Button>
      <Button variant="ghost" size="sm" isDisabled={scale.isPending} onPress={handleScale}>
        <RotateCw className="h-4 w-4" aria-hidden />
        Rescale
      </Button>
    </div>
  );
}
