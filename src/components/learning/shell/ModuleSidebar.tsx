'use client';

import { usePathname } from 'next/navigation';
import { Sidebar, NavItem, Divider } from '@phfront/millennium-ui';
import { BrandLogo } from '@/components/shell/BrandLogo';
import { LayoutDashboard, Target, Home, List } from 'lucide-react';

const NAV_LINKS = [
  { href: '/learning', icon: <LayoutDashboard size={18} />, label: 'Home' },
  { href: '/learning/plans', icon: <List size={18} />, label: 'Lista de Planos' },
];

export function ModuleSidebar() {
  const pathname = usePathname();

  const logo = <BrandLogo size={32} />;

  const links = NAV_LINKS.map((l) => ({
    ...l,
    isActive: pathname === l.href,
  }));

  const footer = (
    <div className="flex flex-col gap-1">
      <Divider />
      <NavItem href="/" icon={<Home size={18} />} label="Voltar ao Portal" isActive={false} />
    </div>
  );

  return (
    <Sidebar
      logo={logo}
      links={links}
      footer={footer}
      className="hidden md:flex"
    />
  );
}
