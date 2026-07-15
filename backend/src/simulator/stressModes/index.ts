import type { SimulationMode, StressModeStrategy } from '../../models/stressMode';
import { randomFloat } from '../../utils/random';

class ConstantStrategy implements StressModeStrategy {
  readonly mode: SimulationMode = 'constant';
  nextIntervalMs(baseIntervalMs: number): number {
    return baseIntervalMs;
  }
}

/** Linearly reduces the interval (raises rate) from 3x base down to base over rampUpTimeMs. */
class RampUpStrategy implements StressModeStrategy {
  readonly mode: SimulationMode = 'ramp-up';
  constructor(private readonly rampUpTimeMs: number) {}
  nextIntervalMs(baseIntervalMs: number, elapsedMs: number): number {
    if (this.rampUpTimeMs <= 0) return baseIntervalMs;
    const progress = Math.min(1, elapsedMs / this.rampUpTimeMs);
    const factor = 3 - 2 * progress;
    return Math.round(baseIntervalMs * factor);
  }
}

/** Linearly increases the interval (lowers rate) from base up to 3x base over rampDownTimeMs. */
class RampDownStrategy implements StressModeStrategy {
  readonly mode: SimulationMode = 'ramp-down';
  constructor(private readonly rampDownTimeMs: number) {}
  nextIntervalMs(baseIntervalMs: number, elapsedMs: number): number {
    if (this.rampDownTimeMs <= 0) return baseIntervalMs;
    const progress = Math.min(1, elapsedMs / this.rampDownTimeMs);
    const factor = 1 + 2 * progress;
    return Math.round(baseIntervalMs * factor);
  }
}

/** Jitters the interval +/-50% around the base each tick. */
class RandomIntervalStrategy implements StressModeStrategy {
  readonly mode: SimulationMode = 'random-interval';
  nextIntervalMs(baseIntervalMs: number): number {
    return Math.max(50, Math.round(randomFloat(baseIntervalMs * 0.5, baseIntervalMs * 1.5)));
  }
}

/**
 * Constant base rate, except every `spikeIntervalMs` a `spikeDurationMs` window
 * drops the interval to base/factor -- a periodic short-lived traffic spike.
 * Pure function of elapsedMs, so every device in the fleet spikes together
 * (a synchronized fleet-wide spike is the point of a load-test spike mode).
 */
class SpikeStrategy implements StressModeStrategy {
  readonly mode: SimulationMode = 'spike';
  constructor(
    private readonly spikeIntervalMs: number,
    private readonly spikeDurationMs: number,
    private readonly spikeFactor: number,
  ) {}
  nextIntervalMs(baseIntervalMs: number, elapsedMs: number): number {
    if (this.spikeIntervalMs <= 0) return baseIntervalMs;
    const phase = elapsedMs % this.spikeIntervalMs;
    const inSpike = phase < this.spikeDurationMs;
    return inSpike ? Math.max(10, Math.round(baseIntervalMs / this.spikeFactor)) : baseIntervalMs;
  }
}

/**
 * Fires `burstSize` messages in rapid succession, then goes idle for
 * `burstQuietMs`, repeating. Also a pure function of elapsedMs (see Spike),
 * so the whole fleet bursts and quiets in sync.
 */
class BurstStrategy implements StressModeStrategy {
  readonly mode: SimulationMode = 'burst';
  private static readonly BURST_TICK_MS = 50;

  constructor(
    private readonly burstSize: number,
    private readonly burstQuietMs: number,
  ) {}

  nextIntervalMs(_baseIntervalMs: number, elapsedMs: number): number {
    const size = Math.max(1, this.burstSize);
    const burstPhaseLength = BurstStrategy.BURST_TICK_MS * size;
    const cycleLength = burstPhaseLength + Math.max(0, this.burstQuietMs);
    const phase = elapsedMs % cycleLength;
    if (phase < burstPhaseLength) return BurstStrategy.BURST_TICK_MS;
    return Math.max(50, cycleLength - phase);
  }
}

