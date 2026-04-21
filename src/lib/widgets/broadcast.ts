export const DASHBOARD_WIDGETS_CHANNEL = 'dashboard-widgets-channel';
export const DASHBOARD_WIDGETS_UPDATED_EVENT = 'dashboard-widgets-updated';

export type DashboardWidgetsBroadcastMessage = {
  type: typeof DASHBOARD_WIDGETS_UPDATED_EVENT;
  userId: string;
  at: number;
};

export function createDashboardWidgetsBroadcastChannel() {
  if (typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined') {
    return null;
  }
  return new BroadcastChannel(DASHBOARD_WIDGETS_CHANNEL);
}
