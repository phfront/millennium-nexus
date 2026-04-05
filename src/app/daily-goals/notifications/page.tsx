'use client';

import { Bell, BellOff } from 'lucide-react';
import { PageHeader, Button, Alert, Skeleton } from '@phfront/millennium-ui';
import { NotificationConfig } from '@/components/daily-goals/features/notification-config/notification-config';
import { useTrackers } from '@/hooks/daily-goals/use-trackers';
import { usePushSubscription } from '@/hooks/daily-goals/use-push-subscription';

export default function NotificationsPage() {
  const { trackers, isLoading } = useTrackers(true);
  const { isSubscribed, isLoading: pushLoading, permission, isPushSupported, subscribe, unsubscribe } = usePushSubscription();

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <PageHeader
        title="Notificações"
        subtitle="Configure lembretes inteligentes para cada meta."
      />

      {/* Push permission card */}
      <div className="flex flex-col gap-3 p-4 bg-surface-2 rounded-xl border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSubscribed ? (
              <Bell size={18} className="text-success" />
            ) : (
              <BellOff size={18} className="text-text-muted" />
            )}
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {isSubscribed ? 'Notificações ativas' : 'Notificações desativadas'}
              </p>
              <p className="text-xs text-text-muted">
                {isSubscribed ? 'Você receberá alertas no dispositivo.' : 'Ative para receber lembretes.'}
              </p>
            </div>
          </div>
          {isPushSupported && (
            <Button
              variant={isSubscribed ? 'ghost' : 'primary'}
              size="sm"
              disabled={pushLoading}
              onClick={isSubscribed ? unsubscribe : subscribe}
            >
              {isSubscribed ? 'Desativar' : 'Ativar'}
            </Button>
          )}
        </div>

        {permission === 'denied' && (
          <Alert variant="warning">
            Permissão de notificação bloqueada no navegador. Acesse as configurações do navegador para ativar.
          </Alert>
        )}
        {!isPushSupported && (
          <Alert variant="info">
            Seu navegador não suporta notificações push.
          </Alert>
        )}
      </div>

      {/* Per-tracker configs */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => <Skeleton key={i} variant="block" className="h-24 w-full" />)}
        </div>
      ) : trackers.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">
          Nenhuma meta ativa. Crie metas primeiro para configurar notificações.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {trackers.map((tracker) => (
            <NotificationConfig key={tracker.id} tracker={tracker} />
          ))}
        </div>
      )}
    </div>
  );
}
