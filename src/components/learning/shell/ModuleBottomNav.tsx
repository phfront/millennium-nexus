'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from '@phfront/millennium-ui';
import { LayoutDashboard, Target } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/learning', icon: <LayoutDashboard size={20} />, label: 'Painel' },
  { href: '/learning/create', icon: <Target size={20} />, label: 'Novo Plano' },
];

export function ModuleBottomNav() {
  const pathname = usePathname();

  const items = NAV_ITEMS.map((item) => ({
    ...item,
    isActive: pathname === item.href,
  }));

  return (
    <BottomNav
      items={items}
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
    />
  );
}
