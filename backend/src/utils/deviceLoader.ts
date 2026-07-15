import fs from 'node:fs';
import { config, paths } from '../config';
import type { DeviceCredentials } from '../models/device';
import { chunk, shuffle } from './random';

/**
 * Loads devices.json, applies the configured selection strategy, then caps
 * to DEVICE_LIMIT. Supports loading any number of devices (10 to 50,000+)
 * without code changes -- scale is controlled entirely via .env.
 */
export function loadDeviceCredentials(): DeviceCredentials[] {
  const raw = fs.readFileSync(paths.devicesFile, 'utf-8');
  const all = JSON.parse(raw) as DeviceCredentials[];
  if (!Array.isArray(all)) {
    throw new Error('devices.json must be a JSON array of {clientId, userName, password}');
  }

  const selected = selectDevices(all, config.devices.selectionMode);
  return config.devices.limit > 0 ? selected.slice(0, config.devices.limit) : selected;
}

function selectDevices(
  all: DeviceCredentials[],
  mode: (typeof config.devices)['selectionMode'],
): DeviceCredentials[] {
  switch (mode) {
    case 'random':
    case 'shuffle':
      return shuffle(all);
    case 'random-batch': {
      const batches = chunk(all, Math.max(1, config.devices.batchSize));
      return shuffle(batches).flat();
    }
    // 'round-robin' and 'sequential' both preserve devices.json order here --
    // round-robin distribution instead happens when sharding devices across
    // worker threads (see shardDevices below).
    case 'round-robin':
    case 'sequential':
    default:
      return all;
  }
}

/** Distributes devices across worker threads round-robin, for even load per worker. */
export function shardDevices(
  devices: DeviceCredentials[],
  workerCount: number,
): DeviceCredentials[][] {
  const shards: DeviceCredentials[][] = Array.from({ length: workerCount }, () => []);
  devices.forEach((device, i) => {
    shards[i % workerCount]!.push(device);
  });
  return shards;
}
