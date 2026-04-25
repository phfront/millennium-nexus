'use client';

import { usePathname } from 'next/navigation';
import { NavItem, Divider } from '@phfront/millennium-ui';
import { ModuleSidebarShell } from '@/components/shell/ModuleSidebarShell';
import { SidebarBrandHeader } from '@/components/shell/SidebarBrandHeader';
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
  { href: '/finance/one-time', icon: <Receipt size={18} />, label: 'Lançamentos' },
  { href: '/finance/subscriptions', icon: <Wallet size={18} />, label: 'Assinaturas' },
  { href: '/finance/receivables', icon: <Users size={18} />, label: 'Cobranças' },
  { href: '/finance/history', icon: <History size={18} />, label: 'Histórico' },
];

function SidebarBody({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <SidebarBrandHeader onClose={onClose} />

      <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-1">
        {NAV_LINKS.map((l) => (
          <NavItem
            key={l.href}
            href={l.href}
            icon={l.icon}
            label={l.label}
            isActive={pathname === l.href}
            onClick={onClose}
          />
        ))}
      </div>

      <div className="shrink-0 border-t border-border px-2 py-3 flex flex-col gap-1">
        <NavItem
          href="/finance/settings"
          icon={<SlidersHorizontal size={18} />}
          label="Configurações"
          isActive={pathname === '/finance/settings'}
          onClick={onClose}
        />
        <Divider />
        <NavItem
          href="/"
          icon={<Home size={18} />}
          label="Voltar ao Portal"
          isActive={false}
          onClick={onClose}
        />
      </div>
    </>
  );
}

export function ModuleSidebar() {
  return (
    <ModuleSidebarShell drawerId="finance-module-sidebar">
      {({ onClose }) => <SidebarBody onClose={onClose} />}
    </ModuleSidebarShell>
  );
}
