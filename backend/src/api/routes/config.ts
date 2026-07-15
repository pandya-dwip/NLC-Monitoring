import { Router } from 'express';
import { config } from '../../config';

export const configRouter = Router();

configRouter.get('/api/config', (_req, res) => {
  // Redact credentials; everything else is safe to expose to the dashboard.
  const { mqtt, ...rest } = config;
  const safeMqtt = {
    host: mqtt.host,
    port: mqtt.port,
    protocol: mqtt.protocol,
    topic: mqtt.topic,
    qos: mqtt.qos,
    retain: mqtt.retain,
    extraSubscribeTopics: mqtt.extraSubscribeTopics,
    keepalive: mqtt.keepalive,
    cleanSession: mqtt.cleanSession,
    autoReconnect: mqtt.autoReconnect,
    reconnectPeriod: mqtt.reconnectPeriod,
  };
  res.json({ mqtt: safeMqtt, ...rest });
});
