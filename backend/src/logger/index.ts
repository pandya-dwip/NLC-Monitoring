import fs from 'node:fs';
import path from 'node:path';
import pino, { type Logger } from 'pino';
import { config, paths } from '../config';
import type { LogCategory } from '../models/workerMessages';

if (!fs.existsSync(paths.logsDir)) {
  fs.mkdirSync(paths.logsDir, { recursive: true });
}

const categories: LogCategory[] = ['mqtt', 'commands', 'errors', 'system', 'performance'];

function buildLogger(category: LogCategory): Logger {
  if (!config.features.enableLogging) {
    return pino({ level: 'silent' });
  }
  const destination = pino.destination({
    dest: path.join(paths.logsDir, `${category}.log`),
    sync: false,
  });
  return pino({ level: config.logging.level }, destination);
}

const loggers = new Map<LogCategory, Logger>(categories.map((c) => [c, buildLogger(c)]));

export function getLogger(category: LogCategory): Logger {
  const logger = loggers.get(category);
  if (!logger) {
    throw new Error(`Unknown log category: ${category}`);
  }
  return logger;
}

export const mqttLogger = getLogger('mqtt');
export const commandsLogger = getLogger('commands');
export const errorsLogger = getLogger('errors');
export const systemLogger = getLogger('system');
export const performanceLogger = getLogger('performance');

export function logError(category: LogCategory, message: string, err?: unknown, data?: unknown): void {
  getLogger(category).error({ err, data }, message);
  if (category !== 'errors') {
    errorsLogger.error({ err, data, category }, message);
  }
}
