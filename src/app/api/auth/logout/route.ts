import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/url';

const LEGACY_AUTH_COOKIE_NAMES = [
  'sb-millennium-auth-token',
  SUPABASE_AUTH_COOKIE_NAME,
] as const;

function isAuthCookie(name: string): boolean {
  return LEGACY_AUTH_COOKIE_NAMES.some(
    (cookieName) => name === cookieName || name.startsWith(`${cookieName}.`),
  );
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });

  for (const cookie of request.cookies.getAll()) {
    if (isAuthCookie(cookie.name)) {
      response.cookies.delete(cookie.name);
    }
  }

  return response;
}
