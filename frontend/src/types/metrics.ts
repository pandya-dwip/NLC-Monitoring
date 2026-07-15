// Mirrors backend/src/models/metrics.ts.

export interface MetricsSnapshot {
  timestamp: number;
  devicesTotal: number;
  devicesConnected: number;
  devicesDisconnected: number;
  devicesPublishing: number;
  messagesSentTotal: number;
  messagesReceivedTotal: number;
  messagesPerSecond: number;
  commandsReceivedTotal: number;
  rpcRequestsTotal: number;
  avgLatencyMs: number;
  publishSuccessTotal: number;
  publishFailureTotal: number;
  reconnectTotal: number;
  bytesPerSecond: number;
  packetsPerSecond: number;
  droppedMessages: number;
  retryCount: number;
  workerCount: number;
  workerStatus: Array<{ workerId: number; deviceCount: number; alive: boolean }>;
  cpuUsagePercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  simulationMode: string;
  simulationRunning: boolean;
  simulationPaused: boolean;
}
