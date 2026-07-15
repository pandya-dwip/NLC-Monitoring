import { parentPort } from 'node:worker_threads';
import { runDeviceRunner } from './deviceRunner';
import type { MainToWorkerMessage } from '../models/workerMessages';

if (!parentPort) {
  throw new Error('deviceWorker.ts must be run as a worker_thread');
}

runDeviceRunner({
  post: (message) => parentPort!.postMessage(message),
  onMessage: (handler) => parentPort!.on('message', (msg: MainToWorkerMessage) => handler(msg)),
});
