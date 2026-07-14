import path from 'node:path';

export interface ApiConfig {
  databasePath: string;
  host: string;
  port: number;
  seed: boolean;
  resetBaseUrl: string;
}

function parseResetBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SHOP_RESET_BASE_URL must be an absolute http(s) URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('SHOP_RESET_BASE_URL must be an absolute http(s) URL');
  }
  return url.toString();
}

/** Read supported API runtime settings without opening resources. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const port = Number(env.SHOP_API_PORT ?? '3001');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SHOP_API_PORT must be an integer between 1 and 65535');
  }
  const resetBaseUrl = parseResetBaseUrl(env.SHOP_RESET_BASE_URL ?? 'http://127.0.0.1:5173');

  return {
    databasePath: env.SHOP_DB_PATH ?? path.join(process.cwd(), 'data', 'shop.db'),
    host: env.SHOP_API_HOST ?? '127.0.0.1',
    port,
    seed: env.SHOP_SEED === 'true',
    resetBaseUrl,
  };
}
