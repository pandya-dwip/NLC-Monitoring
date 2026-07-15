import express, { type Express } from 'express';
import cors from 'cors';
import { apiRouter } from './api/routes';

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(apiRouter);
  return app;
}
