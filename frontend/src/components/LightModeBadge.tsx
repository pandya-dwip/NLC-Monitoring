import { Chip } from '@heroui/react';
import { classifyLightMode, type DeviceState } from '../types/device';

const MODE_COLOR = {
  on: 'success',
  dim: 'warning',
  off: 'default',
} as const;

export function LightModeBadge({ device }: { device: Pick<DeviceState, 'lightState' | 'dimLevel'> }) {
  const mode = classifyLightMode(device);
  const label = mode === 'dim' ? `Dim ${device.dimLevel}%` : mode === 'on' ? 'On' : 'Off';
  return (
    <Chip color={MODE_COLOR[mode]} variant="soft" size="sm">
      {label}
    </Chip>
  );
}
