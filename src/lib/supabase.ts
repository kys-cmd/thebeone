/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const getSafeEnv = (key: string): string => {
  try {
    // 1. Try Vite's built-in env (standard)
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {
    // Standard Vite env might not be accessible in some weird runtime cases
  }

  try {
    // 2. Try the server-injected window config (fallback for dev server)
    if (typeof window !== 'undefined' && (window as any).ENV_CONFIG && (window as any).ENV_CONFIG[key]) {
      return (window as any).ENV_CONFIG[key];
    }
  } catch (e) {
    // window might not be defined in server contexts
  }

  return '';
};

const supabaseUrl = getSafeEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getSafeEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. The app might not function correctly.');
}

// Ensure createClient receives at least a string that looks like a URL
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

// Gracefully handle "Refresh Token Not Found" and "Invalid Refresh Token" errors 
// to prevent them from bubbling up and crashing pages or components.
const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
supabase.auth.getSession = async () => {
  try {
    const res = await originalGetSession();
    if (res.error) {
      const errMsg = res.error.message || '';
      if (errMsg.includes('Refresh Token Not Found') || errMsg.includes('Invalid Refresh Token')) {
        console.warn('[Supabase Security Wrapper] Refresh token error encountered in session:', errMsg);
        // Clean up the local storage to get out of the loop
        if (typeof window !== 'undefined' && window.localStorage) {
          for (let i = window.localStorage.length - 1; i >= 0; i--) {
            const key = window.localStorage.key(i);
            if (key && key.includes('auth-token')) {
              window.localStorage.removeItem(key);
            }
          }
        }
        await supabase.auth.signOut().catch(() => {});
        return { data: { session: null }, error: null };
      }
    }
    return res;
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (errMsg.includes('Refresh Token Not Found') || errMsg.includes('Invalid Refresh Token')) {
      console.warn('[Supabase Security Wrapper] Refresh token error thrown on getSession:', errMsg);
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && key.includes('auth-token')) {
            window.localStorage.removeItem(key);
          }
        }
      }
      await supabase.auth.signOut().catch(() => {});
      return { data: { session: null }, error: null };
    }
    throw err;
  }
};

const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
supabase.auth.getUser = async (jwt?: string) => {
  try {
    const res = await originalGetUser(jwt);
    if (res.error) {
      const errMsg = res.error.message || '';
      if (errMsg.includes('Refresh Token Not Found') || errMsg.includes('Invalid Refresh Token')) {
        console.warn('[Supabase Security Wrapper] Refresh token error encountered in getUser:', errMsg);
        if (typeof window !== 'undefined' && window.localStorage) {
          for (let i = window.localStorage.length - 1; i >= 0; i--) {
            const key = window.localStorage.key(i);
            if (key && key.includes('auth-token')) {
              window.localStorage.removeItem(key);
            }
          }
        }
        await supabase.auth.signOut().catch(() => {});
        return { data: { user: null }, error: null };
      }
    }
    return res;
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (errMsg.includes('Refresh Token Not Found') || errMsg.includes('Invalid Refresh Token')) {
      console.warn('[Supabase Security Wrapper] Refresh token error thrown on getUser:', errMsg);
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && key.includes('auth-token')) {
            window.localStorage.removeItem(key);
          }
        }
      }
      await supabase.auth.signOut().catch(() => {});
      return { data: { user: null }, error: null };
    }
    throw err;
  }
};

