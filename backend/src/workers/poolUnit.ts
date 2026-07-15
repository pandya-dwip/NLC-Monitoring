import { Worker } from 'node:worker_threads';
import { fork } from 'node:child_process';
import type { MainToWorkerMessage, WorkerToMainMessage } from '../models/workerMessages';

/**
 * Transport-agnostic adapter over one execution unit (a worker_thread or a
 * forked child_process) -- lets BaseExecutionPool orchestrate either
 * transport with the same code.
 */
export interface PoolUnit {
  postMessage(message: MainToWorkerMessage): void;
  onMessage(handler: (msg: WorkerToMainMessage) => void): void;
  onError(handler: (err: Error) => void): void;
  onExit(handler: (code: number) => void): void;
  terminate(): Promise<void>;
}

export function spawnThreadUnit(file: string, execArgv: string[]): PoolUnit {
  const worker = new Worker(file, { execArgv });
  return {
    postMessage: (message) => {
      try {
        worker.postMessage(message);
      } catch {
        // already terminated; the pool's onExit handler already marked it stopped.
      }
    },
    onMessage: (handler) => {
      worker.on('message', handler);
    },
    onError: (handler) => {
      worker.on('error', handler);
    },
    onExit: (handler) => {
      worker.on('exit', handler);
    },
    terminate: async () => {
      await worker.terminate();
    },
  };
}

/**
 * Note: unlike a worker_thread, an uncaught exception inside a forked
 * process does NOT raise this unit's 'error' event (that event is reserved
 * for failures spawning/killing the OS process itself, e.g. ENOENT) -- it
 * crashes the process, which surfaces here as onExit with a non-zero code.
 * BaseExecutionPool already treats a non-zero exit as a crash, so both
 * transports end up handled correctly, just via different events.
 */
export function spawnProcessUnit(file: string, execArgv: string[]): PoolUnit {
  const child = fork(file, { execArgv });
  const hasExited = (): boolean => child.exitCode !== null || child.signalCode !== null;

  return {
    postMessage: (message) => {
      // send() throws synchronously if the IPC channel is already closed
      // (e.g. the process crashed independently) -- swallow it so one dead
      // unit can't break a broadcast loop over the rest of the pool.
      try {
        child.send(message);
      } catch {
        // already exited; the pool's onExit handler already marked it stopped.
      }
    },
    onMessage: (handler) => {
      child.on('message', (message) => handler(message as WorkerToMainMessage));
    },
    onError: (handler) => {
      child.on('error', handler);
    },
    onExit: (handler) => {
      child.on('exit', (code) => handler(code ?? 0));
    },
    terminate: () =>
      new Promise<void>((resolve) => {
        // A NEW 'exit' listener never fires for a process that already
        // exited (the event doesn't replay) -- without this guard,
        // terminate() on an already-dead unit hangs forever.
        if (hasExited()) {
          resolve();
          return;
        }
        child.once('exit', () => resolve());
        child.kill();
      }),
  };
}
