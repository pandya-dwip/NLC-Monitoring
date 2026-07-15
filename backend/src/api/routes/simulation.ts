import { Router } from 'express';
import { pool } from '../../workers/pool';
import { getLogger } from '../../logger';

export const simulationRouter = Router();
const systemLogger = getLogger('system');

simulationRouter.post('/api/simulation/start', (_req, res) => {
  pool.start();
  res.json({ running: pool.isRunning() });
});

simulationRouter.post('/api/simulation/stop', (_req, res) => {
  pool.stop();
  res.json({ running: pool.isRunning() });
});

simulationRouter.post('/api/simulation/pause', (_req, res) => {
  pool.pause();
  res.json({ running: pool.isRunning(), paused: pool.isPaused() });
});

simulationRouter.post('/api/simulation/resume', (_req, res) => {
  pool.resume();
  res.json({ running: pool.isRunning(), paused: pool.isPaused() });
});

simulationRouter.post('/api/simulation/scale', async (_req, res) => {
  try {
    await pool.rescale();
    res.json({ running: pool.isRunning() });
  } catch (err) {
    systemLogger.error({ err }, 'Failed to rescale simulation');
    res.status(500).json({ error: 'Failed to rescale simulation' });
  }
});
