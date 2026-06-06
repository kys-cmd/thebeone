// Validates required environment variables at startup.
// Throws in development so missing vars are caught early.
// Logs a warning in production so the app can still attempt to start.

const REQUIRED_CLIENT_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

type RequiredClientVar = typeof REQUIRED_CLIENT_VARS[number];

function getEnv(key: string): string {
  const viteVal = (import.meta.env as Record<string, string>)[key];
  if (viteVal) return viteVal;
  const winVal = typeof window !== 'undefined'
    ? (window as unknown as Record<string, Record<string, string>>).ENV_CONFIG?.[key]
    : undefined;
  return winVal ?? '';
}

function validateClientEnv(): Record<RequiredClientVar, string> {
  const missing: string[] = [];
  const resolved = {} as Record<RequiredClientVar, string>;

  for (const key of REQUIRED_CLIENT_VARS) {
    const val = getEnv(key);
    if (!val) {
      missing.push(key);
    } else {
      resolved[key] = val;
    }
  }

  if (missing.length > 0) {
    const msg = `[env] Missing required environment variables: ${missing.join(', ')}`;
    if (import.meta.env.DEV) {
      throw new Error(msg);
    } else {
      console.error(msg);
    }
  }

  return resolved;
}

export const clientEnv = validateClientEnv();
