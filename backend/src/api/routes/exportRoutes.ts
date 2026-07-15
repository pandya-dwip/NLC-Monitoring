import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { config, paths } from '../../config';
import { fleetStore } from '../../workers/fleetStore';
import { toCsv } from '../../utils/csv';

export const exportRouter = Router();

const LOG_CATEGORIES = ['mqtt', 'commands', 'errors', 'system', 'performance'] as const;

exportRouter.get('/api/export/csv', (_req, res) => {
  if (!config.export.csv) {
    res.status(403).json({ error: 'CSV export disabled (CSV_EXPORT=false)' });
    return;
  }
  const rows = fleetStore.getDevices().map((d) => ({ ...d }));
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="devices-${Date.now()}.csv"`);
  res.send(csv);
});

exportRouter.get('/api/export/json', (_req, res) => {
  if (!config.export.json) {
    res.status(403).json({ error: 'JSON export disabled (JSON_EXPORT=false)' });
    return;
  }
  const snapshot = {
    exportedAt: Date.now(),
    metrics: fleetStore.buildMetricsSnapshot(),
    devices: fleetStore.getDevices(),
    recentMqttMessages: fleetStore.getMqttEvents(500),
    recentCommands: fleetStore.getCommands(200),
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="snapshot-${Date.now()}.json"`);
  res.json(snapshot);
});

exportRouter.get('/api/export/metrics', (_req, res) => {
  if (!config.export.json) {
    res.status(403).json({ error: 'Metrics export disabled (JSON_EXPORT=false)' });
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="metrics-${Date.now()}.json"`);
  res.json(fleetStore.buildMetricsSnapshot());
});

exportRouter.get('/api/export/logs', (_req, res) => {
  if (!config.features.enableLogging) {
    res.status(403).json({ error: 'Logging disabled (ENABLE_LOGGING=false), nothing to export' });
    return;
  }
  const sections = LOG_CATEGORIES.map((category) => {
    const filePath = path.join(paths.logsDir, `${category}.log`);
    const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '(no entries)\n';
    return `===== ${category}.log =====\n${content}`;
  });
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="logs-${Date.now()}.txt"`);
  res.send(sections.join('\n'));
});
