/** Minimal dot-path get/set for plain objects, used to apply randomization ranges to a cloned payload. */

export function getPath(obj: Record<string, unknown>, dotPath: string): unknown {
  return dotPath.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function setPath(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const keys = dotPath.split('.');
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i]!;
    const next = cursor[key];
    if (!next || typeof next !== 'object') {
      return;
    }
    cursor = next as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1]!;
  cursor[lastKey] = value;
}
