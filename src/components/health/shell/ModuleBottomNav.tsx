'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from '@phfront/millennium-ui';
import { LayoutDashboard, PlusCircle, UtensilsCrossed, History, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/health', icon: <LayoutDashboard size={20} />, label: 'Início', exact: true },
  { href: '/health/nutrition', icon: <UtensilsCrossed size={20} />, label: 'Nutrição', exact: false },
  { href: '/health/log/new', icon: <PlusCircle size={20} />, label: 'Registrar', exact: true },
  { href: '/health/history', icon: <History size={20} />, label: 'Histórico', exact: true },
  { href: '/health/setup', icon: <Settings size={20} />, label: 'Meta', exact: true },
];

export function ModuleBottomNav() {
  const pathname = usePathname();

  const items = NAV_ITEMS.map(({ exact, ...item }) => ({
    ...item,
    isActive: exact ? pathname === item.href : pathname.startsWith(item.href),
  }));

  return (
    <BottomNav items={items} className="md:hidden fixed bottom-0 left-0 right-0 z-50" />
  );
}
