import type { DashboardWidgetBreakpoint } from '@/types/database';

export type DashboardWidgetKey =
  | 'health_nutrition'
  | 'health_nutrition_summary'
  | 'health_meals'
  | 'health_calorias'
  | 'health_calorias_week'
  | 'daily_goals_summary'
  | 'daily_goals_carousel';

export type DashboardWidgetCatalogItem = {
  key: DashboardWidgetKey;
  title: string;
  description: string;
  moduleSlug: string;
  defaultVisible: boolean;
  defaultPosition: number;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
  defaultW: Record<DashboardWidgetBreakpoint, number>;
  defaultH: Record<DashboardWidgetBreakpoint, number>;
};

export const DASHBOARD_BREAKPOINTS: DashboardWidgetBreakpoint[] = ['lg', 'md', 'sm'];

export const DASHBOARD_COLUMNS: Record<DashboardWidgetBreakpoint, number> = {
  lg: 3,
  md: 2,
  sm: 1,
};

export const DASHBOARD_WIDGET_CATALOG: DashboardWidgetCatalogItem[] = [
  {
    key: 'health_nutrition',
    title: 'Hidratação',
    description: 'Acompanhamento rapido de hidratacao.',
    moduleSlug: 'health',
    defaultVisible: true,
    defaultPosition: 0,
    minW: 1,
    minH: 1,
    maxW: 3,
    maxH: 4,
    defaultW: { lg: 1, md: 1, sm: 1 },
    defaultH: { lg: 1, md: 1, sm: 1 },
  },
  {
    key: 'health_nutrition_summary',
    title: 'Resumo do dia',
    description: 'Calorias do plano, buffer semanal e macros (proteina, carbo, gordura).',
    moduleSlug: 'health',
    defaultVisible: true,
    defaultPosition: 1,
    minW: 1,
    minH: 1,
    maxW: 3,
    maxH: 4,
    defaultW: { lg: 2, md: 2, sm: 1 },
    defaultH: { lg: 1, md: 1, sm: 1 },
  },
  {
    key: 'health_meals',
    title: 'Refeicoes',
    description: 'Controle rapido das refeicoes do dia.',
    moduleSlug: 'health',
    defaultVisible: true,
    defaultPosition: 2,
    minW: 1,
    minH: 1,
    maxW: 3,
    maxH: 5,
    defaultW: { lg: 2, md: 2, sm: 1 },
    defaultH: { lg: 3, md: 3, sm: 3 },
  },
  {
    key: 'health_calorias',
    title: 'Calorias',
    description: 'Registo rapido de calorias, meta do dia e totais da semana.',
    moduleSlug: 'health',
    defaultVisible: false,
    defaultPosition: 5,
    minW: 1,
    minH: 1,
    maxW: 3,
    maxH: 4,
    defaultW: { lg: 1, md: 1, sm: 1 },
    defaultH: { lg: 1, md: 1, sm: 1 },
  },
  {
    key: 'health_calorias_week',
    title: 'Esta semana — calorias',
    description: 'Grelha da semana com metas, rollover e toque em dias passados.',
    moduleSlug: 'health',
    defaultVisible: false,
    defaultPosition: 6,
    minW: 1,
    minH: 1,
    maxW: 3,
    maxH: 4,
    defaultW: { lg: 3, md: 2, sm: 1 },
    defaultH: { lg: 1, md: 1, sm: 1 },
  },
  {
    key: 'daily_goals_summary',
    title: 'Hábitos & Metas — Resumo',
    description: 'Metas de hoje (todos os períodos): progresso, pontos e streak.',
    moduleSlug: 'habits-goals',
    defaultVisible: true,
    defaultPosition: 3,
    minW: 1,
    minH: 1,
    maxW: 3,
    maxH: 3,
    defaultW: { lg: 1, md: 1, sm: 1 },
    defaultH: { lg: 1, md: 1, sm: 1 },
  },
  {
    key: 'daily_goals_carousel',
    title: 'Hábitos & Metas — Carrossel',
    description: 'Carrossel de metas (diária, semanal, mensal, personalizada) com marcação rápida.',
    moduleSlug: 'habits-goals',
    defaultVisible: true,
    defaultPosition: 4,
    minW: 1,
    minH: 1,
    maxW: 3,
    maxH: 4,
    defaultW: { lg: 3, md: 2, sm: 1 },
    defaultH: { lg: 2, md: 2, sm: 2 },
  },
];

export const DASHBOARD_WIDGET_BY_KEY = new Map(
  DASHBOARD_WIDGET_CATALOG.map((item) => [item.key, item]),
);
