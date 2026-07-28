'use client';

import { useEffect, useState } from 'react';
import { Plus, Settings, Columns2, RefreshCw, RotateCcw } from 'lucide-react';
import { Modal, Input, Button, Skeleton, useToast, InlineAmountCell } from '@phfront/millennium-ui';
import { useIncome } from '@/hooks/finance/use-income';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';
import { useCurrencyConversion } from '@/hooks/finance/use-currency-conversion';
import { formatMonth, parseMoneyInput } from '@/lib/finance/format';
import { currencySymbol, exchangeRateBetween, formatMoney } from '@/lib/finance/currency';
import {
  buildSpreadsheetMonthList,
  firstDayToMonthInputValue,
  monthInputValueToFirstDay,
  toMonthDate,
} from '@/lib/finance/finance';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import { SpreadsheetColumnFillModal } from '@/components/finance/features/spreadsheet-column-fill-modal/SpreadsheetColumnFillModal';
import { CurrencySelect } from '@/components/finance/ui/CurrencySelect';
import { incomeEntryCurrency, type IncomeSource } from '@/types/finance';

/** `table-auto` + nowrap: columns grow with label/value; floor fits typical BRL in `text-xs`. */
const SPREADSHEET_DATA_COL = 'min-w-40 whitespace-nowrap px-2';

