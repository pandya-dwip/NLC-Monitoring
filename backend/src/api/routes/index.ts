import { Router } from 'express';
import { healthRouter } from './health';
import { configRouter } from './config';
import { devicesRouter } from './devices';
import { metricsRouter } from './metrics';
import { simulationRouter } from './simulation';
import { mqttMonitorRouter } from './mqttMonitor';
import { commandsRouter } from './commands';
import { exportRouter } from './exportRoutes';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(configRouter);
apiRouter.use(devicesRouter);
apiRouter.use(metricsRouter);
apiRouter.use(simulationRouter);
apiRouter.use(mqttMonitorRouter);
apiRouter.use(commandsRouter);
apiRouter.use(exportRouter);
