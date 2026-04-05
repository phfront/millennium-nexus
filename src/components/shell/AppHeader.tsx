'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from '@phfront/millennium-ui';
import { useUserProfile } from '@/hooks/use-user-profile';

const routeLabels: Record<string, string> = {
  '/': 'Início',
  '/profile': 'Perfil & Configurações',
};

export function AppHeader() {
  const pathname = usePathname();
  const { profile } = useUserProfile();

  const pageLabel = routeLabels[pathname] ?? 'Nexus';

  return (
    <header className="pwa-shell-header md:hidden flex items-center justify-between px-4 h-14 pt-[env(safe-area-inset-top,0px)] bg-surface-2 border-b border-border shrink-0">
      <h1 className="text-sm font-semibold text-text-primary truncate">{pageLabel}</h1>
      <Link href="/profile" aria-label="Ir para perfil">
        <Avatar
          src={profile?.avatar_url}
          name={profile?.full_name ?? undefined}
          size="sm"
        />
      </Link>
    </header>
  );
}
