import { Router } from 'express';
import { fleetStore } from '../../workers/fleetStore';

export const mqttMonitorRouter = Router();

mqttMonitorRouter.get('/api/mqtt/messages', (req, res) => {
  const limit = Math.min(2000, Math.max(1, Number(req.query['limit']) || 200));
  res.json({ items: fleetStore.getMqttEvents(limit) });
});
