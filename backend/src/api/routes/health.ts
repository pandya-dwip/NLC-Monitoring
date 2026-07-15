import { Router } from 'express';
import { pool } from '../../workers/pool';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    simulationRunning: pool.isRunning(),
    simulationPaused: pool.isPaused(),
    timestamp: Date.now(),
  });
});
