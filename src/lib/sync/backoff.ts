export const MAX_ATTEMPTS = 10;
const BASE_MS = 1_000;
const CAP_MS = 5 * 60 * 1_000;

export function nextDelayMs(attempt: number): number {
  return Math.min(BASE_MS * 2 ** attempt, CAP_MS);
}

export function isTerminal(attempt: number): boolean {
  return attempt >= MAX_ATTEMPTS;
}
