'use client';

import { usePathname } from 'next/navigation';
import { Sidebar, NavItem, Divider } from '@phfront/millennium-ui';
import { BrandLogo } from '@/components/shell/BrandLogo';
import { LayoutDashboard, History, Target, Bell, Home } from 'lucide-react';

const NAV_LINKS = [
  { href: '/daily-goals', icon: <LayoutDashboard size={18} />, label: 'Hoje' },
  { href: '/daily-goals/history', icon: <History size={18} />, label: 'Histórico' },
  { href: '/daily-goals/config', icon: <Target size={18} />, label: 'Metas' },
  { href: '/daily-goals/notifications', icon: <Bell size={18} />, label: 'Notificações' },
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
