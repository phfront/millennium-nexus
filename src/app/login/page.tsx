'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Alert } from '@phfront/millennium-ui';
import { createClient } from '@/lib/supabase/client';
import { parseSupabaseError } from '@/lib/errors';
import { isValidEmail } from '@/lib/validators/functions';

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
    <main className="min-h-screen bg-surface-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 animate-slide-up">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-primary/10 mb-2">
            <span className="text-3xl font-black text-brand-primary tracking-tighter">N</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Nexus</h1>
          <p className="text-sm text-text-muted">Acesse o seu ecossistema pessoal</p>
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

        <div className="text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isLoading}
            className="text-sm text-text-muted hover:text-brand-primary transition-colors disabled:opacity-50"
          >
            Esqueci minha senha
          </button>
        </div>
      </div>
    </main>
  );
}
