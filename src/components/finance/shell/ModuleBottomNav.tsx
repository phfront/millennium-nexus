'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from '@phfront/millennium-ui';
import { LayoutDashboard, TrendingUp, CreditCard, Wallet, Users } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/finance', icon: <LayoutDashboard size={20} />, label: 'Início' },
  { href: '/finance/income', icon: <TrendingUp size={20} />, label: 'Receitas' },
  { href: '/finance/expenses', icon: <CreditCard size={20} />, label: 'Despesas' },
  { href: '/finance/subscriptions', icon: <Wallet size={20} />, label: 'Assinaturas' },
  { href: '/finance/receivables', icon: <Users size={20} />, label: 'Cobranças' },
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
