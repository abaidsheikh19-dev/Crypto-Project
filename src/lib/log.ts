/**
 * Structured JSON logging. Callers pass IDs and error codes only - never
 * personal data, tokens or secrets.
 */
type Level = 'info' | 'warn' | 'error';

export function log(level: Level, event: string, fields: Record<string, string | number | boolean | null | undefined> = {}) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}
