import fs from 'node:fs';
import { paths } from '../config';
import type { PayloadTemplateFile, TelemetryPayload } from '../models/telemetry';

let cached: PayloadTemplateFile | null = null;

export function loadPayloadTemplate(): PayloadTemplateFile {
  if (cached) return cached;
  const raw = fs.readFileSync(paths.payloadTemplateFile, 'utf-8');
  const parsed = JSON.parse(raw) as PayloadTemplateFile;
  if (!parsed.template || typeof parsed.template !== 'object') {
    throw new Error('payload-template.json is missing a "template" object');
  }
  cached = parsed;
  return parsed;
}

/** Deep clone of the raw template (before AUTO_TIMESTAMP resolution or randomization). */
export function cloneTemplate(): TelemetryPayload {
  const { template } = loadPayloadTemplate();
  return structuredClone(template);
}

export function resolveTimestamp(payload: TelemetryPayload, now: number = Date.now()): void {
  if (payload['ts'] === 'AUTO_TIMESTAMP') {
    payload['ts'] = now;
  }
}
