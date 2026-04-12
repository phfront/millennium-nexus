'use client';

import { usePathname } from 'next/navigation';
import { BottomNav, Icon } from '@phfront/millennium-ui';
import { Home, Shield, Settings } from 'lucide-react';
import type { Module } from '@/types/database';
import { useCurrentUser } from '@/hooks/use-current-user';

interface AppBottomNavProps {
  modules: Module[];
}

export function AppBottomNav({ modules }: AppBottomNavProps) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const profile = user?.profile ?? null;

  const activeModules = modules
    .filter((m) => m.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const items = [
    {
      href: '/',
      icon: <Home size={20} />,
      label: 'Início',
      isActive: pathname === '/',
    },
    ...(profile?.is_admin
      ? [
          {
            href: '/admin',
            icon: <Shield size={20} />,
            label: 'Admin',
            isActive: pathname === '/admin' || pathname.startsWith('/admin/'),
          },
        ]
      : []),
    ...activeModules.map((m) => ({
      href: `/${m.slug}`,
      icon: <Icon name={m.icon_name} fallbackName="Box" size={20} />,
      label: m.label,
      isActive: pathname === `/${m.slug}` || pathname.startsWith(`/${m.slug}/`),
    })),
    {
      href: '/profile',
      icon: <Settings size={20} />,
      label: 'Perfil',
      isActive: pathname === '/profile' || pathname.startsWith('/profile/'),
    },
  ];

  return (
    <BottomNav
      items={items}
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 overflow-x-auto flex-nowrap shrink-0"
    />
  );
}
