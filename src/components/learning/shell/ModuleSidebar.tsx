'use client';

import { usePathname } from 'next/navigation';
import { NavItem, Divider } from '@phfront/millennium-ui';
import { ModuleSidebarShell } from '@/components/shell/ModuleSidebarShell';
import { SidebarBrandHeader } from '@/components/shell/SidebarBrandHeader';
import { LayoutDashboard, Home, List, Target } from 'lucide-react';

const NAV_LINKS = [
  { href: '/learning', icon: <LayoutDashboard size={18} />, label: 'Painel' },
  { href: '/learning/plans', icon: <List size={18} />, label: 'Lista de Planos' },
  { href: '/learning/create', icon: <Target size={18} />, label: 'Novo Plano' },
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

      <div className="shrink-0 border-t border-border px-2 py-3">
        <Divider className="mb-1" />
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
    <ModuleSidebarShell drawerId="learning-module-sidebar">
      {({ onClose }) => <SidebarBody onClose={onClose} />}
    </ModuleSidebarShell>
  );
}
