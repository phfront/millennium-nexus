'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from '@phfront/millennium-ui';
import { LayoutDashboard, History, Target, Bell } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/daily-goals', icon: <LayoutDashboard size={20} />, label: 'Hoje' },
  { href: '/daily-goals/history', icon: <History size={20} />, label: 'Histórico' },
  { href: '/daily-goals/config', icon: <Target size={20} />, label: 'Metas' },
  { href: '/daily-goals/notifications', icon: <Bell size={20} />, label: 'Notif.' },
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
