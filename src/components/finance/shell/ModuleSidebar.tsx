'use client';

import { usePathname } from 'next/navigation';
import { Sidebar, NavItem, Divider, NexusLogo } from '@phfront/millennium-ui';
import {
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  Receipt,
  Users,
  Home,
  Wallet,
  SlidersHorizontal,
  History,
} from 'lucide-react';

const NAV_LINKS = [
  { href: '/finance', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { href: '/finance/income', icon: <TrendingUp size={18} />, label: 'Receitas' },
  { href: '/finance/expenses', icon: <CreditCard size={18} />, label: 'Despesas' },
  { href: '/finance/one-time', icon: <Receipt size={18} />, label: 'Pontuais' },
  { href: '/finance/subscriptions', icon: <Wallet size={18} />, label: 'Assinaturas' },
  { href: '/finance/receivables', icon: <Users size={18} />, label: 'Cobranças' },
  { href: '/finance/history', icon: <History size={18} />, label: 'Histórico' },
];

export function ModuleSidebar() {
  const pathname = usePathname();

  const logo = <NexusLogo size={32} />;

  const links = NAV_LINKS.map((l) => ({ ...l, isActive: pathname === l.href }));

  const footer = (
    <div className="flex flex-col gap-1">
      <NavItem
        href="/finance/settings"
        icon={<SlidersHorizontal size={18} />}
        label="Configurações"
        isActive={pathname === '/finance/settings'}
      />
      <Divider />
      <NavItem href="/" icon={<Home size={18} />} label="Voltar ao Portal" isActive={false} />
    </div>
  );

  return (
    <Sidebar logo={logo} links={links} footer={footer} className="hidden md:flex" />
  );
}
