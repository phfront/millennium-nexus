'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from '@phfront/millennium-ui';
import { Home, Bell, User } from 'lucide-react';

export function AppBottomNav() {
  const pathname = usePathname();

  const items = [
    {
      href: '/',
      icon: <Home size={20} />,
      label: 'Início',
      isActive: pathname === '/',
    },
    {
      href: '#',
      icon: <Bell size={20} />,
      label: 'Notificações',
      isActive: false,
    },
    {
      href: '/profile',
      icon: <User size={20} />,
      label: 'Perfil',
      isActive: pathname === '/profile',
    },
  ];

  return (
    <BottomNav
      items={items}
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
    />
  );
}
