/** Disparado após reduzir «meses à frente» e remover linhas futuras extra na BD. */
export const PLANNING_HORIZON_CHANGED_EVENT = 'nexus-inflow:planning-horizon-changed';

export function emitPlanningHorizonChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PLANNING_HORIZON_CHANGED_EVENT));
}
