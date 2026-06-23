'use client';

import { useState } from 'react';
import { Button, Card, useToast } from '@phfront/millennium-ui';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import {
  downloadFinanceBackupJson,
  fetchFinanceModuleBackup,
  FINANCE_BACKUP_VERSION,
  summarizeFinanceBackup,
} from '@/lib/finance/export-backup';
import { Download } from 'lucide-react';

export function FinanceExportPanel() {
  const user = useUserStore((s) => s.user);
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (!user?.id) {
      toast.error('Sessão inválida', 'Faça login novamente.');
      return;
    }

    setIsExporting(true);
    try {
      const supabase = createClient();
      const backup = await fetchFinanceModuleBackup(supabase, user.id);
      const s = summarizeFinanceBackup(backup);
      downloadFinanceBackupJson(backup);

      toast.success(
        'Backup exportado',
        [
          `${s.incomeSources} fontes, ${s.incomeEntries} receitas`,
          `${s.expenseItems} despesas fixas, ${s.expenseEntries} lançamentos`,
          `${s.oneTimeEntries} pontuais, ${s.subscriptions} assinaturas, ${s.receivables} cobranças`,
          `${s.closedMonths} meses no histórico (${s.historyLines} linhas congeladas)`,
        ].join(' · '),
      );
    } catch (err) {
      toast.error('Erro ao exportar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card className="border-border bg-surface-2/40 p-5">
        <h2 className="text-lg font-semibold text-text-primary">Backup completo</h2>
        <p className="mt-1 text-sm text-text-muted">
          Inclui configurações, planilhas atuais (receitas, despesas, pontuais), assinaturas,
          cobranças e o histórico de meses fechados com todos os lançamentos congelados.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-text-secondary">
          <li>Receitas: fontes + entradas mensais</li>
          <li>Despesas: categorias, itens + entradas mensais</li>
          <li>Lançamentos pontuais (despesa e receita)</li>
          <li>Assinaturas e cobranças a terceiros</li>
          <li>Histórico: totais mensais + detalhe linha a linha</li>
        </ul>
        <Button
          className="mt-4"
          size="lg"
          onClick={() => void handleExport()}
          disabled={isExporting}
          isLoading={isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          Baixar backup financeiro
        </Button>
      </Card>

      <p className="text-xs text-text-muted">
        Formato: JSON legível (versão {FINANCE_BACKUP_VERSION}). Mantém IDs originais para eventual
        importação futura.
      </p>
    </div>
  );
}
