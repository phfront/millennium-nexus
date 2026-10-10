'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { Skeleton, useToast } from '@phfront/millennium-ui';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';
import { useCardItems } from '@/hooks/finance/use-card-items';
import { usePlannedPurchases, type PlannedPurchaseInput } from '@/hooks/finance/use-planned-purchases';
import { usePlanningAlert, usePlanningBaseline } from '@/hooks/finance/use-planning-baseline';
import { getNextMonth } from '@/lib/finance/finance';
import { formatMonthShort } from '@/lib/finance/format';
import {
  firstFittingStart,
  lowestMonth,
  projectMonths,
  setInstallment,
  type PlannedPurchase,
  type PlanPurchaseShape,
} from '@/lib/finance/planning';
import { PlanningAddBar } from './PlanningAddBar';
import { PlanningGrid } from './PlanningGrid';
import { draftFromForm, type AddBarForm } from './planning-shared';

const HORIZONS = [6, 12, 24] as const;
type Horizon = (typeof HORIZONS)[number];
const HORIZON_STORAGE_KEY = 'nexus:finance:planning:horizon';

type Undo = { message: string; run: () => Promise<void> };

/**
 * Planejamento de gastos (MLL-1): os próximos meses lado a lado e as compras
 * que eu quero fazer por cima, vendo na hora como cada mês fica. Só simula —
 * nada daqui vira lançamento (decisão do Pedro, 10/10/2026).
 */
