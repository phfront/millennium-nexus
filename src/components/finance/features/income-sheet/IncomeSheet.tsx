'use client';

import { useEffect, useState } from 'react';
import { Plus, Settings, Columns2 } from 'lucide-react';
import { Modal, Input, Button, Skeleton, useToast, InlineAmountCell } from '@phfront/millennium-ui';
import { useIncome } from '@/hooks/finance/use-income';
import { formatBRL, formatMonth, parseBRLInput } from '@/lib/finance/format';
import { buildSpreadsheetMonthList } from '@/lib/finance/finance';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import { SpreadsheetColumnFillModal } from '@/components/finance/features/spreadsheet-column-fill-modal/SpreadsheetColumnFillModal';
import type { IncomeSource } from '@/types/finance';

/** `table-auto` + nowrap: columns grow with label/value; floor fits typical BRL in `text-xs`. */
const SPREADSHEET_DATA_COL = 'min-w-40 whitespace-nowrap px-2';

function IncomeSourceManageRow({
  source,
  onToggleActive,
  onSaveDefault,
}: {
  source: IncomeSource;
  onToggleActive: () => void;
  onSaveDefault: (n: number) => void | Promise<void>;
}) {
  const [def, setDef] = useState(() => String(source.default_monthly_amount ?? 0));

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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3 px-3 py-2.5 rounded-lg bg-surface-3 border border-border/60">
      <span className="text-sm font-medium text-text-primary shrink-0">{source.name}</span>
      <div className="flex flex-1 flex-col sm:max-w-[160px] gap-0.5">
        <span className="text-[10px] font-medium text-text-muted uppercase tracking-wide">Padrão mensal (R$)</span>
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
    getEntry,
    ensureDefaultIncomeEntriesForMonths,
    fillSourceColumnForMonths,
  } = useIncome();
  const { toast } = useToast();
  const [showManage, setShowManage] = useState(false);
  const [columnFillTarget, setColumnFillTarget] = useState<{ sourceId: string; name: string } | null>(null);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceDefault, setNewSourceDefault] = useState('');
  const [adding, setAdding] = useState(false);

  const allMonths = buildSpreadsheetMonthList(
    entries.map((e) => e.month),
    monthsForward,
  );

  const allMonthsKey = allMonths.join('|');
  const sourcesKey = sources.map((s) => `${s.id}:${s.default_monthly_amount}:${s.is_active}`).join('|');

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
      await addSource(newSourceName.trim(), def);
      setNewSourceName('');
      setNewSourceDefault('');
      toast.success('Fonte adicionada');
    } catch {
      toast.error('Erro ao adicionar fonte');
    } finally {
      setAdding(false);
    }
  }

  function getIncomeCellAmount(source: IncomeSource, month: string): number {
    const entry = getEntry(source.id, month);
    if (entry) return Number(entry.amount ?? 0);
    return Math.max(0, Number(source.default_monthly_amount ?? 0));
  }

  function getRowTotal(month: string): number {
    return activeSources.reduce((sum, s) => sum + getIncomeCellAmount(s, month), 0);
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
              <th className="sticky left-0 z-10 bg-surface-3 text-left px-2 py-2 font-medium text-text-muted border-b border-border whitespace-nowrap">
                Mês
              </th>
              <th className="text-right px-2 py-2 font-medium text-text-muted border-b border-border bg-surface-3/80 min-w-40 whitespace-nowrap">
                Total
              </th>
              {activeSources.map((s) => (
                <th key={s.id} className={`align-top border-b border-border bg-surface-3 ${SPREADSHEET_DATA_COL} py-2`}>
                  <div className="relative min-h-13">
                    <button
                      type="button"
                      className="absolute left-0 top-0 z-10 p-1 rounded-md text-text-muted hover:text-brand-primary hover:bg-surface-4 transition-colors cursor-pointer"
                      title="Preencher todos os meses visíveis com o mesmo valor"
                      aria-label={`Preencher coluna ${s.name} em todos os meses`}
                      onClick={() => setColumnFillTarget({ sourceId: s.id, name: s.name })}
                    >
                      <Columns2 size={16} strokeWidth={2} />
                    </button>
                    <span className="block w-full pl-8 text-right text-sm font-semibold text-text-primary leading-snug">
                      <span className="whitespace-nowrap" title={s.name}>
                        {s.name}
                      </span>
                    </span>
                  </div>
                </th>
              ))}
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
                    {rowTotal > 0 ? formatBRL(rowTotal) : <span className="text-text-muted">—</span>}
                  </td>
                  {activeSources.map((s) => (
                    <td key={s.id} className={`border-b border-border/50 ${SPREADSHEET_DATA_COL} py-1`}>
                      <InlineAmountCell
                        value={getIncomeCellAmount(s, month)}
                        onSave={(v) => handleSave(s.id, month, v)}
                        formatDisplay={formatBRL}
                        parseInput={parseBRLInput}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SpreadsheetColumnFillModal
        isOpen={columnFillTarget != null}
        onClose={() => setColumnFillTarget(null)}
        columnLabel={columnFillTarget?.name ?? ''}
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

      {/* Modal gerenciar fontes */}
      <Modal isOpen={showManage} onClose={() => setShowManage(false)} title="Fontes de Renda">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            {sources.map((s) => (
              <IncomeSourceManageRow
                key={s.id}
                source={s}
                onToggleActive={() => void updateSource(s.id, { is_active: !s.is_active })}
                onSaveDefault={async (n) => {
                  try {
                    await updateSource(s.id, { default_monthly_amount: n });
                  } catch {
                    toast.error('Erro ao guardar o valor padrão');
                  }
                }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
            <Input
              className="flex-1"
              placeholder="Nome da nova fonte"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
            />
            <Input
              className="sm:max-w-[160px]"
              type="number"
              step="0.01"
              min={0}
              placeholder="Padrão mensal (R$)"
              value={newSourceDefault}
              onChange={(e) => setNewSourceDefault(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
            />
            <Button onClick={handleAddSource} disabled={adding} leftIcon={<Plus size={14} />}>
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
