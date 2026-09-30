/** Parse a dollar amount typed by an admin ("12", "12.5", "12.50") into integer cents without floats. */
export function parseDollarsToCents(input: string): number | null {
  const value = input.trim().replace(/^\$/, '').replace(/,/g, '');
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

export function centsToDollarsInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
