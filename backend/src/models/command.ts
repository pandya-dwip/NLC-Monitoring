export type CommandKind = 'rpc' | 'attribute-update' | 'attribute-response';

export interface IncomingCommand {
  id: string;
  clientId: string;
  kind: CommandKind;
  topic: string;
  method: string | null;
  requestId: string | null;
  payload: unknown;
  receivedAt: number;
}

export interface CommandExecutionResult {
  command: IncomingCommand;
  latencyMs: number;
  status: 'acknowledged' | 'failed' | 'timeout';
  response: unknown;
}

/** What a command actually changed on the device, for display -- only the fields that changed are present. */
export interface CommandStateChange {
  lightState?: { from: 0 | 1; to: 0 | 1 };
  dimLevel?: { from: number; to: number };
  /** Present whenever the manual override was set (new expiry ts) or cleared (null). */
  overrideExpiresAt?: number | null;
}