/** Publishes `rateMultiplier` times faster while `isActiveHour(now)` is true, base rate otherwise. */
class HourWindowStrategy implements StressModeStrategy {
  constructor(
    readonly mode: SimulationMode,
    private readonly isActiveHour: (hour: number) => boolean,
    private readonly rateMultiplier: number,
  ) {}
  nextIntervalMs(baseIntervalMs: number): number {
    const hour = new Date().getHours();
    if (this.isActiveHour(hour) && this.rateMultiplier > 0) {
      return Math.max(10, Math.round(baseIntervalMs / this.rateMultiplier));
    }
    return baseIntervalMs;
  }
}

/**
 * Combines the peak-hour and night windows into one full day/night rate
 * curve: peak-hour multiplier during [peakHourStart, peakHourEnd), night
 * multiplier during 18:00-06:00, base rate otherwise. The two windows don't
 * overlap for the default config (9-17 vs 18-06), but if a caller configures
 * them to overlap, peak-hour takes precedence.
 */
class ScheduledStrategy implements StressModeStrategy {
  readonly mode: SimulationMode = 'scheduled';
  constructor(
    private readonly isPeakHour: (hour: number) => boolean,
    private readonly peakHourRateMultiplier: number,
    private readonly nightRateMultiplier: number,
  ) {}
  nextIntervalMs(baseIntervalMs: number): number {
    const hour = new Date().getHours();
    const multiplier = this.isPeakHour(hour)
      ? this.peakHourRateMultiplier
      : isNightHour(hour)
        ? this.nightRateMultiplier
        : 1;
    return multiplier > 0 ? Math.max(10, Math.round(baseIntervalMs / multiplier)) : baseIntervalMs;
  }
}

/** Wildly randomizes the interval each tick between base*min and base*max (wider than random-interval). */
class ChaosStrategy implements StressModeStrategy {
  readonly mode: SimulationMode = 'chaos';
  constructor(
    private readonly minFactor: number,
    private readonly maxFactor: number,
  ) {}
  nextIntervalMs(baseIntervalMs: number): number {
    return Math.max(10, Math.round(randomFloat(baseIntervalMs * this.minFactor, baseIntervalMs * this.maxFactor)));
  }
}

function isNightHour(hour: number): boolean {
  return hour < 6 || hour >= 18;
}

export interface StressModeOptions {
  rampUpTimeMs: number;
  rampDownTimeMs: number;
  spikeIntervalMs: number;
  spikeDurationMs: number;
  spikeFactor: number;
  burstSize: number;
  burstQuietMs: number;
  peakHourStart: number;
  peakHourEnd: number;
  peakHourRateMultiplier: number;
  nightRateMultiplier: number;
  chaosMinFactor: number;
  chaosMaxFactor: number;
}

export function createStressModeStrategy(
  mode: SimulationMode,
  opts: StressModeOptions,
): StressModeStrategy {
  const isPeakHour = (hour: number): boolean => hour >= opts.peakHourStart && hour < opts.peakHourEnd;

  switch (mode) {
    case 'constant':
      return new ConstantStrategy();
    case 'ramp-up':
      return new RampUpStrategy(opts.rampUpTimeMs);
    case 'ramp-down':
      return new RampDownStrategy(opts.rampDownTimeMs);
    case 'random-interval':
      return new RandomIntervalStrategy();
    case 'spike':
      return new SpikeStrategy(opts.spikeIntervalMs, opts.spikeDurationMs, opts.spikeFactor);
    case 'burst':
      return new BurstStrategy(opts.burstSize, opts.burstQuietMs);
    case 'peak-hour':
      return new HourWindowStrategy('peak-hour', isPeakHour, opts.peakHourRateMultiplier);
    case 'night':
      return new HourWindowStrategy('night', isNightHour, opts.nightRateMultiplier);
    case 'scheduled':
      return new ScheduledStrategy(isPeakHour, opts.peakHourRateMultiplier, opts.nightRateMultiplier);
    case 'chaos':
      return new ChaosStrategy(opts.chaosMinFactor, opts.chaosMaxFactor);
    default:
      return new ConstantStrategy();
  }
}
