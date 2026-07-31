'use client';

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
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
import {
  MonthBreakdownModal,
  type BreakdownSection,
} from '@/components/finance/features/monthly-dashboard/MonthBreakdownModal';
import {
  SurplusAllocationModal,
  type InvestmentTarget,
} from '@/components/finance/features/monthly-dashboard/SurplusAllocationModal';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import { formatMonthLabel } from '@/lib/finance/format';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';
import { useIncome } from '@/hooks/finance/use-income';
import { useCurrencyConversion } from '@/hooks/finance/use-currency-conversion';
import { incomeEntryCurrency } from '@/types/finance';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { useInitialFinanceMonth } from '@/hooks/finance/use-initial-finance-month';

export function MonthlyDashboard() {
  const user = useUserStore((s) => s.user);
  const money = useMoneyFormat();
  const { toast } = useToast();
  const { maxPlanningMonth } = useFinanceSpreadsheetSettings();
  const [month, setMonth] = useInitialFinanceMonth(maxPlanningMonth);
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [breakdownKind, setBreakdownKind] = useState<'income' | 'expense' | null>(null);
  const [surplusModalOpen, setSurplusModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [currentMonthConcluded, setCurrentMonthConcluded] = useState(false);
  const [loadingConcluded, setLoadingConcluded] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [reopening, setReopening] = useState(false);

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
    items: expenseItems,
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
  const {
    sources: incomeSources,
    entries: incomeEntries,
    isLoading: loadingIncome,
  } = useIncome();
  const { convert } = useCurrencyConversion();
  const { monthlyTotal: subsTotal, isLoading: loadingSubs } = useSubscriptions();
  const { getPendingTotal, isLoading: loadingRec } = useReceivables();

  const summary = getSummaryForMonth(month);
  const monthEntries = expenseEntriesForMonth(entries, month);
  const oneTimeForMonth = getForMonth(month);
  const progress = paymentProgress(monthEntries, oneTimeForMonth);
  const loadingPayments = loadingExpenses || loadingOneTime;
  const isLoading = loadingSummary || loadingExpenses || loadingIncome;

  const totalIncome = summary?.total_income ?? 0;
  const totalExpenses = (summary?.total_expenses ?? 0) + (summary?.total_one_time ?? 0);

  /**
   * Detalhe dos cartões. Espelha exatamente o que a view soma — só lançamentos
   * que existem na BD, sem preencher com o valor padrão da fonte/item — para o
   * modal nunca divergir do número do cartão.
   */
  function buildIncomeSections(): BreakdownSection[] {
    const rows = incomeEntries
      .filter((e) => e.month === month)
      .map((e) => {
        const source = incomeSources.find((s) => s.id === e.source_id);
        const raw = Number(e.amount ?? 0);
        const entryCurrency = source
          ? incomeEntryCurrency(source, month, money.currency)
          : money.currency;
        const isForeign = entryCurrency !== money.currency;
        return {
          key: e.id,
          label: source?.name ?? 'Fonte removida',
          amount: convert(raw, entryCurrency),
          nativeAmount: isForeign ? raw : undefined,
          nativeCurrency: isForeign ? entryCurrency : undefined,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const oneTime = oneTimeForMonth
      .filter((e) => e.flow === 'income')
      .map((e) => ({
        key: e.id,
        label: e.name,
        amount: Number(e.amount ?? 0),
        isPaid: e.is_paid,
      }))
      .sort((a, b) => b.amount - a.amount);

    return [
      { key: 'sources', label: 'Fontes de renda', rows },
      { key: 'one-time', label: 'Receitas pontuais', rows: oneTime },
    ];
  }

  function buildExpenseSections(): BreakdownSection[] {
    const byCategory = new Map<string, BreakdownSection>();

    for (const entry of monthEntries) {
      const item = expenseItems.find((i) => i.id === entry.item_id);
      const category = item?.category_id
        ? categories.find((c) => c.id === item.category_id)
        : undefined;
      const key = category?.id ?? 'sem-categoria';

      if (!byCategory.has(key)) {
        byCategory.set(key, {
          key,
          label: category?.name ?? 'Sem categoria',
          color: category?.color ?? null,
          rows: [],
        });
      }
      byCategory.get(key)!.rows.push({
        key: entry.id,
        label: item?.name ?? 'Item removido',
        amount: Number(entry.amount ?? 0),
        isPaid: entry.is_paid,
      });
    }

    const sections = [...byCategory.values()].map((s) => ({
      ...s,
      rows: [...s.rows].sort((a, b) => b.amount - a.amount),
    }));

    const oneTime = oneTimeForMonth
      .filter((e) => e.flow === 'expense')
      .map((e) => ({
        key: e.id,
        label: e.name,
        amount: Number(e.amount ?? 0),
        isPaid: e.is_paid,
      }))
      .sort((a, b) => b.amount - a.amount);

    return [...sections, { key: 'one-time', label: 'Despesas pontuais', rows: oneTime }];
  }

  const surplusTone: StatCardValueTone =
    summary && summary.surplus > 0
      ? 'positive'
      : summary && summary.surplus < 0
        ? 'negative'
        : 'muted';

  const currentMonth = toMonthDate(new Date());
  const isCurrentMonth = month === currentMonth;
  const displayedAccumulated =
    isCurrentMonth && summary
      ? Number(summary.surplus)
      : Number(summary?.accumulated_surplus ?? 0);
  const accumulatedTone: StatCardValueTone =
    summary && displayedAccumulated >= 0 ? 'positive' : 'negative';
  const pendingPayments =
    progress.total > 0 ? Math.max(0, progress.total - progress.paid) : 0;

  const surplus = Number(summary?.surplus ?? 0);

  /**
   * Destinos possíveis para a sobra. Linhas pagas dentro de outra ficam de
   * fora de propósito: elas decompõem uma fatura em vez de somar ao mês, logo
   * aportar nelas não faria a sobra descer — o botão prometeria o que não faz.
   */
  const investmentTargets: InvestmentTarget[] = activeItems
    .filter((i) => i.budget_class === 'investment' && !i.paid_with_item_id)
    .map((i) => ({
      id: i.id,
      name: i.name,
      currentAmount: getEffectiveExpenseAmount(i.id, month),
    }));

  const monthIsArchived = isCurrentMonth && currentMonthConcluded;
  const canAllocateSurplus = !isLoading && surplus > 0 && !monthIsArchived;

  /** Soma o aporte ao que a linha já tem no mês; a sobra desce o mesmo tanto. */
  async function handleAllocateSurplus(itemId: string, amount: number) {
    const current = getEffectiveExpenseAmount(itemId, month);
    try {
      await upsertEntry(itemId, month, current + amount);
      await refetchMonthlySummary();
      toast.success(`${money.format(amount)} guardados em investimento.`);
    } catch {
      toast.error('Não foi possível guardar a sobra.');
      throw new Error('allocate-surplus-failed');
    }
  }

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
      const next = getNextMonth(month);
      if (next <= maxPlanningMonth) setMonth(next);
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
      toast.success('Mês reaberto. Você pode voltar a editar receitas e despesas.');
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
              Os totais e lançamentos deste mês estão arquivados. Veja o detalhe em{' '}
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
              com os nomes e valores atuais. Depois você pode reabrir o mês se precisar corrigir algo.
            </p>
            {pendingPayments > 0 && (
              <div
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-amber-800 dark:text-amber-200 text-xs leading-relaxed"
                role="status"
              >
                <strong className="font-semibold">Atenção:</strong> você ainda tem{' '}
                <strong>{pendingPayments}</strong> de <strong>{progress.total}</strong> despesas com
                valor neste mês por marcar como pagas. Você pode concluir mesmo assim; o arquivo reflete o
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
            Isso remove o arquivo deste mês na sua conta. Você volta a poder editar receitas e despesas na
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

      <SurplusAllocationModal
        isOpen={surplusModalOpen}
        onClose={() => setSurplusModalOpen(false)}
        monthLabel={formatMonthLabel(month)}
        surplus={surplus}
        targets={investmentTargets}
        onApply={handleAllocateSurplus}
      />

      {breakdownKind && (
        <MonthBreakdownModal
          isOpen
          onClose={() => setBreakdownKind(null)}
          kind={breakdownKind}
          month={month}
          sections={breakdownKind === 'income' ? buildIncomeSections() : buildExpenseSections()}
          total={breakdownKind === 'income' ? totalIncome : totalExpenses}
        />
      )}

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Receitas"
          value={money.format(totalIncome)}
          isLoading={isLoading}
          valueTone="positive"
          valueSize="md"
          icon={<TrendingUp size={16} />}
          role="button"
          tabIndex={0}
          aria-label={`Ver detalhe das receitas de ${formatMonthLabel(month)}`}
          className="cursor-pointer transition-colors hover:border-brand-primary/60 hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
          onClick={() => setBreakdownKind('income')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setBreakdownKind('income');
            }
          }}
        />
        <StatCard
          label="Despesas"
          value={money.format(totalExpenses)}
          isLoading={isLoading}
          valueTone="negative"
          valueSize="md"
          icon={<CreditCard size={16} />}
          role="button"
          tabIndex={0}
          aria-label={`Ver detalhe das despesas de ${formatMonthLabel(month)}`}
          className="cursor-pointer transition-colors hover:border-brand-primary/60 hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
          onClick={() => setBreakdownKind('expense')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setBreakdownKind('expense');
            }
          }}
        />
        <StatCard
          label="Sobra"
          value={money.format(surplus)}
          isLoading={isLoading}
          valueTone={surplusTone}
          valueSize="md"
          icon={<Wallet size={16} />}
          sub={canAllocateSurplus ? 'toque para guardar' : undefined}
          {...(canAllocateSurplus
            ? {
                role: 'button' as const,
                tabIndex: 0,
                'aria-label': `Guardar a sobra de ${formatMonthLabel(month)} num investimento`,
                className:
                  'cursor-pointer transition-colors hover:border-brand-primary/60 hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary',
                onClick: () => setSurplusModalOpen(true),
                onKeyDown: (e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSurplusModalOpen(true);
                  }
                },
              }
            : {})}
        />
        <StatCard
          label="Acumulado"
          value={money.format(displayedAccumulated)}
          isLoading={isLoading}
          valueTone={accumulatedTone}
          valueSize="md"
          sub={isCurrentMonth ? 'a partir deste mês' : 'total histórico'}
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
        upsertOneTime={(id, name, monthKey, amount, extra) =>
          upsertOneTimeExpense(name, monthKey, amount, id, extra)
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
                {money.format(subsTotal)}
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
              <p className="text-base font-semibold text-text-primary">{money.format(getPendingTotal())}</p>
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