function IncomeSourceManageRow({
  source,
  displayCurrency,
  supportedCurrencies,
  convert,
  onToggleActive,
  onSaveDefault,
  onSaveCurrency,
  onSaveCurrencySince,
}: {
  source: IncomeSource;
  displayCurrency: string;
  supportedCurrencies: string[];
  convert: (amount: number, from: string | null | undefined) => number;
  onToggleActive: () => void;
  onSaveDefault: (n: number) => void | Promise<void>;
  onSaveCurrency: (currency: string | null) => void | Promise<void>;
  onSaveCurrencySince: (monthFirstDay: string) => void | Promise<void>;
}) {
  const [def, setDef] = useState(() => String(source.default_monthly_amount ?? 0));
  const sourceCurrency = source.currency ?? displayCurrency;
  const isForeign = sourceCurrency !== displayCurrency;

  useEffect(() => {
    setDef(String(source.default_monthly_amount ?? 0));
  }, [source.id, source.default_monthly_amount]);

  async function commitDefault() {
    const n = Math.max(0, parseFloat(def.replace(',', '.')) || 0);
    setDef(String(n));
    if (n !== Number(source.default_monthly_amount ?? 0)) {
      await Promise.resolve(onSaveDefault(n));
    }
  }

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 rounded-lg bg-surface-3 border border-border/60">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <span className="text-sm font-medium text-text-primary shrink-0">{source.name}</span>

        <div className="flex flex-1 flex-col sm:max-w-[190px] gap-0.5">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wide">Moeda</span>
          <CurrencySelect
            value={source.currency}
            onChange={(next) => void onSaveCurrency(next)}
            allowDefault
            defaultCurrency={displayCurrency}
            supportedCurrencies={supportedCurrencies}
          />
        </div>

        <div className="flex flex-1 flex-col sm:max-w-[160px] gap-0.5">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wide">
            Padrão mensal ({currencySymbol(sourceCurrency)})
          </span>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={def}
            onChange={(e) => setDef(e.target.value)}
            onBlur={commitDefault}
            onKeyDown={(e) => e.key === 'Enter' && void commitDefault()}
          />
        </div>

        <button
          type="button"
          onClick={onToggleActive}
          className={`self-start sm:self-auto text-xs px-2 py-0.5 rounded-full transition-colors cursor-pointer shrink-0
            ${source.is_active ? 'bg-green-500/15 text-green-500' : 'bg-surface-4 text-text-muted'}`}
        >
          {source.is_active ? 'Ativo' : 'Inativo'}
        </button>
      </div>

      {isForeign && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span className="text-[11px] text-text-muted">
            Convertido pela cotação atual: ≈{' '}
            <span className="text-text-secondary">
              {formatMoney(
                convert(Number(source.default_monthly_amount ?? 0), sourceCurrency),
                displayCurrency,
              )}
            </span>{' '}
            por mês
            {source.currency_since ? (
              <>
                , de {formatMonth(source.currency_since)} em diante. Antes disso os lançamentos são
                lidos em {displayCurrency}, sem conversão.
              </>
            ) : (
              <>
                . <span className="text-amber-500">Vale para todo o histórico</span> — define um mês
                para os lançamentos antigos não serem reinterpretados.
              </>
            )}
          </span>
          <label className="flex shrink-0 flex-col gap-0.5">
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wide">
              Em {sourceCurrency} desde
            </span>
            <input
              type="month"
              value={firstDayToMonthInputValue(source.currency_since ?? '')}
              onChange={(e) =>
                e.target.value && void onSaveCurrencySince(monthInputValueToFirstDay(e.target.value))
              }
              className="px-3 py-1.5 rounded-lg bg-surface-2 border border-transparent text-sm text-text-primary outline-none ring-1 ring-inset ring-border focus:ring-brand-primary"
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function IncomeSheet() {
  const { monthsForward } = useFinanceSpreadsheetSettings();
  const {
    sources,
    activeSources,
    entries,
    isLoading,
    upsertEntry,
    addSource,
    updateSource,
    changeSourceCurrency,
    getEntry,
    ensureDefaultIncomeEntriesForMonths,
    fillSourceColumnForMonths,
  } = useIncome();
  const money = useMoneyFormat();
  const {
    displayCurrency,
    supportedCurrencies,
    hasRates,
    fetchedAt,
    isLoading: ratesLoading,
    refresh: refreshRates,
    convert,
    rateOf,
    rates,
  } = useCurrencyConversion();
  const { toast } = useToast();
  const [showManage, setShowManage] = useState(false);
  const [currencyChange, setCurrencyChange] = useState<{
    source: IncomeSource;
    next: string | null;
  } | null>(null);
  /** Mês a partir do qual a moeda nova passa a valer (input `YYYY-MM`). */
  const [currencySinceInput, setCurrencySinceInput] = useState('');
  const [currencyChangeBusy, setCurrencyChangeBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<{
    sourceId: string;
    name: string;
    currency: string;
    amount: number;
    months: string[];
  } | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [columnFillTarget, setColumnFillTarget] = useState<{
    sourceId: string;
    name: string;
    currency: string;
  } | null>(null);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceDefault, setNewSourceDefault] = useState('');
  const [newSourceCurrency, setNewSourceCurrency] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const allMonths = buildSpreadsheetMonthList(
    entries.map((e) => e.month),
    monthsForward,
  );

  const allMonthsKey = allMonths.join('|');
  const sourcesKey = sources.map((s) => `${s.id}:${s.default_monthly_amount}:${s.is_active}`).join('|');
  const foreignSources = activeSources.filter((s) => s.currency && s.currency !== displayCurrency);

  useEffect(() => {
    if (isLoading) return;
    void ensureDefaultIncomeEntriesForMonths(allMonths);
  }, [isLoading, allMonthsKey, sourcesKey, ensureDefaultIncomeEntriesForMonths]);

  async function handleSave(sourceId: string, month: string, value: number) {
    try {
      await upsertEntry(sourceId, month, value);
    } catch {
      toast.error('Erro ao salvar', 'Tente novamente.');
    }
  }

  async function handleAddSource() {
    if (!newSourceName.trim()) return;
    setAdding(true);
    try {
      const def = Math.max(0, parseFloat(newSourceDefault.replace(',', '.')) || 0);
      // Fonte nova em moeda estrangeira: vale do mês atual em diante.
      await addSource(
        newSourceName.trim(),
        def,
        newSourceCurrency,
        newSourceCurrency ? toMonthDate(new Date()) : null,
      );
      setNewSourceName('');
      setNewSourceDefault('');
      setNewSourceCurrency(null);
      toast.success('Fonte adicionada');
    } catch {
      toast.error('Erro ao adicionar fonte');
    } finally {
      setAdding(false);
    }
  }

  /** Abre o diálogo de troca de moeda, com a fronteira no mês atual por omissão. */
  function openCurrencyChange(source: IncomeSource, next: string | null) {
    setCurrencySinceInput(
      firstDayToMonthInputValue(source.currency_since ?? toMonthDate(new Date())),
    );
    setCurrencyChange({ source, next });
  }

  async function applyCurrencyChange(convertValues: boolean) {
    if (!currencyChange) return;
    const { source, next } = currencyChange;
    const from = source.currency ?? displayCurrency;
    const to = next ?? displayCurrency;
    const factor = convertValues ? (exchangeRateBetween(from, to, rates) ?? 1) : 1;
    const since = next ? monthInputValueToFirstDay(currencySinceInput) : null;

    setCurrencyChangeBusy(true);
    try {
      await changeSourceCurrency(source.id, next, factor, since);
      const scope = since ? ` a partir de ${formatMonth(since)}` : '';
      toast.success(
        'Moeda da fonte atualizada',
        convertValues && factor !== 1
          ? `Os valores de ${source.name}${scope} foram convertidos de ${from} para ${to}.`
          : `Os valores de ${source.name}${scope} passam a ser lidos em ${to}, sem alteração dos números.`,
      );
      setCurrencyChange(null);
    } catch {
      toast.error('Erro ao mudar a moeda');
    } finally {
      setCurrencyChangeBusy(false);
    }
  }

  async function handleRefreshRates() {
    try {
      await refreshRates();
      toast.success('Cotações atualizadas');
    } catch {
      toast.error('Não foi possível atualizar as cotações');
    }
  }

  /** Valor da célula na moeda da própria fonte (é assim que é guardado e editado). */
  function getIncomeCellAmount(source: IncomeSource, month: string): number {
    const entry = getEntry(source.id, month);
    if (entry) return Number(entry.amount ?? 0);
    return Math.max(0, Number(source.default_monthly_amount ?? 0));
  }

  /**
   * Moeda em que a célula deste mês é lida — pode ser a padrão mesmo numa fonte
   * estrangeira, se o mês for anterior a `currency_since`.
   */
  function cellCurrency(source: IncomeSource, month: string): string {
    return incomeEntryCurrency(source, month, displayCurrency);
  }

  /** Total do mês já na moeda de exibição (converte as fontes estrangeiras). */
  function getRowTotal(month: string): number {
    return activeSources.reduce(
      (sum, s) => sum + convert(getIncomeCellAmount(s, month), cellCurrency(s, month)),
      0,
    );
  }

  /** Meses a repor no "resetar coluna": o atual e todos os seguintes visíveis. */
  function monthsFromCurrent(): string[] {
    const current = toMonthDate(new Date());
    return allMonths.filter((m) => m >= current);
  }

  async function applyResetColumn() {
    if (!resetTarget) return;
    setResetBusy(true);
    try {
      await fillSourceColumnForMonths(resetTarget.sourceId, resetTarget.months, resetTarget.amount);
      toast.success(
        'Coluna reposta',
        `${resetTarget.months.length} ${resetTarget.months.length === 1 ? 'mês voltou' : 'meses voltaram'} ao padrão mensal.`,
      );
      setResetTarget(null);
    } catch {
      toast.error('Erro ao repor a coluna');
    } finally {
      setResetBusy(false);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">Planilha de Receitas</h2>
        <Button variant="ghost" size="sm" onClick={() => setShowManage(true)} leftIcon={<Settings size={14} />}>
          Gerenciar fontes
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-max min-w-full table-auto text-xs border-collapse">
          <colgroup>
            <col className="w-20" />
            <col className="min-w-40" />
            {activeSources.map((s) => (
              <col key={s.id} className="min-w-40" />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-surface-3">
              <th className="sticky left-0 z-10 align-bottom bg-surface-3 text-left px-2 py-2.5 font-medium text-text-muted border-b border-border whitespace-nowrap">
                Mês
              </th>
              <th className="align-bottom text-right px-2 py-2.5 font-medium text-text-muted border-b border-border bg-surface-3/80 min-w-40 whitespace-nowrap">
                Total ({currencySymbol(displayCurrency)})
              </th>
              {activeSources.map((s) => {
                const sourceCurrency = s.currency ?? displayCurrency;
                const isForeign = sourceCurrency !== displayCurrency;
                return (
                  <th
                    key={s.id}
                    className={`group align-bottom border-b border-border bg-surface-3 ${SPREADSHEET_DATA_COL} py-2.5`}
                  >
                    <div className="flex items-end justify-end gap-1.5">
                      {/* Ações discretas: aparecem no hover/foco da coluna, e sempre em touch. */}
                      <div className="flex items-center gap-0.5 pb-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                        <button
                          type="button"
                          className="p-1 rounded-md text-text-muted hover:text-brand-primary hover:bg-surface-4 transition-colors cursor-pointer"
                          title="Preencher todos os meses visíveis com o mesmo valor"
                          aria-label={`Preencher coluna ${s.name} em todos os meses`}
                          onClick={() =>
                            setColumnFillTarget({ sourceId: s.id, name: s.name, currency: sourceCurrency })
                          }
                        >
                          <Columns2 size={15} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded-md text-text-muted hover:text-brand-primary hover:bg-surface-4 transition-colors cursor-pointer"
                          title="Repor o mês atual e os seguintes com o padrão mensal da fonte"
                          aria-label={`Repor coluna ${s.name} a partir do mês atual`}
                          onClick={() =>
                            setResetTarget({
                              sourceId: s.id,
                              name: s.name,
                              currency: sourceCurrency,
                              amount: Math.max(0, Number(s.default_monthly_amount ?? 0)),
                              months: monthsFromCurrent(),
                            })
                          }
                        >
                          <RotateCcw size={15} strokeWidth={2} />
                        </button>
                      </div>

                      <div className="flex min-w-0 flex-col items-end gap-0.5">
                        <span
                          className="max-w-full truncate text-sm font-semibold text-text-primary leading-tight"
                          title={s.name}
                        >
                          {s.name}
                        </span>
                        {isForeign && (
                          <span
                            className="rounded-full bg-brand-primary/20 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-brand-primary"
                            title={
                              s.currency_since
                                ? `Lançado em ${sourceCurrency} a partir de ${formatMonth(s.currency_since)}; antes disso, em ${displayCurrency} sem conversão`
                                : `Valores lançados e editados em ${sourceCurrency}; sob cada célula mostramos a conversão para ${displayCurrency}`
                            }
                          >
                            {s.currency_since
                              ? `${sourceCurrency} · desde ${formatMonth(s.currency_since)}`
                              : sourceCurrency}
                          </span>
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allMonths.map((month, i) => {
              const rowTotal = getRowTotal(month);
              return (
                <tr
                  key={month}
                  className={`hover:bg-surface-3/50 transition-colors ${i % 2 === 0 ? 'bg-surface-1' : 'bg-surface-2'}`}
                >
                  <td className="sticky left-0 z-10 px-2 py-1.5 font-medium text-text-secondary border-b border-border/50 bg-inherit whitespace-nowrap">
                    {formatMonth(month)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold text-text-primary border-b border-border/50 min-w-40 whitespace-nowrap">
                    {rowTotal > 0 ? money.format(rowTotal) : <span className="text-text-muted">—</span>}
                  </td>
                  {activeSources.map((s) => {
                    const monthCurrency = cellCurrency(s, month);
                    const amount = getIncomeCellAmount(s, month);
                    return (
                      <td key={s.id} className={`border-b border-border/50 ${SPREADSHEET_DATA_COL} py-1`}>
                        <InlineAmountCell
                          value={amount}
                          onSave={(v) => handleSave(s.id, month, v)}
                          formatDisplay={(v) => formatMoney(v, monthCurrency)}
                          parseInput={parseMoneyInput}
                        />
                        {monthCurrency !== displayCurrency && amount !== 0 && (
                          <span
                            className="block px-1 text-right text-[11px] font-medium leading-tight text-text-secondary"
                            title={`${formatMoney(amount, monthCurrency)} convertido para ${displayCurrency} pela cotação atual`}
                          >
                            ≈ {money.format(convert(amount, monthCurrency))}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {foreignSources.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
          <span>
            {hasRates
              ? `Cotações de ${fetchedAt ? new Date(fetchedAt).toLocaleDateString('pt-BR') : 'hoje'}:`
              : 'Sem cotações — os totais usam os valores sem conversão:'}
          </span>
          {[...new Set(foreignSources.map((s) => s.currency as string))].map((code) => {
            const rate = rateOf(code);
            return (
              <span key={code} className="text-text-secondary">
                1 {code} = {rate == null ? '—' : formatMoney(rate, displayCurrency)}
              </span>
            );
          })}
          <button
            type="button"
            onClick={handleRefreshRates}
            disabled={ratesLoading}
            className="inline-flex items-center gap-1 text-text-muted hover:text-brand-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={11} className={ratesLoading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      )}

      <SpreadsheetColumnFillModal
        isOpen={columnFillTarget != null}
        onClose={() => setColumnFillTarget(null)}
        columnLabel={columnFillTarget?.name ?? ''}
        currencyCode={columnFillTarget?.currency ?? displayCurrency}
        monthCount={allMonths.length}
        onApply={async (amount) => {
          if (!columnFillTarget) return;
          try {
            await fillSourceColumnForMonths(columnFillTarget.sourceId, allMonths, amount);
            toast.success('Coluna atualizada');
          } catch {
            toast.error('Erro ao preencher coluna');
          }
        }}
      />

      <Modal
        isOpen={resetTarget != null}
        onClose={() => !resetBusy && setResetTarget(null)}
        title={`Repor coluna: ${resetTarget?.name ?? ''}`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Repõe o mês atual e os seguintes com o padrão mensal da fonte —{' '}
            <strong className="text-text-primary">
              {formatMoney(resetTarget?.amount ?? 0, resetTarget?.currency ?? displayCurrency)}
            </strong>
            . Os meses já passados não são tocados.
          </p>
          <p className="text-xs text-text-muted">
            {resetTarget?.months.length ?? 0}{' '}
            {(resetTarget?.months.length ?? 0) === 1 ? 'mês afetado' : 'meses afetados'}
            {resetTarget?.months.length
              ? ` (${formatMonth(resetTarget.months[0])} a ${formatMonth(resetTarget.months[resetTarget.months.length - 1])})`
              : ''}
            . Os valores que tenhas editado à mão nesses meses são substituídos.
          </p>
          {resetTarget?.amount === 0 && (
            <p className="text-xs text-amber-500">
              O padrão mensal desta fonte é zero, por isso estes meses ficam a zero.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setResetTarget(null)} disabled={resetBusy}>
              Cancelar
            </Button>
            <Button
              onClick={() => void applyResetColumn()}
              disabled={resetBusy || (resetTarget?.months.length ?? 0) === 0}
            >
              {resetBusy ? 'A repor…' : 'Repor'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal gerenciar fontes */}
      <Modal isOpen={showManage} onClose={() => setShowManage(false)} title="Fontes de Renda">
        <div className="flex flex-col gap-5">
          <p className="text-xs text-text-muted">
            A moeda padrão é <strong className="text-text-secondary">{displayCurrency}</strong> (muda em
            Configurações). Uma fonte noutra moeda guarda o valor na moeda dela e é convertida pela
            cotação atual nos totais.
          </p>

          <div className="flex flex-col gap-3">
            {sources.map((s) => (
              <IncomeSourceManageRow
                key={s.id}
                source={s}
                displayCurrency={displayCurrency}
                supportedCurrencies={supportedCurrencies}
                convert={convert}
                onToggleActive={() => void updateSource(s.id, { is_active: !s.is_active })}
                onSaveDefault={async (n) => {
                  try {
                    await updateSource(s.id, { default_monthly_amount: n });
                  } catch {
                    toast.error('Erro ao guardar o valor padrão');
                  }
                }}
                onSaveCurrency={(currency) => {
                  if ((currency ?? null) === (s.currency ?? null)) return;
                  openCurrencyChange(s, currency);
                }}
                onSaveCurrencySince={async (monthFirstDay) => {
                  if (monthFirstDay === s.currency_since) return;
                  try {
                    // Só muda a leitura dos meses; nenhum valor guardado é reescrito.
                    await updateSource(s.id, { currency_since: monthFirstDay });
                    toast.success(
                      'Fronteira atualizada',
                      `${s.name} conta como ${s.currency} a partir de ${formatMonth(monthFirstDay)}.`,
                    );
                  } catch {
                    toast.error('Erro ao guardar o mês inicial');
                  }
                }}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
            <span className="text-xs font-medium text-text-secondary pt-3">Nova fonte</span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
              <Input
                className="flex-1"
                placeholder="Nome da nova fonte"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
              />
              <CurrencySelect
                className="sm:max-w-[190px]"
                value={newSourceCurrency}
                onChange={setNewSourceCurrency}
                allowDefault
                defaultCurrency={displayCurrency}
                supportedCurrencies={supportedCurrencies}
              />
              <Input
                className="sm:max-w-[160px]"
                type="number"
                step="0.01"
                min={0}
                placeholder={`Padrão mensal (${currencySymbol(newSourceCurrency ?? displayCurrency)})`}
                value={newSourceDefault}
                onChange={(e) => setNewSourceDefault(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
              />
              <Button onClick={handleAddSource} disabled={adding} leftIcon={<Plus size={14} />}>
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {currencyChange && (() => {
        const from = currencyChange.source.currency ?? displayCurrency;
        const to = currencyChange.next ?? displayCurrency;
        const factor = exchangeRateBetween(from, to, rates);
        const sample = Math.max(0, Number(currencyChange.source.default_monthly_amount ?? 0)) || 1000;

        return (
          <Modal
            isOpen
            onClose={() => !currencyChangeBusy && setCurrencyChange(null)}
            title={`Mudar a moeda: ${currencyChange.source.name}`}
          >
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text-secondary">
                Os valores desta fonte estão guardados em{' '}
                <strong className="text-text-primary">{from}</strong> e vão passar a ser lidos em{' '}
                <strong className="text-text-primary">{to}</strong>.
              </p>

              {currencyChange.next && (
                <div>
                  <label
                    htmlFor="currency-since"
                    className="text-[10px] font-medium text-text-muted uppercase tracking-wide block mb-1"
                  >
                    A partir de que mês?
                  </label>
                  <input
                    id="currency-since"
                    type="month"
                    value={currencySinceInput}
                    onChange={(e) => setCurrencySinceInput(e.target.value)}
                    className="w-full sm:max-w-[200px] px-3 py-2 rounded-lg bg-surface-3 border border-transparent text-sm text-text-primary outline-none ring-1 ring-inset ring-border focus:ring-brand-primary"
                  />
                  <p className="text-xs text-text-muted mt-1.5">
                    Os meses anteriores continuam a ser lidos em {displayCurrency}, sem conversão — é o
                    que impede o histórico de oscilar com o câmbio.
                  </p>
                </div>
              )}

              <p className="text-sm text-text-secondary">
                E os números {currencyChange.next ? 'desse mês em diante' : 'já lançados'}?
              </p>

              {factor == null && (
                <p className="text-xs text-amber-500">
                  Sem cotação {from}→{to} de momento, por isso só é possível manter os números. Atualiza as
                  cotações e tente de novo se quiser converter.
                </p>
              )}

              <div className="flex flex-col gap-2">
                <div className="rounded-lg border border-border bg-surface-3 p-3 text-xs">
                  <p className="font-medium text-text-primary mb-1">Converter valores</p>
                  <p className="text-text-muted">
                    Aplica a cotação atual a esses meses e ao padrão mensal. Ex.:{' '}
                    <span className="text-text-secondary">{formatMoney(sample, from)}</span> →{' '}
                    <span className="text-text-secondary">
                      {factor == null ? '—' : formatMoney(sample * factor, to)}
                    </span>
                    {factor != null && (
                      <>
                        {' '}
                        (1 {from} = {formatMoney(factor, to)})
                      </>
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-3 p-3 text-xs">
                  <p className="font-medium text-text-primary mb-1">Manter os números</p>
                  <p className="text-text-muted">
                    Os valores ficam iguais e passam a valer em {to}. Ex.:{' '}
                    <span className="text-text-secondary">{formatMoney(sample, from)}</span> →{' '}
                    <span className="text-text-secondary">{formatMoney(sample, to)}</span>. Usa isto se os
                    números que você lançou já estavam em {to}.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setCurrencyChange(null)}
                  disabled={currencyChangeBusy}
                >
                  Cancelar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void applyCurrencyChange(false)}
                  disabled={currencyChangeBusy}
                >
                  Manter os números
                </Button>
                <Button
                  onClick={() => void applyCurrencyChange(true)}
                  disabled={currencyChangeBusy || factor == null}
                >
                  {currencyChangeBusy ? 'A aplicar…' : 'Converter valores'}
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
