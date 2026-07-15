import { Card } from '@heroui/react';
import type { LucideIcon } from 'lucide-react';

interface StatTileProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

const TONE_ICON_CLASSES: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

/** KPI stat tile: label (sentence case) + value (proportional figures, semibold). */
export function StatTile({ label, value, icon: Icon, tone = 'default' }: StatTileProps) {
  return (
    <Card.Root className="p-4">
      <Card.Content className="flex items-start justify-between gap-3 p-0">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted">{label}</span>
          <span className="text-2xl font-semibold text-foreground">{value}</span>
        </div>
        {Icon ? <Icon className={`h-5 w-5 shrink-0 ${TONE_ICON_CLASSES[tone]}`} aria-hidden /> : null}
      </Card.Content>
    </Card.Root>
  );
}
