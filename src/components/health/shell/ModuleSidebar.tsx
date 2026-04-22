'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { NavItem, Divider } from '@phfront/millennium-ui';
import { BrandLogo } from '@/components/shell/BrandLogo';
import { useMobileSidebar } from './MobileSidebarContext';
import {
  PlusCircle, History, Settings, Home, Scale,
  UtensilsCrossed, Apple, ClipboardList, TrendingUp, SlidersHorizontal,
  ChevronDown, ChevronUp, X,
  HomeIcon,
  Bell,
} from 'lucide-react';

const WEIGHT_CHILDREN = [
  { href: '/health/peso', icon: <HomeIcon size={18} />, label: 'Início' },
  { href: '/health/log/new', icon: <PlusCircle size={18} />, label: 'Registrar peso' },
  { href: '/health/history', icon: <History size={18} />, label: 'Histórico' },
  { href: '/health/setup', icon: <Settings size={18} />, label: 'Configurar meta' },
];

function isWeightSectionPath(pathname: string) {
  return pathname.startsWith('/health') && !pathname.startsWith('/health/nutrition');
}

const NUTRITION_CHILDREN = [
  { href: '/health/nutrition', icon: <HomeIcon size={18} />, label: 'Início' },
  { href: '/health/nutrition/plan', icon: <ClipboardList size={18} />, label: 'Minha Dieta' },
  { href: '/health/nutrition/foods', icon: <Apple size={18} />, label: 'Alimentos' },
  { href: '/health/nutrition/history', icon: <TrendingUp size={18} />, label: 'Tendências' },
  { href: '/health/nutrition/notifications', icon: <Bell size={18} />, label: 'Lembretes' },
  { href: '/health/nutrition/settings', icon: <SlidersHorizontal size={18} />, label: 'Configurações' },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const isOnWeight = isWeightSectionPath(pathname);
  const isOnNutrition = pathname.startsWith('/health/nutrition');
  const [weightOpen, setWeightOpen] = useState(isOnWeight);
  const [nutritionOpen, setNutritionOpen] = useState(isOnNutrition);

  useEffect(() => {
    if (isOnWeight) setWeightOpen(true);
  }, [isOnWeight]);

  useEffect(() => {
    if (isOnNutrition) setNutritionOpen(true);
  }, [isOnNutrition]);

  return (
    <>
      {/* Logo header */}
      <div className="flex items-center h-16 px-4 border-b border-border gap-3 shrink-0">
        <span className="shrink-0"><BrandLogo size={32} /></span>
        <span className="font-bold text-text-primary truncate flex-1 text-sm">Nexus</span>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer md:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav body */}
      <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-1">
        {/* Nutrição — submenu */}
        <button
          type="button"
          onClick={() => setNutritionOpen((p) => !p)}
          className={[
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium cursor-pointer w-full',
            'transition-[background-color,color] duration-[var(--transition-fast)]',
            isOnNutrition
              ? 'bg-brand-primary/10 text-brand-primary'
              : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
          ].join(' ')}
        >
          <span className={`shrink-0 ${isOnNutrition ? 'text-brand-primary' : ''}`}>
            <UtensilsCrossed size={18} />
          </span>
          <span className="truncate flex-1 text-left">Nutrição</span>
          <span className="shrink-0 text-text-muted">
            {nutritionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {nutritionOpen && (
          <div className="flex flex-col gap-0.5 ml-3 pl-3 border-l border-border/50">
            {NUTRITION_CHILDREN.map((l) => (
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
        )}

        <Divider className="my-2" />

        {/* Controle de peso — submenu */}
        <button
          type="button"
          onClick={() => setWeightOpen((p) => !p)}
          className={[
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium cursor-pointer w-full',
            'transition-[background-color,color] duration-[var(--transition-fast)]',
            isOnWeight
              ? 'bg-brand-primary/10 text-brand-primary'
              : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
          ].join(' ')}
        >
          <span className={`shrink-0 ${isOnWeight ? 'text-brand-primary' : ''}`}>
            <Scale size={18} />
          </span>
          <span className="truncate flex-1 text-left">Controle de peso</span>
          <span className="shrink-0 text-text-muted">
            {weightOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {weightOpen && (
          <div className="flex flex-col gap-0.5 ml-3 pl-3 border-l border-border/50">
            {WEIGHT_CHILDREN.map((l) => (
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
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-2 py-3">
        <NavItem href="/" icon={<Home size={18} />} label="Voltar ao Portal" isActive={false} onClick={onClose} />
      </div>
    </>
  );
}

export function ModuleSidebar() {
  const { isOpen, close } = useMobileSidebar();

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        aria-label="Navegação principal"
        className="hidden md:flex flex-col bg-surface-2 border-r border-border h-full w-60 shrink-0"
      >
        <SidebarContent />
      </nav>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />
          {/* Panel */}
          <nav
            id="health-module-sidebar"
            aria-label="Navegação principal"
            className="relative flex flex-col bg-surface-2 h-full w-72 max-w-[85vw] shadow-2xl"
          >
            <SidebarContent onClose={close} />
          </nav>
        </div>
      )}
    </>
  );
}
