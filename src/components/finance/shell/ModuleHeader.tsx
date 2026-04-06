'use client';

import { usePathname } from 'next/navigation';
import { Home, SlidersHorizontal } from 'lucide-react';
import { Avatar } from '@phfront/millennium-ui';
import { useCurrentUser } from '@/hooks/use-current-user';

const ROUTE_LABELS: Record<string, string> = {
  '/finance': 'Finance',
  '/finance/income': 'Receitas',
  '/finance/expenses': 'Despesas',
  '/finance/one-time': 'Lançamentos',
  '/finance/subscriptions': 'Assinaturas',
  '/finance/receivables': 'Cobranças',
  '/finance/settings': 'Configurações',
  '/finance/history': 'Histórico',
};

export function ModuleHeader() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const profile = user?.profile ?? null;
  const pageLabel = ROUTE_LABELS[pathname] ?? 'Finance';

  return (
    <header className="md:hidden flex items-center gap-1 px-3 h-14 pt-[env(safe-area-inset-top,0px)] bg-surface-2 border-b border-border shrink-0">
      <a
        href="/"
        aria-label="Voltar ao portal"
        className="shrink-0 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer inline-flex"
      >
        <Home size={22} strokeWidth={2} />
      </a>
      <h1 className="flex-1 min-w-0 text-sm font-semibold text-text-primary text-center truncate px-1">
        {pageLabel}
      </h1>
      <a
        href="/finance/settings"
        aria-label="Configurações do Finance"
        className={[
          'shrink-0 p-2 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer inline-flex',
          pathname === '/finance/settings' ? 'text-brand-primary' : 'text-text-secondary hover:text-text-primary',
        ].join(' ')}
      >
        <SlidersHorizontal size={20} strokeWidth={2} />
      </a>
      <a
        href="/profile"
        aria-label="Abrir perfil no portal"
        className="cursor-pointer shrink-0 rounded-full p-0.5 hover:ring-2 hover:ring-brand-primary/30 transition-shadow"
      >
        <Avatar src={profile?.avatar_url} name={profile?.full_name ?? undefined} size="sm" />
      </a>
    </header>
  );
}
