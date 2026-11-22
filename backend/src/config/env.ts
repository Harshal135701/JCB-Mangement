
// Safely load .env file for local development.
// In cloud container environments (e.g. Render, Railway, DigitalOcean, Docker),
// environment variables are injected directly into process.env by the host.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  dotenv.config();
} catch (_err) {
  // dotenv is optional in containerized production environments
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenSecret: string;
  refreshTokenExpiresIn: string;
  allowedOrigins: string[];
}

const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5000',
];

function validateSecret(name: string): string {
  const value = process.env[name]?.trim();

  if (!value || value.length < 32) {
    throw new Error(
      `[Security Startup Error]: ${name} must contain at least 32 characters.`
    );
  }

  return value;
}

function validateExpiry(name: string, fallback: string): string {
  const value = process.env[name]?.trim() || fallback;

  // Supports values such as 15m, 1h, 1d, and 7d.
  if (!/^[1-9]\d*(ms|s|m|h|d|w|y)$/.test(value)) {
    throw new Error(
      `[Configuration Error]: ${name} must use a valid duration, such as 15m or 1d.`
    );
  }

  return value;
}

function parseAllowedOrigins(nodeEnv: string): string[] {
  const configuredOrigins =
    process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS;

  if (!configuredOrigins?.trim()) {
    return [
      ...DEVELOPMENT_ORIGINS,
      'https://jcb-cmms.vercel.app',
      'https://jcb-n4yqr.ondigitalocean.app',
    ];
  }

  if (configuredOrigins.trim() === '*') {
    return ['*'];
  }

  const origins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const validatedOrigins = origins.map((origin) => {
    if (origin === '*') return '*';

    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`[Configuration Error]: Invalid CORS origin: ${origin}`);
    }

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin
    ) {
      throw new Error(`[Configuration Error]: Invalid CORS origin: ${origin}`);
    }

    if (
      nodeEnv === 'production' &&
      parsed.protocol !== 'https:' &&
      !['localhost', '127.0.0.1'].includes(parsed.hostname)
    ) {
      throw new Error(
        '[Security Startup Error]: Production CORS origins must use HTTPS.'
      );
    }

    return parsed.origin;
  });

  return [...new Set(validatedOrigins)];
}

export function validateAndLoadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV?.trim() || 'development';

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      '[Security Startup Error]: DATABASE_URL is required.'
    );
  }

  const portValue = process.env.PORT || '5000';
  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('[Configuration Error]: PORT must be between 1 and 65535.');
  }

  return {
    port,
    nodeEnv,
    databaseUrl,
    jwtSecret: validateSecret('JWT_SECRET'),
    jwtExpiresIn: validateExpiry('JWT_EXPIRES_IN', '1d'),
    refreshTokenSecret: validateSecret('REFRESH_TOKEN_SECRET'),
    refreshTokenExpiresIn: validateExpiry(
      'REFRESH_TOKEN_EXPIRES_IN',
      '7d'
    ),
    allowedOrigins: parseAllowedOrigins(nodeEnv),
  };
}

export const config = validateAndLoadConfig();
