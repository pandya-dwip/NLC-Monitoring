import { runDeviceRunner } from './deviceRunner';
import type { MainToWorkerMessage } from '../models/workerMessages';

if (!process.send) {
  throw new Error('deviceProcess.ts must be run as a forked child_process (CLUSTER_MODE=true)');
}

runDeviceRunner({
  post: (message) => process.send!(message),
  onMessage: (handler) => process.on('message', (msg: MainToWorkerMessage) => handler(msg)),
});
