import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getSupabaseCookieOptions,
  getSupabaseServerUrl,
} from '@/lib/supabase/url';

const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-profile',
  'content-profile',
  'content-type',
  'if-match',
  'if-none-match',
  'prefer',
  'range',
  'x-client-info',
  'x-supabase-api-version',
  'x-upsert',
] as const;

const FORWARDED_RESPONSE_HEADERS = [
  'cache-control',
  'content-range',
  'content-type',
  'etag',
  'location',
  'preference-applied',
  'range-unit',
] as const;

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxySupabase(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createServerClient(getSupabaseServerUrl(), anonKey, {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Sessões são atualizadas pelo middleware das páginas.
      },
    },
  });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const targetUrl = new URL(
    `${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`,
    `${getSupabaseServerUrl().replace(/\/$/, '')}/`,
  );
  const headers = new Headers();

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  headers.set('apikey', anonKey);
  headers.set('authorization', `Bearer ${session?.access_token ?? anonKey}`);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: 'no-store',
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxySupabase;
export const POST = proxySupabase;
export const PUT = proxySupabase;
export const PATCH = proxySupabase;
export const DELETE = proxySupabase;
export const HEAD = proxySupabase;
