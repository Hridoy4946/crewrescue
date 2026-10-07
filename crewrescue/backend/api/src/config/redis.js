import { logger } from './logger.js';

/**
 * Returns a clean, validated Redis configuration object for BullMQ / ioredis.
 * Handles Kubernetes service environment variables (where REDIS_PORT may be tcp://<ip>:<port>).
 */
export function getRedisConfig() {
  // If REDIS_URL is provided, prioritize it
  if (process.env.REDIS_URL && process.env.REDIS_URL.startsWith('redis://')) {
    try {
      const url = new URL(process.env.REDIS_URL);
      return {
        host: url.hostname || 'localhost',
        port: parseInt(url.port || '6379', 10),
        password: url.password || process.env.REDIS_PASSWORD || undefined,
        username: url.username || undefined,
        maxRetriesPerRequest: null,
      };
    } catch (e) {
      logger.warn('Failed to parse REDIS_URL, falling back to host/port:', e.message);
    }
  }

  // Handle REDIS_PORT safely (handles integer strings and K8s tcp://<ip>:<port> format)
  let port = 6379;
  const rawPort = process.env.REDIS_PORT;
  if (rawPort) {
    if (/^\d+$/.test(rawPort)) {
      port = parseInt(rawPort, 10);
    } else if (typeof rawPort === 'string' && rawPort.startsWith('tcp://')) {
      const match = rawPort.match(/:(\d+)$/);
      if (match) {
        port = parseInt(match[1], 10);
      }
    }
  }

  const host = process.env.REDIS_HOST ?? 'localhost';
  const password = process.env.REDIS_PASSWORD || undefined;

  return {
    host,
    port,
    password,
    maxRetriesPerRequest: null,
  };
}
