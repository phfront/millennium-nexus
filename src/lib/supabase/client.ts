import { createBrowserClient } from '@supabase/ssr';
import {
  getSupabaseBrowserUrl,
  getSupabaseCookieOptions,
} from '@/lib/supabase/url';

export function createClient() {
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
  return createBrowserClient(
    getSupabaseBrowserUrl(origin),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getSupabaseCookieOptions(),
      isSingleton: true,
    },
  );
}
