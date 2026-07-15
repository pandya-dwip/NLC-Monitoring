import path from 'node:path';
import { BaseExecutionPool } from './executionPoolBase';
import { spawnThreadUnit } from './poolUnit';

const isTsSource = __filename.endsWith('.ts');
const WORKER_FILE = path.join(__dirname, isTsSource ? 'deviceWorker.ts' : 'deviceWorker.js');
const EXEC_ARGV = isTsSource ? ['--require', 'tsx/cjs'] : [];

/** Default execution mode: one worker_thread per device shard (real OS-thread parallelism, single process). */
export const workerPool = new BaseExecutionPool('worker_threads', () =>
  spawnThreadUnit(WORKER_FILE, EXEC_ARGV),
);
