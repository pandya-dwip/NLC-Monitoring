import type { MetricsSnapshot } from '../types/metrics';

/** Derives a per-second rate series from a cumulative-total field across metrics history samples. */
export function computeRateSeries(
  history: MetricsSnapshot[],
  totalKey: keyof MetricsSnapshot,
): Array<{ timestamp: number; rate: number }> {
  return history.map((snapshot, i) => {
    if (i === 0) return { timestamp: snapshot.timestamp, rate: 0 };
    const prev = history[i - 1]!;
    const elapsedSeconds = (snapshot.timestamp - prev.timestamp) / 1000;
    const delta = Number(snapshot[totalKey]) - Number(prev[totalKey]);
    return {
      timestamp: snapshot.timestamp,
      rate: elapsedSeconds > 0 ? Math.max(0, delta / elapsedSeconds) : 0,
    };
  });
}
