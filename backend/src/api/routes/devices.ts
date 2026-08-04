import { Router } from 'express';
import { fleetStore } from '../../workers/fleetStore';

export const devicesRouter = Router();

devicesRouter.get('/api/devices', (req, res) => {
  const page = Math.max(1, Number(req.query['page']) || 1);
  const pageSize = Math.min(1000, Math.max(1, Number(req.query['pageSize']) || 50));
  const search = String(req.query['search'] ?? '').toLowerCase();
  const statusFilter = String(req.query['status'] ?? '').toLowerCase();

  let devices = fleetStore.getDevices();

  if (search) {
    devices = devices.filter(
      (d) => d.clientId.toLowerCase().includes(search) || d.nlcId.toLowerCase().includes(search),
    );
  }
  if (statusFilter) {
    devices = devices.filter((d) => d.status.toLowerCase() === statusFilter);
  }

  const total = devices.length;
  const start = (page - 1) * pageSize;
  const items = devices.slice(start, start + pageSize);

  res.json({ items, total, page, pageSize });
});

devicesRouter.get('/api/devices/:clientId/history', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query['limit']) || 200));
  res.json({ items: fleetStore.getLightHistory(req.params['clientId']!, limit) });
});
