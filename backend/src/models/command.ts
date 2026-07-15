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
