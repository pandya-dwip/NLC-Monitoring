export type SimulationMode =
  | 'constant'
  | 'ramp-up'
  | 'ramp-down'
  | 'spike'
  | 'burst'
  | 'random-interval'
  | 'scheduled'
  | 'peak-hour'
  | 'night'
  | 'chaos';

/**
 * Strategy interface: given the base publish interval and elapsed simulation
 * time, decide the actual interval (ms) to wait before the next publish for a
 * device. Implementations may vary interval over time (ramps), inject
 * randomness (chaos/random-interval), or cluster publishes (spike/burst).
 */
export interface StressModeStrategy {
  readonly mode: SimulationMode;
  nextIntervalMs(baseIntervalMs: number, elapsedMs: number): number;
}
