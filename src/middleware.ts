import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getSupabaseCookieOptions,
  getSupabaseServerUrl,
  SUPABASE_AUTH_COOKIE_NAME,
} from '@/lib/supabase/url';

const PUBLIC_ROUTES = ['/login', '/reset-password'] as const;
const DEFAULT_REDIRECT_AUTHENTICATED = '/';
const DEFAULT_REDIRECT_UNAUTHENTICATED = '/login';

function isLocalHostRequest(request: NextRequest): boolean {
  const host = (request.headers.get('host') ?? '').split(':')[0]?.toLowerCase() ?? '';
  return host === '127.0.0.1' || host === 'localhost';
}

function purgeStaleSupabaseAuthCookies(request: NextRequest, response: NextResponse): void {
  const expectedPrefix = `${SUPABASE_AUTH_COOKIE_NAME}`;

  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith('sb-') || !cookie.name.includes('-auth-token')) {
      continue;
    }
    if (cookie.name === expectedPrefix || cookie.name.startsWith(`${expectedPrefix}.`)) {
      continue;
    }
    response.cookies.delete(cookie.name);
  }
}

function readTunnelTokenFromRequest(request: NextRequest): string | null {
  const queryToken = request.nextUrl.searchParams.get('tunnel_token');
  if (queryToken?.trim()) {
    return queryToken.trim();
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

function setTunnelAccessCookie(response: NextResponse, token: string): void {
  response.cookies.set('tunnel_access', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function middleware(request: NextRequest) {
  const tunnelToken = process.env.TUNNEL_ACCESS_TOKEN?.trim();
  if (tunnelToken && !isLocalHostRequest(request)) {
    const requestToken = readTunnelTokenFromRequest(request);
    const tunnelCookie = request.cookies.get('tunnel_access')?.value;
    const hasValidToken = requestToken === tunnelToken;
    const hasValidCookie = tunnelCookie === tunnelToken;

    if (!hasValidToken && !hasValidCookie) {
      return new NextResponse(
        'Acesso bloqueado. Abra o link compartilhado com tunnel_token ou configure Cloudflare Access.',
        { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      );
    }

    // Token na URL: seta cookie e continua (sem redirect — Safari no celular perde cookie no 307)
    if (hasValidToken) {
      const response = NextResponse.next({ request });
      setTunnelAccessCookie(response, tunnelToken);
      return response;
    }
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/supabase/')) {
    return NextResponse.next({ request });
  }

  if (pathname.startsWith('/supabase-api')) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  purgeStaleSupabaseAuthCookies(request, supabaseResponse);

  const supabase = createServerClient(
    getSupabaseServerUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getSupabaseCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          purgeStaleSupabaseAuthCookies(request, supabaseResponse);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = (PUBLIC_ROUTES as readonly string[]).includes(pathname);

  if (user && isPublicRoute) {
    return NextResponse.redirect(new URL(DEFAULT_REDIRECT_AUTHENTICATED, request.url));
  }

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL(DEFAULT_REDIRECT_UNAUTHENTICATED, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|sw.js|.*\\..*).*)' ,
  ],
};
