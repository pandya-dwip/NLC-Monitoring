import { Router } from 'express';
import { fleetStore } from '../../workers/fleetStore';

export const commandsRouter = Router();

commandsRouter.get('/api/commands', (req, res) => {
  const limit = Math.min(1000, Math.max(1, Number(req.query['limit']) || 100));
  res.json({ items: fleetStore.getCommands(limit) });
});
