'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Receipt,
  CreditCard,
  Wallet,
  ArrowRight,
  ListChecks,
  CheckCircle2,
  Unlock,
} from 'lucide-react';
import {
  Skeleton,
  Button,
  StatCard,
  MonthStepper,
  Modal,
  useToast,
  type StatCardValueTone,
} from '@phfront/millennium-ui';
import { SurplusChart } from '@/components/finance/features/surplus-chart/SurplusChart';
import { useMonthlySummary } from '@/hooks/finance/use-monthly-summary';
import { useExpenses } from '@/hooks/finance/use-expenses';
import { useOneTime } from '@/hooks/finance/use-one-time';
import { useSubscriptions } from '@/hooks/finance/use-subscriptions';
import { useReceivables } from '@/hooks/finance/use-receivables';
import {
  expenseEntriesForMonth,
  getNextMonth,
  getPreviousMonth,
  paymentProgress,
  toMonthDate,
} from '@/lib/finance/finance';
import { MonthPaymentsModal } from '@/components/finance/features/monthly-dashboard/MonthPaymentsModal';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import { formatBRL, formatMonthLabel } from '@/lib/finance/format';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';

export function MonthlyDashboard() {
  const user = useUserStore((s) => s.user);
  const { toast } = useToast();
  const [month, setMonth] = useState(() => toMonthDate(new Date()));
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [currentMonthConcluded, setCurrentMonthConcluded] = useState(false);
  const [loadingConcluded, setLoadingConcluded] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [reopening, setReopening] = useState(false);

  const { maxPlanningMonth } = useFinanceSpreadsheetSettings();
  const {
    summaries,
    isLoading: loadingSummary,
    getSummaryForMonth,
    refetch: refetchMonthlySummary,
  } = useMonthlySummary();

  useEffect(() => {
    if (month > maxPlanningMonth) setMonth(maxPlanningMonth);
  }, [month, maxPlanningMonth]);
  const {
    entries,
    isLoading: loadingExpenses,
    activeItems,
    categories,
    getEntry,
    getEffectiveExpenseAmount,
    upsertEntry,
    togglePaid,
  } = useExpenses();
  const {
    isLoading: loadingOneTime,
    getForMonth,
    upsertExpense: upsertOneTimeExpense,
    togglePaid: toggleOneTimePaid,
  } = useOneTime();
  const { monthlyTotal: subsTotal, isLoading: loadingSubs } = useSubscriptions();
  const { getPendingTotal, isLoading: loadingRec } = useReceivables();

  const summary = getSummaryForMonth(month);
  const monthEntries = expenseEntriesForMonth(entries, month);
  const oneTimeForMonth = getForMonth(month);
  const progress = paymentProgress(monthEntries, oneTimeForMonth);
  const loadingPayments = loadingExpenses || loadingOneTime;
  const isLoading = loadingSummary || loadingExpenses;

  const surplusTone: StatCardValueTone =
    summary && summary.surplus > 0
      ? 'positive'
      : summary && summary.surplus < 0
        ? 'negative'
        : 'muted';
  const accumulatedTone: StatCardValueTone =
    summary && summary.accumulated_surplus >= 0 ? 'positive' : 'negative';

  const currentMonth = toMonthDate(new Date());
  const isCurrentMonth = month === currentMonth;
  const pendingPayments =
    progress.total > 0 ? Math.max(0, progress.total - progress.paid) : 0;

  const refreshMonthConcluded = useCallback(async () => {
    if (!user?.id || !isCurrentMonth) {
      setCurrentMonthConcluded(false);
      return;
    }
    setLoadingConcluded(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('finance_month_snapshots')
        .select('month')
        .eq('user_id', user.id)
        .eq('month', month)
        .maybeSingle();
      setCurrentMonthConcluded(!!data);
    } finally {
      setLoadingConcluded(false);
    }
  }, [user?.id, isCurrentMonth, month]);

  useEffect(() => {
    void refreshMonthConcluded();
  }, [refreshMonthConcluded]);

  async function handleConfirmCompleteMonth() {
    setConcluding(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('finance_complete_finance_month', {
        p_month: month,
      });
      if (error) {
        toast.error(error.message ?? 'Não foi possível concluir o mês.');
        return;
      }
      setCompleteModalOpen(false);
      setCurrentMonthConcluded(true);
      toast.success('Mês concluído. Totais e lançamentos foram arquivados.');
    } finally {
      setConcluding(false);
    }
  }

  async function handleConfirmReopenMonth() {
    setReopening(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('finance_reopen_month', {
        p_month: month,
      });
      if (error) {
        toast.error(error.message ?? 'Não foi possível reabrir o mês.');
        return;
      }
      setReopenModalOpen(false);
      setCurrentMonthConcluded(false);
      toast.success('Mês reaberto. Podes voltar a editar receitas e despesas.');
    } finally {
      setReopening(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header com seletor de mês */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <MonthStepper
          label={formatMonthLabel(month)}
          onPrev={() => setMonth(getPreviousMonth(month))}
          onNext={() => setMonth(getNextMonth(month))}
          disableNext={month >= maxPlanningMonth}
        />
        {isCurrentMonth && !loadingConcluded && !currentMonthConcluded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCompleteModalOpen(true)}
            leftIcon={<CheckCircle2 size={14} />}
            className="shrink-0 text-text-muted"
          >
            Concluir mês
          </Button>
        )}
      </div>

      {isCurrentMonth && currentMonthConcluded && (
        <div className="rounded-xl border border-border bg-surface-2 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500 shrink-0" />
              Mês concluído
            </p>
            <p className="text-xs text-text-muted mt-1">
              Os totais e lançamentos deste mês estão arquivados. Vê o detalhe em{' '}
              <Link href="/finance/history" className="underline hover:text-text-primary">
                Histórico
              </Link>
              .
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReopenModalOpen(true)}
            leftIcon={<Unlock size={14} />}
            className="shrink-0 self-start sm:self-center"
          >
            Reabrir mês
          </Button>
        </div>
      )}

      <Modal
        isOpen={completeModalOpen}
        onClose={() => !concluding && setCompleteModalOpen(false)}
        title="Concluir o mês?"
        size="md"
      >
        <>
          <div className="flex flex-col gap-3 text-sm text-text-secondary">
            <p>
              Vamos arquivar os totais e todos os lançamentos (receitas, despesas fixas e pontuais)
              com os nomes e valores atuais. Depois podes reabrir o mês se precisares corrigir algo.
            </p>
            {pendingPayments > 0 && (
              <div
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-amber-800 dark:text-amber-200 text-xs leading-relaxed"
                role="status"
              >
                <strong className="font-semibold">Atenção:</strong> ainda tens{' '}
                <strong>{pendingPayments}</strong> de <strong>{progress.total}</strong> despesas com
                valor neste mês por marcar como pagas. Podes concluir na mesma; o arquivo reflecte o
                estado atual (pago ou pendente).
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-5 mt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCompleteModalOpen(false)}
              disabled={concluding}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              isLoading={concluding}
              onClick={() => void handleConfirmCompleteMonth()}
            >
              Concluir mês
            </Button>
          </div>
        </>
      </Modal>

      <Modal
        isOpen={reopenModalOpen}
        onClose={() => !reopening && setReopenModalOpen(false)}
        title="Reabrir o mês?"
        size="md"
      >
        <>
          <p className="text-sm text-text-secondary">
            Isto remove o arquivo deste mês na tua conta. Voltas a poder editar receitas e despesas na
            planilha; a linha deste mês deixa de aparecer no histórico até concluíres de novo.
          </p>
          <div className="flex justify-end gap-2 pt-5 mt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReopenModalOpen(false)}
              disabled={reopening}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={reopening}
              onClick={() => void handleConfirmReopenMonth()}
            >
              Reabrir mês
            </Button>
          </div>
        </>
      </Modal>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Receitas"
          value={formatBRL(summary?.total_income ?? 0)}
          isLoading={isLoading}
          valueTone="positive"
          valueSize="md"
          icon={<TrendingUp size={16} />}
        />
        <StatCard
          label="Despesas"
          value={formatBRL((summary?.total_expenses ?? 0) + (summary?.total_one_time ?? 0))}
          isLoading={isLoading}
          valueTone="negative"
          valueSize="md"
          icon={<CreditCard size={16} />}
        />
        <StatCard
          label="Sobra"
          value={formatBRL(summary?.surplus ?? 0)}
          isLoading={isLoading}
          valueTone={surplusTone}
          valueSize="md"
          icon={<Wallet size={16} />}
        />
        <StatCard
          label="Acumulado"
          value={formatBRL(summary?.accumulated_surplus ?? 0)}
          isLoading={isLoading}
          valueTone={accumulatedTone}
          valueSize="md"
          sub="total histórico"
        />
      </div>

      {/* Barra de progresso de pagamentos */}
      <div className="bg-surface-2 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <span className="text-sm font-medium text-text-primary">Pagamentos do mês</span>
          <div className="flex items-center gap-2">
            {loadingPayments ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span className="text-xs text-text-muted">
                {progress.paid} de {progress.total} pagos
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loadingPayments}
              onClick={() => setPaymentsModalOpen(true)}
              leftIcon={<ListChecks size={14} />}
              className="shrink-0"
            >
              Detalhes
            </Button>
          </div>
        </div>
        {loadingPayments ? (
          <Skeleton className="h-2 w-full rounded-full" />
        ) : (
          <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        )}
        {!loadingPayments && (
          <p className="text-xs text-text-muted mt-1">{progress.percent}% concluído</p>
        )}
      </div>

      <MonthPaymentsModal
        isOpen={paymentsModalOpen}
        onClose={() => setPaymentsModalOpen(false)}
        month={month}
        categories={categories}
        activeItems={activeItems}
        getEntry={getEntry}
        getEffectiveExpenseAmount={getEffectiveExpenseAmount}
        upsertEntry={upsertEntry}
        togglePaid={togglePaid}
        oneTimeForMonth={oneTimeForMonth}
        upsertOneTime={(id, name, monthKey, amount) =>
          upsertOneTimeExpense(name, monthKey, amount, id)
        }
        toggleOneTimePaid={toggleOneTimePaid}
        onDataChanged={() => {
          void refetchMonthlySummary();
        }}
      />

      {/* Gráfico visão mensal */}
      <div className="bg-surface-2 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-1">Fluxo e acumulado</h3>
        {loadingSummary ? (
          <Skeleton className="h-[340px] w-full mt-2" />
        ) : summaries.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-text-muted mt-2">
            Nenhum dado disponível ainda.
          </div>
        ) : (
          <SurplusChart summaries={summaries} />
        )}
      </div>

      {/* Resumos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/finance/subscriptions"
          className="flex items-center justify-between bg-surface-2 border border-border rounded-xl p-4 hover:bg-surface-3 transition-colors cursor-pointer"
        >
          <div>
            <p className="text-xs text-text-muted mb-1">Assinaturas ativas</p>
            {loadingSubs ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <p className="text-base font-semibold text-text-primary">
                {formatBRL(subsTotal)}
                <span className="text-xs text-text-muted font-normal">/mês</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 text-text-muted">
            <Receipt size={16} />
            <ArrowRight size={14} />
          </div>
        </Link>
        <Link
          href="/finance/receivables"
          className="flex items-center justify-between bg-surface-2 border border-border rounded-xl p-4 hover:bg-surface-3 transition-colors cursor-pointer"
        >
          <div>
            <p className="text-xs text-text-muted mb-1">Cobranças pendentes</p>
            {loadingRec ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <p className="text-base font-semibold text-text-primary">{formatBRL(getPendingTotal())}</p>
            )}
          </div>
          <div className="flex items-center gap-1 text-text-muted">
            <Wallet size={16} />
            <ArrowRight size={14} />
          </div>
        </Link>
      </div>
    </div>
  );
}
