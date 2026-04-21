'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from '@phfront/millennium-ui';
import { LayoutDashboard, PlusCircle, Scale, History, Settings } from 'lucide-react';

function isWeightSectionPath(pathname: string) {
  return pathname.startsWith('/health') && !pathname.startsWith('/health/nutrition');
}

export function ModuleBottomNav() {
  const pathname = usePathname();

  const items = [
    {
      href: '/health/nutrition',
      icon: <LayoutDashboard size={20} />,
      label: 'Início',
      isActive: pathname === '/health/nutrition',
    },
    {
      href: '/health/peso',
      icon: <Scale size={20} />,
      label: 'Peso',
      isActive: isWeightSectionPath(pathname),
    },
    {
      href: '/health/log/new',
      icon: <PlusCircle size={20} />,
      label: 'Registrar',
      isActive: pathname === '/health/log/new',
    },
    {
      href: '/health/history',
      icon: <History size={20} />,
      label: 'Histórico',
      isActive: pathname === '/health/history',
    },
    {
      href: '/health/setup',
      icon: <Settings size={20} />,
      label: 'Meta',
      isActive: pathname === '/health/setup',
    },
  ];

  return (
    <BottomNav items={items} className="md:hidden fixed bottom-0 left-0 right-0 z-50" />
  );
}
