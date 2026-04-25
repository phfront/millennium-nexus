'use client';

import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Avatar } from '@phfront/millennium-ui';
import { useCurrentUser } from '@/hooks/use-current-user';
import { SidebarMenuButton } from '@/components/shell/SidebarMenuButton';

const ROUTE_LABELS: Record<string, string> = {
  '/learning': 'Aprendizado',
  '/learning/create': 'Novo Plano',
};

function resolveLearningTitle(pathname: string): string {
  if (pathname.includes('/day/')) return 'Dia de Estudo';
  if (pathname.startsWith('/learning/') && pathname !== '/learning/create') {
    return 'Detalhes do Plano';
  }
  return ROUTE_LABELS[pathname] ?? 'Aprendizado';
}

function isInnerRoute(pathname: string): boolean {
  if (pathname === '/learning/create') return true;
  return pathname.startsWith('/learning/') && pathname !== '/learning';
}

export function ModuleHeader() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const profile = user?.profile ?? null;
  const pageLabel = resolveLearningTitle(pathname);
  const backToLearningHome = isInnerRoute(pathname);

  let backHref = '/learning';
  if (pathname.includes('/day/')) {
    // try to get plan id to return to plan
    const match = pathname.match(/\/learning\/([^/]+)\/day/);
    if (match && match[1]) {
      backHref = `/learning/${match[1]}`;
    }
  }

  return (
    <header className="md:hidden flex items-center gap-1 px-3 h-14 pt-[env(safe-area-inset-top,0px)] bg-surface-2 border-b border-border shrink-0">
      {backToLearningHome ? (
        <a
          href={backHref}
          aria-label="Voltar"
          className="shrink-0 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer inline-flex"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </a>
      ) : (
        <SidebarMenuButton controls="learning-module-sidebar" />
      )}
      <h1 className="flex-1 min-w-0 text-sm font-semibold text-text-primary text-center truncate px-1">
        {pageLabel}
      </h1>
      <a
        href="/profile"
        aria-label="Abrir perfil no portal"
        className="cursor-pointer shrink-0 rounded-full p-0.5 hover:ring-2 hover:ring-brand-primary/30 transition-shadow"
      >
        <Avatar
          src={profile?.avatar_url}
          name={profile?.full_name ?? undefined}
          size="sm"
        />
      </a>
    </header>
  );
}
