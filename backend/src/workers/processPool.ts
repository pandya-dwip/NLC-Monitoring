import path from 'node:path';
import { BaseExecutionPool } from './executionPoolBase';
import { spawnProcessUnit } from './poolUnit';

const isTsSource = __filename.endsWith('.ts');
const PROCESS_FILE = path.join(__dirname, isTsSource ? 'deviceProcess.ts' : 'deviceProcess.js');
const EXEC_ARGV = isTsSource ? ['--require', 'tsx/cjs'] : [];

/**
 * CLUSTER_MODE=true execution: one forked OS process per device shard
 * instead of a worker_thread. Buys OS-level crash isolation and independent
 * process supervision (e.g. PM2) -- not raw scale-out, since it's still one
 * host and worker_threads already gives real OS-thread parallelism.
 */
export const processPool = new BaseExecutionPool('child_process', () =>
  spawnProcessUnit(PROCESS_FILE, EXEC_ARGV),
);
