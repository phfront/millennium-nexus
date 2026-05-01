'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Button, Modal, Skeleton, useToast } from '@phfront/millennium-ui';
import type {
  CaloriasHistoryDayRow,
  CaloriasHistoryMonthRow,
  CaloriasHistoryWeekRow,
} from '@/lib/health/calorias';
import { calcCaloriasProgress } from '@/lib/health/calorias';
import { formatKcal } from '@/lib/health/nutrition';
import { formatDatePtBR } from '@/lib/health/projection';
import type { CaloriasHistoryPresetDays } from '@/hooks/health/use-calorias-history';
import { CALORIAS_HISTORY_PRESET_DAYS } from '@/hooks/health/use-calorias-history';

const PAGE_SIZE_DAYS = 20;
const PAGE_SIZE_WEEKS = 10;
const PAGE_SIZE_MONTHS = 12;
const QUICK_ADD = [100, 250, 500] as const;

type CaloriasHistoryGranularity = 'day' | 'week' | 'month';

function formatMonthTitlePt(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatTimePt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export type CaloriasHistoryProps = {
  presetDays: CaloriasHistoryPresetDays;
  onPresetDaysChange: (d: CaloriasHistoryPresetDays) => void;
  dayRows: CaloriasHistoryDayRow[];
  weekRows: CaloriasHistoryWeekRow[];
  monthRows: CaloriasHistoryMonthRow[];
  isLoading: boolean;
  removeLog: (id: string) => Promise<void>;
  addKcal: (amount: number, note: string | null | undefined, loggedDate: string) => Promise<unknown>;
  visibleStart: string;
  visibleEnd: string;
};

export function CaloriasHistory({
  presetDays,
  onPresetDaysChange,
  dayRows,
  weekRows,
  monthRows,
  isLoading,
  removeLog,
  addKcal,
  visibleStart,
  visibleEnd,
}: CaloriasHistoryProps) {
  const { toast } = useToast();
  const [granularity, setGranularity] = useState<CaloriasHistoryGranularity>('day');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [addForDate, setAddForDate] = useState<string | null>(null);
  const [otherAmount, setOtherAmount] = useState('');
  const [otherNote, setOtherNote] = useState('');
  const [saving, setSaving] = useState(false);

  const pageSize =
    granularity === 'day' ? PAGE_SIZE_DAYS : granularity === 'week' ? PAGE_SIZE_WEEKS : PAGE_SIZE_MONTHS;
  const activeRowCount =
    granularity === 'day' ? dayRows.length : granularity === 'week' ? weekRows.length : monthRows.length;
  const totalPages = Math.max(1, Math.ceil(activeRowCount / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const sliceStart = (pageClamped - 1) * pageSize;
  const sliceEnd = sliceStart + pageSize;
  const paginatedDays = dayRows.slice(sliceStart, sliceEnd);
  const paginatedWeeks = weekRows.slice(sliceStart, sliceEnd);
  const paginatedMonths = monthRows.slice(sliceStart, sliceEnd);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setConfirmId(null);
    try {
      await removeLog(id);
      toast.success('Registo removido', 'As kcal foram atualizadas.');
    } catch {
      toast.error('Erro ao excluir', 'Tente novamente.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddQuick(amount: number) {
    if (!addForDate) return;
    try {
      await addKcal(amount, null, addForDate);
      setAddForDate(null);
      setOtherAmount('');
      setOtherNote('');
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao registrar');
    }
  }

  async function handleOtherSave() {
    if (!addForDate) return;
    const n = Math.round(Number(otherAmount));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Valor inválido', 'Indique um número positivo de kcal.');
      return;
    }
    setSaving(true);
    try {
      await addKcal(n, otherNote || null, addForDate);
      setAddForDate(null);
      setOtherAmount('');
      setOtherNote('');
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao registrar');
    }
    setSaving(false);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="block" className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-secondary">Período:</span>
        {CALORIAS_HISTORY_PRESET_DAYS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setPage(1);
              onPresetDaysChange(d);
            }}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-semibold transition',
              presetDays === d
                ? 'bg-brand-primary text-[var(--color-brand-primary-text,white)]'
                : 'border border-border bg-surface-3 text-text-secondary hover:border-brand-primary/40 hover:text-text-primary',
            ].join(' ')}
          >
            {d} dias
          </button>
        ))}
      </div>

      <p className="text-xs text-text-muted">
        {formatDatePtBR(visibleStart)} — {formatDatePtBR(visibleEnd)}
      </p>

      {dayRows.length === 0 && weekRows.length === 0 && monthRows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-2 py-14 text-center text-sm text-text-muted">
          <p className="font-medium text-text-primary">Sem registos neste período</p>
          <p className="mt-1">Adicione kcal no ecrã principal ou alargue o período.</p>
          <Link href="/health/calorias" className="mt-4 inline-block text-sm text-brand-primary hover:underline">
            Voltar a Calorias
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-text-secondary">Ver:</span>
            {(
              [
                { id: 'day' as const, label: 'Por dia' },
                { id: 'week' as const, label: 'Por semana' },
                { id: 'month' as const, label: 'Por mês' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPage(1);
                  setGranularity(id);
                }}
                className={[
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  granularity === id
                    ? 'bg-brand-primary text-[var(--color-brand-primary-text,white)]'
                    : 'border border-border bg-surface-3 text-text-secondary hover:border-brand-primary/40 hover:text-text-primary',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {granularity === 'day' ? (
            <div className="flex flex-col gap-4">
              {paginatedDays.map((row) => {
                const pct = calcCaloriasProgress(row.dayTotal, row.effectiveTarget);
                return (
                  <div
                    key={row.dateISO}
                    className="overflow-hidden rounded-xl border border-border bg-surface-2 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border bg-surface-3/50 px-3 py-2.5 sm:px-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary">
                          {formatDatePtBR(row.dateISO)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-text-muted">
                          <span className="tabular-nums font-medium text-text-primary">
                            {formatKcal(row.dayTotal)} kcal
                          </span>
                          {row.effectiveTarget > 0 ? (
                            <>
                              <span>/ meta {formatKcal(row.effectiveTarget)}</span>
                              <span className="tabular-nums">({pct}%)</span>
                            </>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                        {row.effectiveTarget > 0 ? (
                          <div
                            className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-black/25 ring-1 ring-inset ring-white/10"
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Progresso do dia"
                          >
                            <div
                              className="h-full rounded-full bg-linear-to-r from-brand-primary to-brand-secondary transition-[width]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="shrink-0 gap-1"
                        onClick={() => {
                          setOtherAmount('');
                          setOtherNote('');
                          setAddForDate(row.dateISO);
                        }}
                      >
                        <PlusCircle size={14} aria-hidden />
                        Adicionar
                      </Button>
                    </div>
                    <ul className="divide-y divide-border">
                      {row.logs.map((log) => (
                        <li key={log.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold tabular-nums text-text-primary">
                              +{formatKcal(log.amount_kcal)} kcal
                            </p>
                            <p className="text-xs text-text-muted">
                              {formatTimePt(log.logged_at)}
                              {log.note ? ` · ${log.note}` : ''}
                            </p>
                          </div>
                          <div className="shrink-0">
                            {confirmId === log.id ? (
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="danger"
                                  isLoading={deletingId === log.id}
                                  onClick={() => void handleDelete(log.id)}
                                >
                                  Confirmar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmId(log.id)}
                                className="rounded-lg p-1.5 text-text-muted transition hover:bg-danger/10 hover:text-danger"
                                aria-label="Excluir registo"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : null}

          {granularity === 'week' ? (
            <div className="flex flex-col gap-3">
              {paginatedWeeks.map((row) => {
                const pct = calcCaloriasProgress(row.weekTotal, row.weeklyTarget);
                return (
                  <div
                    key={row.monday}
                    className="rounded-xl border border-border bg-surface-2 px-3 py-3 shadow-sm sm:px-4"
                  >
                    <p className="text-sm font-semibold text-text-primary">
                      {formatDatePtBR(row.monday)} — {formatDatePtBR(row.sunday)}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">Semana (seg–dom)</p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-text-muted">
                      <span className="tabular-nums text-sm font-medium text-text-primary">
                        {formatKcal(row.weekTotal)} kcal
                      </span>
                      {row.weeklyTarget > 0 ? (
                        <>
                          <span>/ meta {formatKcal(row.weeklyTarget)}</span>
                          <span className="tabular-nums">({pct}%)</span>
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    {row.weeklyTarget > 0 ? (
                      <div
                        className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-black/25 ring-1 ring-inset ring-white/10"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Progresso da semana"
                      >
                        <div
                          className="h-full rounded-full bg-linear-to-r from-brand-primary to-brand-secondary transition-[width]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {granularity === 'month' ? (
            <div className="flex flex-col gap-3">
              {paginatedMonths.map((row) => {
                const pct = calcCaloriasProgress(row.monthTotal, row.approximateMonthlyTarget);
                return (
                  <div
                    key={row.monthKey}
                    className="rounded-xl border border-border bg-surface-2 px-3 py-3 shadow-sm sm:px-4"
                  >
                    <p className="text-sm font-semibold capitalize text-text-primary">
                      {formatMonthTitlePt(row.monthKey)}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {row.daysWithLogs === 1
                        ? '1 dia com registos'
                        : `${row.daysWithLogs} dias com registos`}
                    </p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-text-muted">
                      <span className="tabular-nums text-sm font-medium text-text-primary">
                        {formatKcal(row.monthTotal)} kcal
                      </span>
                      {row.approximateMonthlyTarget > 0 ? (
                        <>
                          <span>/ meta ≈ {formatKcal(row.approximateMonthlyTarget)}</span>
                          <span className="tabular-nums">({pct}%)</span>
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    {row.approximateMonthlyTarget > 0 ? (
                      <div
                        className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-black/25 ring-1 ring-inset ring-white/10"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Progresso do mês"
                      >
                        <div
                          className="h-full rounded-full bg-linear-to-r from-brand-primary to-brand-secondary transition-[width]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm text-text-muted">
              <Button
                size="sm"
                variant="outline"
                disabled={pageClamped === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span>
                {pageClamped} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={pageClamped >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Seguinte
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Modal
        isOpen={addForDate != null}
        onClose={() => !saving && setAddForDate(null)}
        title={addForDate ? `Adicionar kcal · ${formatDatePtBR(addForDate)}` : 'Adicionar'}
      >
        {addForDate ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {QUICK_ADD.map((kcal) => (
                <button
                  key={kcal}
                  type="button"
                  onClick={() => void handleAddQuick(kcal)}
                  className="min-h-11 rounded-lg border border-border bg-surface-3 py-2.5 text-sm font-semibold tabular-nums text-text-primary touch-manipulation transition hover:border-brand-primary/40 hover:bg-brand-primary/10 sm:min-h-0 sm:py-2 sm:text-xs"
                >
                  +{formatKcal(kcal)}
                </button>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Outro (kcal)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={otherAmount}
                  onChange={(e) => setOtherAmount(e.target.value)}
                  placeholder="Ex: 150"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary tabular-nums outline-none focus:border-brand-primary"
                />
                <Button type="button" disabled={saving} onClick={() => void handleOtherSave()}>
                  OK
                </Button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Nota (opcional)</label>
              <input
                type="text"
                value={otherNote}
                onChange={(e) => setOtherNote(e.target.value)}
                placeholder="Ex: corrida"
                className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" type="button" disabled={saving} onClick={() => setAddForDate(null)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
