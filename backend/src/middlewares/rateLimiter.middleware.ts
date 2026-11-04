import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const max =
    options.max ||
    parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '20', 10);
  const message = options.message || 'Too many login attempts. Please try again later.';
  const keyGenerator =
    options.keyGenerator ||
    ((req: Request) => {
      // Resolve client IP safely via Express req.ip (respects TRUST_PROXY if configured) or raw socket
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown-client';
      const targetIdentifier =
        typeof req.body?.identifier === 'string' && req.body.identifier.trim().length > 0
          ? req.body.identifier.trim().toLowerCase()
          : '';
      // Composite key prevents bypass via header rotation while isolating accounts on shared NAT IPs
      return targetIdentifier ? `${clientIp}:${targetIdentifier}` : clientIp;
    });

  const store = new Map<string, RateLimitRecord>();

  // Cleanup expired entries periodically to prevent memory leaks
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (interval.unref) {
    interval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    let record = store.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      store.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil(record.resetTime / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        success: false,
        message,
      });
      return;
    }

    // Reset rate limiter on successful authentication to prevent locking out legitimate users
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.delete(key);
      }
    });

    next();
  };
}

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '20', 10),
  message: 'Too many login attempts. Please try again later.',
});
