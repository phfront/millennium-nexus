import type { Module } from '@/types/database';

export type HomeModuleSlug = 'finance' | 'health' | 'habits-goals';

export const HOME_MODULE_OPTIONS: Array<{ value: HomeModuleSlug; label: string; description: string }> = [
  {
    value: 'finance',
    label: 'Finance',
    description: 'Abrir o dashboard financeiro como home principal.',
  },
  {
    value: 'health',
    label: 'Health',
    description: 'Abrir a área de saúde e controle de peso como home principal.',
  },
  {
    value: 'habits-goals',
    label: 'Hábitos e Metas',
    description: 'Abrir o painel diário de metas como home principal.',
  },
];

export function isHomeModuleSlug(value: string | null | undefined): value is HomeModuleSlug {
  return value === 'finance' || value === 'health' || value === 'habits-goals';
}

export function getHomeModuleHref(moduleSlug: HomeModuleSlug): string {
  switch (moduleSlug) {
    case 'finance':
      return '/finance';
    case 'health':
      return '/health';
    case 'habits-goals':
      return '/habits-goals';
  }
}

export function getAvailableHomeModuleOptions(modules: Module[]) {
  const allowedSlugs = new Set(modules.map((module) => module.slug));
  return HOME_MODULE_OPTIONS.filter((option) => allowedSlugs.has(option.value));
}
