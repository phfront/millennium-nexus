'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Alert } from '@phfront/millennium-ui';
import { BrandLogo } from '@/components/shell/BrandLogo';
import { createClient } from '@/lib/supabase/client';
import { parseSupabaseError } from '@/lib/errors';
import { isValidEmail } from '@/lib/validators/functions';

const heroGradientStyle = {
  background:
    'radial-gradient(ellipse 80% 60% at 50% 20%, var(--color-brand-primary, #16a34a) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 80% 80%, rgba(182, 157, 70, 0.35) 0%, transparent 50%)',
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(parseSupabaseError(authError));
      setIsLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Informe seu e-mail antes de redefinir a senha.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/profile`,
    });

    setIsLoading(false);
    if (resetError) {
      setError(parseSupabaseError(resetError));
    } else {
      setResetSent(true);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col bg-surface-1 lg:flex-row">
      <div className="flex min-h-dvh flex-1 flex-col p-3 sm:p-4 lg:min-h-0 lg:flex-row lg:flex-1 lg:p-0">
        {/* Mobile: um único cartão; desktop: wrapper neutro (lg:contents) */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface-2/25 shadow-lg backdrop-blur-sm lg:contents lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:backdrop-blur-none">
          <section className="relative flex flex-col items-center justify-center px-6 pb-5 pt-8 text-center lg:w-[46%] lg:min-h-dvh lg:border-r lg:border-border lg:py-16 lg:text-left">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12] dark:opacity-[0.18]"
              style={heroGradientStyle}
            />
            <div className="relative z-10 flex max-w-md flex-col items-center lg:items-start">
              <div className="mb-5 rounded-2xl bg-surface-2/80 p-3 shadow-md ring-1 ring-border backdrop-blur-sm lg:mb-6 lg:p-4">
                <div className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center lg:h-[5.5rem] lg:w-[5.5rem]">
                  <BrandLogo size={88} className="max-h-full max-w-full object-contain" priority />
                </div>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                Millennium <span className="text-brand-primary">Nexus</span>
              </h1>
              <p className="mt-3 max-w-sm text-base leading-relaxed text-text-muted lg:mt-4">
                O portal do seu ecossistema pessoal
              </p>
              <div className="mt-8 hidden h-px w-24 rounded-full bg-gradient-to-r from-brand-primary/60 to-transparent lg:block" />
            </div>
          </section>

          <section className="flex flex-1 flex-col justify-center border-t-0 px-6 pb-8 pt-2 lg:px-12 lg:py-16 lg:pt-16">
            <div className="mx-auto w-full max-w-[22rem] space-y-6 animate-slide-up lg:space-y-8">
              <div className="space-y-1 text-center lg:text-left">
                <h2 className="text-lg font-semibold text-text-primary lg:text-xl">Entrar</h2>
                <p className="text-sm text-text-muted">Use o e-mail e a senha da sua conta.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <Alert variant="danger" className="animate-fade-in">
                    {error}
                  </Alert>
                )}
                {resetSent && (
                  <Alert variant="success" className="animate-fade-in">
                    E-mail de redefinição enviado! Verifique sua caixa de entrada.
                  </Alert>
                )}

                <Input
                  label="E-mail"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />

                <Input
                  label="Senha"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />

                <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                  Entrar
                </Button>
              </form>

              <div className="text-center lg:text-left">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                  className="text-sm text-text-muted transition-colors hover:text-brand-primary disabled:opacity-50 underline-offset-4 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
