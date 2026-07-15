/**
 * Minimal local MQTT broker for development/testing (Phase 1 has no real
 * ThingsBoard broker available yet). Not used in production -- run with
 * `npm run broker:dev` and point MQTT_HOST=localhost / MQTT_PORT=1883 at it.
 */
import net from 'node:net';
import Aedes from 'aedes';

const port = Number(process.env['TEST_BROKER_PORT'] ?? 1883);
const aedes = new Aedes();
const server = net.createServer(aedes.handle);

aedes.on('client', (client) => {
  // eslint-disable-next-line no-console
  console.log(`[broker] client connected: ${client.id}`);
});
aedes.on('clientDisconnect', (client) => {
  // eslint-disable-next-line no-console
  console.log(`[broker] client disconnected: ${client.id}`);
});
aedes.on('publish', (packet, client) => {
  if (client) {
    // eslint-disable-next-line no-console
    console.log(`[broker] ${client.id} -> ${packet.topic} (${packet.payload.length}b)`);
  }
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[broker] test MQTT broker listening on port ${port}`);
});
