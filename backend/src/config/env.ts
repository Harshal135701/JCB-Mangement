import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

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

function parseAllowedOrigins(envOrigin?: string): string[] {
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5000',
  ];

  if (!envOrigin) {
    return defaultOrigins;
  }

  const customOrigins = envOrigin
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  // Return deduplicated array containing default and custom origins
  return Array.from(new Set([...defaultOrigins, ...customOrigins]));
}

export function validateAndLoadConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === '') {
    throw new Error(
      '[Security Startup Error]: Missing required environment variable: DATABASE_URL. The server cannot start without database credentials.'
    );
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim() === '') {
    throw new Error(
      '[Security Startup Error]: Missing required environment variable: JWT_SECRET. The server cannot start without a configured JWT signing secret.'
    );
  }

  const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
  if (!refreshTokenSecret || refreshTokenSecret.trim() === '') {
    throw new Error(
      '[Security Startup Error]: Missing required environment variable: REFRESH_TOKEN_SECRET. The server cannot start without a configured refresh-token secret.'
    );
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d';
  const refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS);

  return {
    port,
    nodeEnv,
    databaseUrl,
    jwtSecret,
    jwtExpiresIn,
    refreshTokenSecret,
    refreshTokenExpiresIn,
    allowedOrigins,
  };
}

export const config = validateAndLoadConfig();
