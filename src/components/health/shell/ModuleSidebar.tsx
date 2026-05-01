'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { NavItem, Divider } from '@phfront/millennium-ui';
import { ModuleSidebarShell } from '@/components/shell/ModuleSidebarShell';
import { SidebarBrandHeader } from '@/components/shell/SidebarBrandHeader';
import {
  PlusCircle, History, Settings, Home, Scale,
  UtensilsCrossed, Apple, ClipboardList, TrendingUp, SlidersHorizontal,
  ChevronDown, ChevronUp,
  HomeIcon,
  Bell,
  Flame,
} from 'lucide-react';

const WEIGHT_CHILDREN = [
  { href: '/health/peso', icon: <HomeIcon size={18} />, label: 'Início' },
  { href: '/health/log/new', icon: <PlusCircle size={18} />, label: 'Registrar peso' },
  { href: '/health/history', icon: <History size={18} />, label: 'Histórico' },
  { href: '/health/setup', icon: <Settings size={18} />, label: 'Configurar meta' },
];

function isWeightSectionPath(pathname: string) {
  return (
    pathname.startsWith('/health') &&
    !pathname.startsWith('/health/nutrition') &&
    !pathname.startsWith('/health/calorias')
  );
}

const CALORIAS_CHILDREN = [
  { href: '/health/calorias', icon: <HomeIcon size={18} />, label: 'Início' },
  { href: '/health/calorias/history', icon: <History size={18} />, label: 'Histórico' },
  { href: '/health/calorias/settings', icon: <Settings size={18} />, label: 'Configurações' },
];

function isCaloriasSectionPath(pathname: string) {
  return pathname.startsWith('/health/calorias');
}

const NUTRITION_CHILDREN = [
  { href: '/health/nutrition', icon: <HomeIcon size={18} />, label: 'Início' },
  { href: '/health/nutrition/plan', icon: <ClipboardList size={18} />, label: 'Minha Dieta' },
  { href: '/health/nutrition/foods', icon: <Apple size={18} />, label: 'Alimentos' },
  { href: '/health/nutrition/history', icon: <TrendingUp size={18} />, label: 'Tendências' },
  { href: '/health/nutrition/notifications', icon: <Bell size={18} />, label: 'Lembretes' },
  { href: '/health/nutrition/settings', icon: <SlidersHorizontal size={18} />, label: 'Configurações' },
];

function SidebarBody({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const isOnWeight = isWeightSectionPath(pathname);
  const isOnNutrition = pathname.startsWith('/health/nutrition');
  const isOnCalorias = isCaloriasSectionPath(pathname);
  const [weightOpen, setWeightOpen] = useState(isOnWeight);
  const [nutritionOpen, setNutritionOpen] = useState(isOnNutrition);
  const [caloriasOpen, setCaloriasOpen] = useState(isOnCalorias);

  useEffect(() => {
    if (isOnWeight) setWeightOpen(true);
  }, [isOnWeight]);

  useEffect(() => {
    if (isOnNutrition) setNutritionOpen(true);
  }, [isOnNutrition]);

  useEffect(() => {
    if (isOnCalorias) setCaloriasOpen(true);
  }, [isOnCalorias]);

  return (
    <>
      <SidebarBrandHeader onClose={onClose} />

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

        <div
          className={[
            'grid transition-[grid-template-rows] duration-300 ease-out',
            nutritionOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          ].join(' ')}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-0.5 ml-3 pl-3 border-l border-border/50 pt-1">
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
          </div>
        </div>

        {/* Calorias — submenu */}
        <button
          type="button"
          onClick={() => setCaloriasOpen((p) => !p)}
          className={[
            'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
            'transition-[background-color,color] duration-[var(--transition-fast)]',
            isOnCalorias
              ? 'bg-brand-primary/10 text-brand-primary'
              : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
          ].join(' ')}
        >
          <span className={`shrink-0 ${isOnCalorias ? 'text-brand-primary' : ''}`}>
            <Flame size={18} />
          </span>
          <span className="flex-1 truncate text-left">Calorias</span>
          <span className="shrink-0 text-text-muted">
            {caloriasOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        <div
          className={[
            'grid transition-[grid-template-rows] duration-300 ease-out',
            caloriasOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          ].join(' ')}
        >
          <div className="overflow-hidden">
            <div className="ml-3 flex flex-col gap-0.5 border-l border-border/50 pl-3 pt-1">
              {CALORIAS_CHILDREN.map((l) => (
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
          </div>
        </div>

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

        <div
          className={[
            'grid transition-[grid-template-rows] duration-300 ease-out',
            weightOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          ].join(' ')}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-0.5 ml-3 pl-3 border-l border-border/50 pt-1">
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
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-2 py-3">
        <NavItem href="/" icon={<Home size={18} />} label="Voltar ao Portal" isActive={false} onClick={onClose} />
      </div>
    </>
  );
}

export function ModuleSidebar() {
  return (
    <ModuleSidebarShell drawerId="health-module-sidebar">
      {({ onClose }) => <SidebarBody onClose={onClose} />}
    </ModuleSidebarShell>
  );
}
