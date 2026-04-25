'use client';

import { usePathname } from 'next/navigation';
import { Avatar } from '@phfront/millennium-ui';
import { useCurrentUser } from '@/hooks/use-current-user';
import { SidebarMenuButton } from '@/components/shell/SidebarMenuButton';

const ROUTE_LABELS: Record<string, string> = {
  '/health/peso': 'Saúde',
  '/health/setup': 'Configurar meta',
  '/health/log/new': 'Registrar peso',
  '/health/history': 'Histórico',
  '/health/nutrition': 'Nutrição',
  '/health/nutrition/plan': 'Minha Dieta',
  '/health/nutrition/foods': 'Alimentos',
  '/health/nutrition/history': 'Tendências',
  '/health/nutrition/settings': 'Config. Nutrição',
};

export function ModuleHeader() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const profile = user?.profile ?? null;
  const pageLabel = ROUTE_LABELS[pathname] ?? 'Health';

  return (
    <header className="md:hidden flex items-center gap-1 px-3 h-14 pt-[env(safe-area-inset-top,0px)] bg-surface-2 border-b border-border shrink-0">
      <SidebarMenuButton controls="health-module-sidebar" />
      <h1 className="flex-1 min-w-0 text-sm font-semibold text-text-primary text-center truncate px-1">
        {pageLabel}
      </h1>
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
