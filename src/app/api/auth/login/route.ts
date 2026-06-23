import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getSupabaseCookieOptions,
  getSupabaseServerUrl,
  SUPABASE_AUTH_COOKIE_NAME,
} from '@/lib/supabase/url';

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export async function POST(request: NextRequest) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ error: 'Informe o e-mail e a senha.' }, { status: 400 });
  }

  const cookiesToSet: CookieToSet[] = [];
  const supabase = createServerClient(
    getSupabaseServerUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getSupabaseCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(values: CookieToSet[]) {
          cookiesToSet.push(...values);
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? 'Não foi possível entrar.' },
      { status: error?.status ?? 401 },
    );
  }

  const response = NextResponse.json({ ok: true });

  for (const cookie of request.cookies.getAll()) {
    if (
      cookie.name === SUPABASE_AUTH_COOKIE_NAME ||
      cookie.name.startsWith(`${SUPABASE_AUTH_COOKIE_NAME}.`)
    ) {
      response.cookies.delete(cookie.name);
    }
  }

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
