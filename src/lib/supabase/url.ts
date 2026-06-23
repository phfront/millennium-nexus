/** Nome fixo — evita mismatch entre localhost, 127.0.0.1 e URL do túnel. */
export const SUPABASE_AUTH_COOKIE_NAME = 'sb-millennium-v2-auth-token';

export function getSupabaseCookieOptions() {
  return { name: SUPABASE_AUTH_COOKIE_NAME };
}

export function resolveSupabasePublicUrl(origin?: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const path = url.startsWith('/') ? url : `/${url}`;
  const base = origin?.replace(/\/$/, '') ?? 'http://127.0.0.1:3030';
  return `${base}${path}`;
}

/** Browser + cookies — URL pública (proxy /supabase-api no túnel ou localhost). */
export function getSupabaseBrowserUrl(origin?: string): string {
  const base = origin?.replace(/\/$/, '') ?? 'http://127.0.0.1:3030';
  return `${base}/api/supabase`;
}

/** Server/middleware — conexão direta ao Supabase local (sem loop pelo proxy). */
export function getSupabaseServerUrl(): string {
  const internal = process.env.SUPABASE_INTERNAL_URL?.trim();
  if (internal) {
    return internal;
  }
  return resolveSupabasePublicUrl();
}
