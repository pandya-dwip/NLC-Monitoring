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

/** What a command actually changed on the device, for display -- only the fields that changed are present. */
export interface CommandStateChange {
  lightState?: { from: 0 | 1; to: 0 | 1 };
  dimLevel?: { from: number; to: number };
  /** Present whenever the manual override was set (new expiry ts) or cleared (null). */
  overrideExpiresAt?: number | null;
}

export interface CommandReceivedEvent {
  command: IncomingCommand;
  latencyMs: number;
  response: { topic: string; payload: unknown } | null;
  stateChange: CommandStateChange | null;
}
