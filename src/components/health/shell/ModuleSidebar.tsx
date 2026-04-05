'use client';

import { usePathname } from 'next/navigation';
import { Sidebar, NavItem, Divider } from '@phfront/millennium-ui';
import { BrandLogo } from '@/components/shell/BrandLogo';
import { LayoutDashboard, PlusCircle, History, Settings, Home } from 'lucide-react';

const NAV_LINKS = [
  { href: '/health', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { href: '/health/log/new', icon: <PlusCircle size={18} />, label: 'Registrar peso' },
  { href: '/health/history', icon: <History size={18} />, label: 'Histórico' },
  { href: '/health/setup', icon: <Settings size={18} />, label: 'Configurar meta' },
];

export function ModuleSidebar() {
  const pathname = usePathname();

  const logo = <BrandLogo size={32} />;

  const links = NAV_LINKS.map((l) => ({ ...l, isActive: pathname === l.href }));

  const footer = (
    <div className="flex flex-col gap-1">
      <Divider />
      <NavItem href="/" icon={<Home size={18} />} label="Voltar ao Portal" isActive={false} />
    </div>
  );

  return (
    <Sidebar logo={logo} links={links} footer={footer} className="hidden md:flex" />
  );
}
