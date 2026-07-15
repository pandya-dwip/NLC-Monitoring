import { Router } from 'express';
import { fleetStore } from '../../workers/fleetStore';

export const metricsRouter = Router();

metricsRouter.get('/api/metrics/snapshot', (_req, res) => {
  res.json(fleetStore.buildMetricsSnapshot());
});
