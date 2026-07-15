import { loadPayloadTemplate } from './payloadTemplate';
import { getPath, setPath } from '../utils/objectPath';
import { randomFloat, rollProbability } from '../utils/random';
import type { TelemetryPayload } from '../models/telemetry';

/**
 * Applies the ranges/jitter and failure-probability rules from
 * payload-template.json's "randomization" block onto a cloned payload
 * in-place. Fields not covered by a rule are left untouched (they're either
 * static template values or already set by the device behavior engine).
 */
export function applyRandomization(payload: TelemetryPayload): void {
  const { randomization } = loadPayloadTemplate();

  for (const [dotPath, range] of Object.entries(randomization.ranges)) {
    const current = getPath(payload, dotPath);
    const base = typeof current === 'number' ? current : (range.min + range.max) / 2;
    const jitter = range.jitter ?? (range.max - range.min) * 0.05;
    const next = clamp(base + randomFloat(-jitter, jitter), range.min, range.max);
    setPath(payload, dotPath, roundTo(next, 4));
  }

  for (const [dotPath, probability] of Object.entries(randomization.failureProbabilities)) {
    if (rollProbability(probability)) {
      setPath(payload, dotPath, 1);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
