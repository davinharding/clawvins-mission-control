import { timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison. Returns false if either value is missing. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Read a required environment variable or exit with a helpful message. */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] ${name} is not set. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}
