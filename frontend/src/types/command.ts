// Mirrors backend/src/models/command.ts and workerMessages.ts's CommandReceivedEvent.

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

export interface CommandReceivedEvent {
  command: IncomingCommand;
  latencyMs: number;
  response: { topic: string; payload: unknown } | null;
}
