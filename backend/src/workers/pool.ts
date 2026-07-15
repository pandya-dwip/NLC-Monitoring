import { config } from '../config';
import { workerPool } from './workerPool';
import { processPool } from './processPool';
import type { BaseExecutionPool } from './executionPoolBase';

/** The active execution pool, selected once at startup by CLUSTER_MODE. */
export const pool: BaseExecutionPool = config.cluster.enabled ? processPool : workerPool;
