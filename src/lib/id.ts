/**
 * Local row identifiers.
 *
 * SQLite ids are opaque client-side strings: the app is single-user and fully
 * offline, so there is no coordination to do and no server to defer to. Prefers
 * `crypto.randomUUID` when the runtime provides it, and falls back to a
 * timestamp-plus-random id that is still collision-free in practice.
 */

const HEX = '0123456789abcdef';

function randomBytes(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += HEX[Math.floor(Math.random() * 16)];
  }
  return out;
}

export function createId(): string {
  const cryptoRef = globalThis.crypto;
  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  const time = Date.now().toString(36).padStart(9, '0');
  return `${time}-${randomBytes(12)}`;
}