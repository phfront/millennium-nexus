'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from '@phfront/millennium-ui';
import { useUserProfile } from '@/hooks/use-user-profile';
import { BrandLogo } from '@/components/shell/BrandLogo';

const routeLabels: Record<string, string> = {
  '/': 'Início',
  '/profile': 'Perfil & Configurações',
};

export function AppHeader() {
  const pathname = usePathname();
  const { profile } = useUserProfile();

  const pageLabel = routeLabels[pathname] ?? 'Millennium Nexus';

  return (
    <header className="pwa-shell-header md:hidden flex items-center gap-3 px-4 h-14 pt-[env(safe-area-inset-top,0px)] bg-surface-2 border-b border-border shrink-0">
      <Link
        href="/"
        className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        aria-label="Ir para início"
      >
        <BrandLogo size={30} />
      </Link>
      <h1 className="min-w-0 flex-1 text-sm font-semibold text-text-primary truncate">{pageLabel}</h1>
      <Link href="/profile" className="shrink-0" aria-label="Ir para perfil">
        <Avatar
          src={profile?.avatar_url}
          name={profile?.full_name ?? undefined}
          size="sm"
        />
      </Link>
    </header>
  );
}
