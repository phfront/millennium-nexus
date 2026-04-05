'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Receipt, CreditCard, Wallet, ArrowRight, ListChecks } from 'lucide-react';
import { Skeleton, Button, StatCard, MonthStepper, type StatCardValueTone } from '@phfront/millennium-ui';
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

export function MonthlyDashboard() {
  const [month, setMonth] = useState(() => toMonthDate(new Date()));
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
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

  return (
    <div className="flex flex-col gap-6">
      {/* Header com seletor de mês */}
      <div className="flex items-center justify-between">
        <MonthStepper
          label={formatMonthLabel(month)}
          onPrev={() => setMonth(getPreviousMonth(month))}
          onNext={() => setMonth(getNextMonth(month))}
          disableNext={month >= maxPlanningMonth}
        />
      </div>

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
              <span className="text-xs text-text-muted">{progress.paid} de {progress.total} pagos</span>
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
              <p className="text-base font-semibold text-text-primary">{formatBRL(subsTotal)}<span className="text-xs text-text-muted font-normal">/mês</span></p>
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
