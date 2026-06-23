'use client';

import { useState, type ReactNode } from 'react';
import { Button, Card, useToast } from '@phfront/millennium-ui';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import {
  downloadHealthBackupJson,
  fetchHealthModuleBackup,
  HEALTH_BACKUP_VERSION,
  summarizeHealthBackup,
  type HealthBackupScope,
} from '@/lib/health/export-backup';
import { Download, Flame, Loader2, Scale, UtensilsCrossed } from 'lucide-react';

type ExportOption = {
  scope: HealthBackupScope;
  title: string;
  description: string;
  icon: ReactNode;
};

const EXPORT_OPTIONS: ExportOption[] = [
  {
    scope: 'peso',
    title: 'Controle de peso',
    description: 'Meta (health_settings) e todos os registros de peso.',
    icon: <Scale className="h-5 w-5" />,
  },
  {
    scope: 'nutricao',
    title: 'Nutrição',
    description: 'Configurações, alimentos personalizados, planos de dieta, histórico e água.',
    icon: <UtensilsCrossed className="h-5 w-5" />,
  },
  {
    scope: 'calorias',
    title: 'Calorias',
    description: 'Meta semanal e histórico de calorias queimadas.',
    icon: <Flame className="h-5 w-5" />,
  },
];

export function HealthExportPanel() {
  const user = useUserStore((s) => s.user);
  const { toast } = useToast();
  const [loadingScope, setLoadingScope] = useState<HealthBackupScope | null>(null);

  async function handleExport(scope: HealthBackupScope) {
    if (!user?.id) {
      toast.error('Sessão inválida', 'Faça login novamente.');
      return;
    }

    setLoadingScope(scope);
    try {
      const supabase = createClient();
      const backup = await fetchHealthModuleBackup(supabase, user.id, scope);
      const summary = summarizeHealthBackup(backup);
      downloadHealthBackupJson(backup);

      const parts: string[] = [];
      if (scope === 'all' || scope === 'peso') parts.push(`${summary.pesoLogs} pesagens`);
      if (scope === 'all' || scope === 'nutricao') {
        parts.push(
          `${summary.nutricaoPlans} plano(s), ${summary.nutricaoDietLogs} refeições registradas, ${summary.nutricaoWaterLogs} registros de água`,
        );
      }
      if (scope === 'all' || scope === 'calorias') parts.push(`${summary.caloriasLogs} registros de calorias`);

      toast.success('Backup exportado', parts.join(' · '));
    } catch (err) {
      toast.error('Erro ao exportar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setLoadingScope(null);
    }
  }

  const isBusy = loadingScope !== null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card className="border-border bg-surface-2/40 p-5">
        <h2 className="text-lg font-semibold text-text-primary">Exportar tudo</h2>
        <p className="mt-1 text-sm text-text-muted">
          Gera um único arquivo JSON com peso, nutrição e calorias. Guarde em nuvem ou disco externo
          para recuperar se perder acesso ao Supabase.
        </p>
        <Button
          className="mt-4"
          size="lg"
          onClick={() => void handleExport('all')}
          disabled={isBusy}
          isLoading={loadingScope === 'all'}
        >
          <Download className="mr-2 h-4 w-4" />
          Baixar backup completo
        </Button>
      </Card>

      <div className="grid gap-4 sm:grid-cols-1">
        {EXPORT_OPTIONS.map((option) => (
          <Card key={option.scope} className="border-border bg-surface-2/40 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-brand-primary">{option.icon}</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-text-primary">{option.title}</h3>
                <p className="mt-1 text-sm text-text-muted">{option.description}</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => void handleExport(option.scope)}
                  disabled={isBusy}
                >
                  {loadingScope === option.scope ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Exportar {option.title.toLowerCase()}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-text-muted">
        Formato: JSON legível (versão {HEALTH_BACKUP_VERSION}). Inclui IDs originais para eventual importação futura.
        Alimentos globais do catálogo não são exportados — apenas os que você criou.
      </p>
    </div>
  );
}
