'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, Avatar, Divider, Icon, NavItem, NexusLogo } from '@phfront/millennium-ui';
import { useCurrentUser } from '@/hooks/use-current-user';
import { createClient } from '@/lib/supabase/client';
import { LogOut, Settings, Home, Shield } from 'lucide-react';
import type { Module } from '@/types/database';

interface AppSidebarProps {
  modules: Module[];
}

export function AppSidebar({ modules }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const profile = user?.profile ?? null;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const activeModules = modules.filter((m) => m.is_active).sort((a, b) => a.sort_order - b.sort_order);

  const links = [
    { href: '/', icon: <Home size={18} />, label: 'Início', isActive: pathname === '/' },
    ...(profile?.is_admin
      ? [
          {
            href: '/admin',
            icon: <Shield size={18} />,
            label: 'Admin',
            isActive: pathname === '/admin',
          },
        ]
      : []),
    ...activeModules.map((m) => ({
      href: `/${m.slug}`,
      icon: <Icon name={m.icon_name} fallbackName="Box" size={18} />,
      label: m.label,
      isActive: pathname === `/${m.slug}`,
    })),
  ];

  const logo = <NexusLogo size={32} />;

  const footer = (
    <div className="flex flex-col gap-1">
      <NavItem href="/profile" icon={<Settings size={18} />} label="Perfil & Config." isActive={pathname === '/profile'} />
      {profile && (
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar src={profile.avatar_url} name={profile.full_name ?? undefined} size="sm" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">{profile.full_name ?? 'Usuário'}</p>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
          </div>
        </div>
      )}
      <Divider />
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-danger hover:bg-danger-bg transition-colors w-full"
      >
        <LogOut size={18} />
        <span>Sair</span>
      </button>
    </div>
  );

  return (
    <Sidebar
      logo={logo}
      links={links}
      footer={footer}
      className="hidden md:flex"
    />
  );
}
