'use client';

import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Avatar } from '@phfront/millennium-ui';
import { useCurrentUser } from '@/hooks/use-current-user';
import { SidebarMenuButton } from '@/components/shell/SidebarMenuButton';

const ROUTE_LABELS: Record<string, string> = {
  '/daily-goals': 'Hoje',
  '/daily-goals/history': 'Histórico',
  '/daily-goals/config': 'Metas',
  '/daily-goals/notifications': 'Notificações',
};

function resolveDailyGoalsTitle(pathname: string): string {
  if (pathname === '/daily-goals/config/new') return 'Nova meta';
  if (pathname.startsWith('/daily-goals/config/') && pathname !== '/daily-goals/config') {
    return 'Editar meta';
  }
  return ROUTE_LABELS[pathname] ?? 'Daily Goals';
}

function isMetasEditorRoute(pathname: string): boolean {
  if (pathname === '/daily-goals/config/new') return true;
  return pathname.startsWith('/daily-goals/config/') && pathname !== '/daily-goals/config';
}

export function ModuleHeader() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const profile = user?.profile ?? null;
  const pageLabel = resolveDailyGoalsTitle(pathname);
  const backToMetas = isMetasEditorRoute(pathname);

  return (
    <header className="md:hidden flex items-center gap-1 px-3 h-14 pt-[env(safe-area-inset-top,0px)] bg-surface-2 border-b border-border shrink-0">
      {backToMetas ? (
        <a
          href="/daily-goals/config"
          aria-label="Voltar à lista de metas"
          className="shrink-0 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer inline-flex"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </a>
      ) : (
        <SidebarMenuButton controls="daily-goals-module-sidebar" />
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
