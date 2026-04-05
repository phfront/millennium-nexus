'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from '@phfront/millennium-ui';
import { LayoutDashboard, PlusCircle, History, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/health', icon: <LayoutDashboard size={20} />, label: 'Início' },
  { href: '/health/log/new', icon: <PlusCircle size={20} />, label: 'Registrar' },
  { href: '/health/history', icon: <History size={20} />, label: 'Histórico' },
  { href: '/health/setup', icon: <Settings size={20} />, label: 'Meta' },
];

export function ModuleBottomNav() {
  const pathname = usePathname();

  const items = NAV_ITEMS.map((item) => ({
    ...item,
    isActive: pathname === item.href,
  }));

  return (
    <BottomNav items={items} className="md:hidden fixed bottom-0 left-0 right-0 z-50" />
  );
}