export function Planning() {
  const money = useMoneyFormat();
  const { toast } = useToast();
  const { base, isLoading: baseLoading } = usePlanningBaseline();
  const { purchases, isLoading: purchasesLoading, create, update, remove, restore } = usePlannedPurchases();
  const { cardItems } = useCardItems();
  const { alertAmount, setAlertAmount, saveAlertAmount } = usePlanningAlert();

  const [horizon, setHorizon] = useState<Horizon>(12);
  const [form, setForm] = useState<AddBarForm>({ name: '', amountRaw: '', unit: 'total', pay: '1', start: '' });
  const [saving, setSaving] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(HORIZON_STORAGE_KEY));
      if ((HORIZONS as readonly number[]).includes(saved)) setHorizon(saved as Horizon);
    } catch {
      /* sem localStorage (aba privada): fica o padrão */
    }
  }, []);

  // Mês padrão da barra: o próximo (o corrente já está quase fechado).
  useEffect(() => {
    if (!form.start && base.length > 1) setForm((f) => ({ ...f, start: base[1].month }));
  }, [base, form.start]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  const baseInView = useMemo(() => base.slice(0, horizon), [base, horizon]);
  const draftShape = form.start ? draftFromForm(form) : null;
  const draft: (PlanPurchaseShape & { name: string }) | null = draftShape
    ? { ...draftShape, name: form.name.trim() }
    : null;

  const months = useMemo(
    () => projectMonths(baseInView, draftShape ? [...purchases, draftShape] : purchases),
    [baseInView, purchases, draftShape],
  );
  const monthsBefore = useMemo(
    () => (draftShape ? projectMonths(baseInView, purchases) : null),
    [baseInView, purchases, draftShape],
  );

  const fail = (e: unknown) => toast.error('Não deu para salvar', e instanceof Error ? e.message : undefined);

  async function submit() {
    if (!draftShape) return;
    setSaving(true);
    try {
      const input: PlannedPurchaseInput = {
        ...draftShape,
        name: form.name.trim() || 'Nova compra',
        card_item_id: null,
      };
      const row = await create(input);
      // Limpa só nome e valor: parcelas e mês ficam, para lançar várias parecidas em sequência.
      setForm((f) => ({ ...f, name: '', amountRaw: '' }));
      setHighlightId(row.id);
      setTimeout(() => setHighlightId(null), 1200);
      setUndo({
        message: `${row.name} adicionada`,
        run: async () => {
          await remove(row.id);
        },
      });
      nameRef.current?.focus();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }

  async function removePurchase(p: PlannedPurchase, reason: 'deleted' | 'bought') {
    try {
      const row = await remove(p.id);
      if (!row) return;
      setUndo({
        message:
          reason === 'bought'
            ? `${row.name} saiu do planejamento. Lembre de lançar em Despesas.`
            : `${row.name} excluída`,
        run: () => restore(row),
      });
    } catch (e) {
      fail(e);
    }
  }

  const hint = useMemo(() => {
    if (baseInView.length === 0) return null;
    const ok = (text: React.ReactNode) => (
      <span className="flex items-start gap-2">
        <CircleCheck size={16} className="mt-0.5 shrink-0 text-success" />
        <span>{text}</span>
      </span>
    );
    const warn = (text: React.ReactNode, bad: boolean, extra?: React.ReactNode) => (
      <span className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <TriangleAlert size={16} className={`mt-0.5 shrink-0 ${bad ? 'text-danger' : 'text-warning'}`} />
        <span className="min-w-[200px] flex-1">{text}</span>
        {extra}
      </span>
    );
    const strong = (v: number) => (
      <b className={`font-semibold ${v < 0 ? 'text-danger' : 'text-warning'}`}>{money.format(v)}</b>
    );

    const current = lowestMonth(projectMonths(baseInView, purchases));
    if (!current) return null;
    if (!draftShape) {
      return current.accumulated >= alertAmount
        ? ok(<>Do jeito que está, o acumulado nunca fica abaixo de {money.format(alertAmount)}. O ponto mais baixo é {money.format(current.accumulated)} em {formatMonthShort(current.month)}.</>)
        : warn(<>Do jeito que está, o acumulado chega a {strong(current.accumulated)} em {formatMonthShort(current.month)}. Desligue alguma compra para ver como fica.</>, current.accumulated < 0);
    }

    const after = lowestMonth(months);
    if (!after) return null;
    const each =
      draftShape.pay_mode === 'installments' && draftShape.installments > 1
        ? ` ${draftShape.installments}x de ${money.format(draftShape.amount / draftShape.installments)} (total ${money.format(draftShape.amount)}).`
        : '';
    if (after.accumulated >= alertAmount) {
      return ok(<><b className="font-semibold text-success">Cabe.</b>{each} O acumulado mais baixo fica em {money.format(after.accumulated)} ({formatMonthShort(after.month)}).</>);
    }
    if (current.accumulated < alertAmount) {
      return warn(<>Os meses já estão abaixo do aviso sem essa compra; com ela, o pior mês vai para {strong(after.accumulated)} ({formatMonthShort(after.month)}).</>, after.accumulated < 0);
    }
    const fit = firstFittingStart(baseInView, purchases, draftShape, alertAmount, getNextMonth(draftShape.start_month));
    return warn(
      <>Aperta: o acumulado vai a {strong(after.accumulated)} em {formatMonthShort(after.month)}.{each}</>,
      after.accumulated < 0,
      fit ? (
        <button
          type="button"
          className="font-semibold text-brand-primary underline underline-offset-4"
          onClick={() => setForm((f) => ({ ...f, start: fit }))}
        >
          Começando em {formatMonthShort(fit)}, cabe
        </button>
      ) : (
        <span>Não cabe nos próximos {horizon} meses. Tente mais parcelas.</span>
      ),
    );
  }, [baseInView, purchases, draftShape, months, alertAmount, money, horizon]);

  if (baseLoading || purchasesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-text-secondary">
          Me avise se o acumulado ficar abaixo de
          <span className="inline-flex items-center gap-1">
            {money.symbol}
            <input
              type="number"
              min="0"
              step="500"
              aria-label="Valor do aviso"
              className="h-7 w-24 rounded-md border border-border-strong bg-surface-1 px-2 text-right text-sm tabular-nums text-text-primary outline-none focus:border-brand-primary"
              value={alertAmount}
              onChange={(e) => setAlertAmount(Number(e.target.value) || 0)}
              onBlur={(e) => saveAlertAmount(Number(e.target.value) || 0).catch(fail)}
            />
          </span>
        </p>
        <div className="flex gap-1.5" role="group" aria-label="Quantos meses mostrar">
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => {
                setHorizon(h);
                try {
                  window.localStorage.setItem(HORIZON_STORAGE_KEY, String(h));
                } catch {
                  /* ignora */
                }
              }}
              className={[
                'h-8 rounded-full border px-3 text-xs',
                horizon === h
                  ? 'border-brand-primary bg-brand-primary/20 font-semibold text-brand-primary'
                  : 'border-border-strong text-text-secondary hover:text-text-primary',
              ].join(' ')}
            >
              {h} meses
            </button>
          ))}
        </div>
      </div>

      <PlanningAddBar
        ref={nameRef}
        form={form}
        onChange={setForm}
        onSubmit={submit}
        months={base.map((b) => b.month)}
        canSubmit={!!draftShape}
        isSaving={saving}
        hint={hint}
      />

      <PlanningGrid
        months={months}
        monthsBeforeDraft={monthsBefore}
        purchases={purchases}
        draft={draft}
        alertAmount={alertAmount}
        cardItems={cardItems}
        highlightId={highlightId}
        onToggleIncluded={(p) => update(p.id, { is_included: !p.is_included }).catch(fail)}
        onSetInstallment={(p, index, value) => update(p.id, setInstallment(p, index, value)).catch(fail)}
        onUpdate={(id, patch) => update(id, patch).catch(fail)}
        onRemove={removePurchase}
      />

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        <span>Barra: quanto da sobra do mês as compras usam</span>
        <span>Amarelo: acumulado abaixo do aviso · Vermelho: negativo</span>
        <span>≈ mês estimado pelos valores padrão</span>
        <span>Clique numa parcela para mudar só ela</span>
      </div>

      {undo && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border-strong bg-surface-2 py-2.5 pl-4 pr-3 text-sm shadow-lg">
          <span>{undo.message}</span>
          <button
            type="button"
            className="font-semibold text-brand-primary"
            onClick={() => {
              const u = undo;
              setUndo(null);
              u.run().catch(fail);
            }}
          >
            Desfazer
          </button>
        </div>
      )}
    </div>
  );
}
