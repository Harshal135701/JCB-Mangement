
import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  maxPerIp?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

function getPositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('Invalid rate limiter configuration: expected a positive integer.');
  }

  return parsed;
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const max = options.max ?? getPositiveInteger(
    process.env.LOGIN_RATE_LIMIT_MAX,
    20
  );
  const maxPerIp = options.maxPerIp ?? 100;

  if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
    throw new Error('Rate limiter windowMs must be a positive integer.');
  }

  if (!Number.isSafeInteger(max) || max <= 0 ||
      !Number.isSafeInteger(maxPerIp) || maxPerIp <= 0) {
    throw new Error('Rate limiter limits must be positive integers.');
  }

  const message =
    options.message || 'Too many login attempts. Please try again later.';

  const getIp = (req: Request): string =>
    req.ip || req.socket.remoteAddress || 'unknown-client';

  const keyGenerator =
    options.keyGenerator ||
    ((req: Request) => {
      const identifier =
        typeof req.body?.identifier === 'string'
          ? req.body.identifier.trim().toLowerCase()
          : '';

      return identifier
        ? `${getIp(req)}:${identifier}`
        : getIp(req);
    });

  const store = new Map<string, RateLimitRecord>();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();

    for (const [key, record] of store.entries()) {
      if (now >= record.resetTime) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  cleanupInterval.unref?.();

  function consume(key: string, limit: number, now: number) {
    let record = store.get(key);

    if (!record || now >= record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    record.count += 1;
    store.set(key, record);

    return {
      allowed: record.count <= limit,
      remaining: Math.max(0, limit - record.count),
      resetTime: record.resetTime,
    };
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const ip = getIp(req);
    const compositeKey = keyGenerator(req);

    const ipResult = consume(`ip:${ip}`, maxPerIp, now);
    const accountResult = consume(`account:${compositeKey}`, max, now);

    const resetTime = Math.ceil(
      Math.max(ipResult.resetTime, accountResult.resetTime) / 1000
    );

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', accountResult.remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (!ipResult.allowed || !accountResult.allowed) {
      const retryAfter = Math.max(
        1,
        Math.ceil(
          (Math.max(ipResult.resetTime, accountResult.resetTime) - now) / 1000
        )
      );

      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        success: false,
        message,
      });
      return;
    }

    // Successful login clears only the account/IP combination counter.
    // The IP-wide protection remains active.
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.delete(`account:${compositeKey}`);
      }
    });

    next();
  };
}

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: getPositiveInteger(process.env.LOGIN_RATE_LIMIT_MAX, 20),
  maxPerIp: 100,
  message: 'Too many login attempts. Please try again later.',
});
