'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, LayoutGrid, Plus } from 'lucide-react';
import { Button, EmptyState, Skeleton } from '@phfront/millennium-ui';
import { useDashboardWidgets } from '@/hooks/widgets/use-dashboard-widgets';
import { useActiveBreakpoint } from '@/hooks/ui/use-active-breakpoint';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { HabitsGoalsTodayLogsProvider } from '@/components/widgets/HabitsGoalsTodayLogsProvider';
import type { DashboardWidgetBreakpoint } from '@/types/database';
import {
  createDashboardWidgetsBroadcastChannel,
  DASHBOARD_WIDGETS_UPDATED_EVENT,
  type DashboardWidgetsBroadcastMessage,
} from '@/lib/widgets/broadcast';
import { useUserStore } from '@/store/user-store';

type WidgetDashboardClientProps = {
  allowedModuleSlugs: string[];
};

const BREAKPOINT_LABEL: Record<DashboardWidgetBreakpoint, string> = {
  lg: 'Desktop',
  md: 'Tablet',
  sm: 'Mobile',
};

export function WidgetDashboardClient({ allowedModuleSlugs }: WidgetDashboardClientProps) {
  const user = useUserStore((s) => s.user);
  const breakpoint = useActiveBreakpoint();
  const { isLoading, error, getVisibleWidgetKeys, layouts, refetch } = useDashboardWidgets({
    allowedModuleSlugs,
  });
  const [gridVersion, setGridVersion] = useState(0);
  const visibleWidgetKeys = getVisibleWidgetKeys(breakpoint);

  useEffect(() => {
    if (!user) return;
    const channel = createDashboardWidgetsBroadcastChannel();
    if (!channel) return;

    const onMessage = (event: MessageEvent<DashboardWidgetsBroadcastMessage>) => {
      const data = event.data;
      if (!data || data.type !== DASHBOARD_WIDGETS_UPDATED_EVENT) return;
      if (data.userId !== user.id) return;
      void refetch();
      setGridVersion((v) => v + 1);
    };

    channel.addEventListener('message', onMessage);
    return () => {
      channel.removeEventListener('message', onMessage);
      channel.close();
    };
  }, [refetch, user]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton variant="block" className="h-44 w-full" />
        <Skeleton variant="block" className="h-44 w-full" />
        <Skeleton variant="block" className="h-56 w-full md:col-span-2" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        className="py-12"
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Nao foi possivel carregar os widgets"
        description={error}
      />
    );
  }

  if (visibleWidgetKeys.length === 0) {
    return (
      <EmptyState
        className="py-12"
        icon={<LayoutGrid className="h-5 w-5" />}
        title="Nenhum widget visivel"
        description="Adicione widgets para montar sua home personalizada."
        action={
          <Link href="/widgets/edit">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Adicionar Widgets</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <HabitsGoalsTodayLogsProvider>
        <WidgetGrid
          key={`${breakpoint}-${gridVersion}`}
          widgetKeys={visibleWidgetKeys}
          layouts={layouts}
          breakpoint={breakpoint}
        />
      </HabitsGoalsTodayLogsProvider>

      <div className="flex justify-end items-center gap-2">
        <Link href="/widgets/edit">
          <Button variant="outline">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Editar Widgets
          </Button>
        </Link>
      </div>
    </div>
  );
}
