'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Avatar } from '@phfront/millennium-ui';
import { BrandLogo } from '@/components/shell/BrandLogo';
import { useMobileSidebar } from '@/components/shell/MobileSidebarContext';
import { useUserProfile } from '@/hooks/use-user-profile';

export function AppHeader() {
  const { isOpen, open } = useMobileSidebar();
  const { profile } = useUserProfile();

  return (
    <header className="pwa-shell-header md:hidden grid grid-cols-[40px_1fr_40px] items-center pl-2 pr-3 h-14 pt-[env(safe-area-inset-top,0px)] bg-surface-2 border-b border-border shrink-0">
      <button
        type="button"
        onClick={open}
        aria-label="Abrir menu de navegação"
        aria-expanded={isOpen}
        aria-controls="app-mobile-sidebar"
        className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
      >
        <Menu size={22} strokeWidth={2} />
      </button>
      <Link
        href="/"
        className="justify-self-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        aria-label="Ir para início"
      >
        <BrandLogo size={30} />
      </Link>
      <Link href="/profile" className="justify-self-end" aria-label="Ir para perfil">
        <Avatar
          src={profile?.avatar_url}
          name={profile?.full_name ?? undefined}
          size="sm"
        />
      </Link>
    </header>
  );
}
