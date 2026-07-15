/** Shape loaded from payload-template.json */
export interface PayloadTemplateFile {
  template: Record<string, unknown>;
  randomization: {
    description?: string;
    ranges: Record<string, { min: number; max: number; jitter?: number }>;
    failureProbabilities: Record<string, number>;
  };
}

/** A rendered telemetry payload ready to publish (NLCId/ts/values). */
export type TelemetryPayload = Record<string, unknown>;
