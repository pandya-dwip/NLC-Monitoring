import { createApp } from './app';
import { config } from './config';
import { getLogger } from './logger';
import { startSocketServer, type SocketServerHandle } from './websocket/socketServer';
import { pool } from './workers/pool';

const systemLogger = getLogger('system');

async function main(): Promise<void> {
  const app = createApp();
  const apiServer = app.listen(config.servers.apiPort, () => {
    systemLogger.info({ port: config.servers.apiPort }, 'REST API server listening');
  });

  const socketHandle: SocketServerHandle | null = startSocketServer();

  await pool.bootstrap();
  pool.start();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    systemLogger.info({ signal }, 'Shutting down gracefully');

    await pool.shutdown();
    if (socketHandle) await socketHandle.close();
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));

    systemLogger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  systemLogger.error({ err }, 'Fatal error during startup');
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
