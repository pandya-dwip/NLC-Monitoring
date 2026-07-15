import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import dayjs from 'dayjs';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

interface TimeSeriesChartProps {
  data: Array<Record<string, number> & { timestamp: number }>;
  series: ChartSeries[];
  height?: number;
  valueFormatter?: (value: number) => string;
}

/**
 * One reusable line chart for every metrics-over-time panel. Single axis
 * only (per dataviz non-negotiable) -- callers with two differently-scaled
 * metrics get two TimeSeriesCharts, never a dual-axis chart.
 *
 * Recharts v3 moved Tooltip's `content` render-prop to a context-based API
 * (payload/label are no longer passed as props), so styling here goes
 * through the still-stable prop-based Tooltip customization surface
 * (contentStyle/labelFormatter/formatter/itemStyle) instead of a custom
 * content component.
 */
export function TimeSeriesChart({ data, series, height = 220, valueFormatter }: TimeSeriesChartProps) {
  const formatValue = valueFormatter ?? ((v: number) => v.toLocaleString());
  const seriesByKey = new Map(series.map((s) => [s.key, s]));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-separator)" vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(ts: number) => dayjs(ts).format('HH:mm:ss')}
          stroke="var(--color-muted)"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-separator)' }}
          minTickGap={40}
        />
        <YAxis
          stroke="var(--color-muted)"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={formatValue}
        />
        <Tooltip
          cursor={{ stroke: 'var(--color-muted)', strokeWidth: 1 }}
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: 13,
          }}
          labelStyle={{ color: 'var(--color-muted)', fontSize: 11, marginBottom: 4 }}
          itemStyle={{ padding: 0 }}
          labelFormatter={(label) => dayjs(Number(label)).format('HH:mm:ss')}
          formatter={(value, name, item) => {
            const seriesDef = seriesByKey.get(String(item?.dataKey));
            return [formatValue(Number(value)), seriesDef?.label ?? String(name)];
          }}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
