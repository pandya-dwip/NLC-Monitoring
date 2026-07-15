import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const boolFromString = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : v.trim().toLowerCase() === 'true'));

const numFromString = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number(v)))
    .pipe(z.number().finite());

const envSchema = z.object({
  MQTT_HOST: z.string().min(1).default('localhost'),
  MQTT_PORT: numFromString(1883),
  MQTT_PROTOCOL: z.enum(['mqtt', 'mqtts', 'ws', 'wss']).default('mqtt'),
  MQTT_USERNAME: z.string().optional().default(''),
  MQTT_PASSWORD: z.string().optional().default(''),
  MQTT_TOPIC: z.string().min(1).default('v1/devices/me/telemetry'),
  MQTT_QOS: numFromString(1),
  MQTT_RETAIN: boolFromString(false),
  // Comma-separated list of extra topics to subscribe to, beyond the standard
  // ThingsBoard RPC/attribute topics (e.g. "v1/devices/me/attributes/response/+,custom/topic").
  MQTT_EXTRA_SUBSCRIBE_TOPICS: z.string().optional().default(''),

  DEVICE_LIMIT: numFromString(0),
  DEVICE_SELECTION_MODE: z
    .enum(['sequential', 'random', 'shuffle', 'round-robin', 'random-batch'])
    .default('sequential'),
  DEVICE_BATCH_SIZE: numFromString(1),
  ENABLE_RANDOMIZATION: boolFromString(true),

  PUBLISH_INTERVAL_MS: numFromString(5000),
  PAYLOAD_MODE: z.enum(['template', 'random', 'mixed']).default('template'),
  SIMULATION_MODE: z
    .enum([
      'constant',
      'ramp-up',
      'ramp-down',
      'spike',
      'burst',
      'random-interval',
      'scheduled',
      'peak-hour',
      'night',
      'chaos',
    ])
    .default('constant'),
  MAX_MESSAGES_PER_SECOND: numFromString(200),
  START_DELAY: numFromString(0),
  RAMP_UP_TIME: numFromString(0),
  RAMP_DOWN_TIME: numFromString(0),
  HEARTBEAT_INTERVAL: numFromString(30000),

  // 'spike' mode: every SPIKE_INTERVAL_MS, publish SPIKE_FACTOR times faster for SPIKE_DURATION_MS.
  SPIKE_INTERVAL_MS: numFromString(30_000),
  SPIKE_DURATION_MS: numFromString(3_000),
  SPIKE_FACTOR: numFromString(5),
  // 'burst' mode: fire BURST_SIZE messages back-to-back, then go idle for BURST_QUIET_MS.
  BURST_SIZE: numFromString(10),
  BURST_QUIET_MS: numFromString(15_000),
  // 'peak-hour' / 'scheduled' modes: faster publishing within [PEAK_HOUR_START, PEAK_HOUR_END).
  PEAK_HOUR_START: numFromString(9),
  PEAK_HOUR_END: numFromString(17),
  PEAK_HOUR_RATE_MULTIPLIER: numFromString(3),
  // 'night' / 'scheduled' modes: faster publishing during the 18:00-06:00 window (same boundary
  // simulator/deviceBehavior.ts uses for the day/night lighting schedule).
  NIGHT_RATE_MULTIPLIER: numFromString(2),
  // 'chaos' mode: interval randomized each tick between base*MIN and base*MAX.
  CHAOS_MIN_FACTOR: numFromString(0.1),
  CHAOS_MAX_FACTOR: numFromString(5),

  ENABLE_RECONNECT: boolFromString(true),
  ENABLE_RPC: boolFromString(true),
  ENABLE_ATTRIBUTE_UPDATES: boolFromString(true),
  ENABLE_LOGGING: boolFromString(true),
  ENABLE_WEBSOCKET: boolFromString(true),
  ENABLE_UI: boolFromString(true),
  LATENCY_TRACKING: boolFromString(true),

  COMMAND_TIMEOUT: numFromString(10000),
  KEEPALIVE: numFromString(60),
  CLIENT_CLEAN_SESSION: boolFromString(true),
  AUTO_RECONNECT: boolFromString(true),
  RECONNECT_PERIOD: numFromString(2000),

  WORKER_COUNT: numFromString(4),
  // false (default): shard devices across worker_threads (one process, real OS-thread
  // parallelism). true: shard across forked child_processes instead -- OS-level crash
  // isolation and independent process supervision, still single-host (no Redis/multi-host).
  CLUSTER_MODE: boolFromString(false),

  SOCKET_PORT: numFromString(4001),
  API_PORT: numFromString(4000),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  METRICS_INTERVAL: numFromString(2000),
  CSV_EXPORT: boolFromString(true),
  JSON_EXPORT: boolFromString(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:\n', parsed.error.flatten().fieldErrors);
  throw new Error('Configuration validation failed. See errors above.');
}

const env = parsed.data;

export const paths = {
  root: path.resolve(__dirname, '..', '..'),
  devicesFile: path.resolve(__dirname, '..', '..', 'devices.json'),
  payloadTemplateFile: path.resolve(__dirname, '..', '..', 'payload-template.json'),
  logsDir: path.resolve(__dirname, '..', '..', 'logs'),
  exportsDir: path.resolve(__dirname, '..', '..', 'exports'),
};

export const config = {
  mqtt: {
    host: env.MQTT_HOST,
    port: env.MQTT_PORT,
    protocol: env.MQTT_PROTOCOL,
    username: env.MQTT_USERNAME || undefined,
    password: env.MQTT_PASSWORD || undefined,
    topic: env.MQTT_TOPIC,
    qos: env.MQTT_QOS as 0 | 1 | 2,
    retain: env.MQTT_RETAIN,
    extraSubscribeTopics: env.MQTT_EXTRA_SUBSCRIBE_TOPICS.split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    keepalive: env.KEEPALIVE,
    cleanSession: env.CLIENT_CLEAN_SESSION,
    autoReconnect: env.AUTO_RECONNECT,
    reconnectPeriod: env.RECONNECT_PERIOD,
  },
  devices: {
    limit: env.DEVICE_LIMIT,
    selectionMode: env.DEVICE_SELECTION_MODE,
    batchSize: env.DEVICE_BATCH_SIZE,
    enableRandomization: env.ENABLE_RANDOMIZATION,
  },
  simulation: {
    publishIntervalMs: env.PUBLISH_INTERVAL_MS,
    payloadMode: env.PAYLOAD_MODE,
    mode: env.SIMULATION_MODE,
    maxMessagesPerSecond: env.MAX_MESSAGES_PER_SECOND,
    startDelay: env.START_DELAY,
    rampUpTime: env.RAMP_UP_TIME,
    rampDownTime: env.RAMP_DOWN_TIME,
    heartbeatInterval: env.HEARTBEAT_INTERVAL,
    spikeIntervalMs: env.SPIKE_INTERVAL_MS,
    spikeDurationMs: env.SPIKE_DURATION_MS,
    spikeFactor: env.SPIKE_FACTOR,
    burstSize: env.BURST_SIZE,
    burstQuietMs: env.BURST_QUIET_MS,
    peakHourStart: env.PEAK_HOUR_START,
    peakHourEnd: env.PEAK_HOUR_END,
    peakHourRateMultiplier: env.PEAK_HOUR_RATE_MULTIPLIER,
    nightRateMultiplier: env.NIGHT_RATE_MULTIPLIER,
    chaosMinFactor: env.CHAOS_MIN_FACTOR,
    chaosMaxFactor: env.CHAOS_MAX_FACTOR,
  },
  features: {
    enableReconnect: env.ENABLE_RECONNECT,
    enableRpc: env.ENABLE_RPC,
    enableAttributeUpdates: env.ENABLE_ATTRIBUTE_UPDATES,
    enableLogging: env.ENABLE_LOGGING,
    enableWebsocket: env.ENABLE_WEBSOCKET,
    enableUi: env.ENABLE_UI,
    latencyTracking: env.LATENCY_TRACKING,
  },
  mqttClient: {
    commandTimeout: env.COMMAND_TIMEOUT,
  },
  workers: {
    count: Math.max(1, env.WORKER_COUNT),
  },
  cluster: {
    enabled: env.CLUSTER_MODE,
  },
  servers: {
    socketPort: env.SOCKET_PORT,
    apiPort: env.API_PORT,
  },
  logging: {
    level: env.LOG_LEVEL,
  },
  metrics: {
    interval: env.METRICS_INTERVAL,
  },
  export: {
    csv: env.CSV_EXPORT,
    json: env.JSON_EXPORT,
  },
} as const;

export type AppConfig = typeof config;
