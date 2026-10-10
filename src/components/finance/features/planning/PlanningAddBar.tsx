'use client';

import { forwardRef, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@phfront/millennium-ui';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';
import { formatMonthShort } from '@/lib/finance/format';
import { PAY_CHOICES, fieldClass, parsePayChoice, type AddBarForm } from './planning-shared';

type Props = {
  form: AddBarForm;
  onChange: (form: AddBarForm) => void;
  onSubmit: () => void;
  months: string[];
  canSubmit: boolean;
  isSaving: boolean;
  /** Linha de resposta embaixo da barra ("Cabe." / "Aperta…"). */
  hint: ReactNode;
};

/**
 * Barra fixa, sem modal: nome · valor · como paga · quando · Enter. Depois de
 * adicionar, o Planning limpa só nome e valor e devolve o foco ao nome — dá
 * para lançar várias compras parecidas em sequência sem tirar a mão do teclado.
 */
export const PlanningAddBar = forwardRef<HTMLInputElement, Props>(function PlanningAddBar(
  { form, onChange, onSubmit, months, canSubmit, isSaving, hint },
  nameRef,
) {
  const money = useMoneyFormat();
  const { pay_mode, installments } = parsePayChoice(form.pay);
  const split = pay_mode === 'installments' && installments > 1;
  const amountLabel =
    pay_mode === 'monthly' ? 'Valor por mês' : pay_mode === 'yearly' ? 'Valor por ano' : split ? 'Valor' : 'Valor total';
  const set = (patch: Partial<AddBarForm>) => onChange({ ...form, ...patch });

  return (
    <form
      className="mb-4 rounded-xl border border-border bg-surface-2 p-3"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !isSaving) onSubmit();
      }}
    >
      <div className="grid grid-cols-2 items-end gap-2 md:grid-cols-[minmax(180px,1.6fr)_minmax(130px,.8fr)_minmax(110px,.7fr)_minmax(120px,.8fr)_auto]">
        <label className="col-span-2 md:col-span-1">
          <span className="mb-1 ml-0.5 block text-[11px] font-medium text-text-muted">O que você quer comprar?</span>
          <input
            ref={nameRef}
            className={`${fieldClass} font-medium`}
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Ex.: notebook, sofá, viagem…"
            autoFocus
          />
        </label>

        <div>
          <div className="mb-1 ml-0.5 flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
            <label htmlFor="planning-add-amount">{amountLabel}</label>
            {split && (
              <span className="inline-flex overflow-hidden rounded-md border border-border-strong" role="group" aria-label="O valor é">
                {(['total', 'installment'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => set({ unit: u })}
                    className={[
                      'px-1.5 text-[10px] leading-4',
                      form.unit === u ? 'bg-surface-3 font-semibold text-text-primary' : 'text-text-muted',
                    ].join(' ')}
                  >
                    {u === 'total' ? 'total' : 'parcela'}
                  </button>
                ))}
              </span>
            )}
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
              {money.symbol}
            </span>
            <input
              id="planning-add-amount"
              className={`${fieldClass} pl-10 tabular-nums`}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={form.amountRaw}
              onChange={(e) => set({ amountRaw: e.target.value })}
              placeholder="0"
            />
          </div>
        </div>

        <label>
          <span className="mb-1 ml-0.5 block text-[11px] font-medium text-text-muted">Como paga</span>
          <select className={fieldClass} value={form.pay} onChange={(e) => set({ pay: e.target.value })}>
            {PAY_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 ml-0.5 block text-[11px] font-medium text-text-muted">{split ? 'Primeira em' : 'Quando'}</span>
          <select className={fieldClass} value={form.start} onChange={(e) => set({ start: e.target.value })}>
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthShort(m)}
              </option>
            ))}
          </select>
        </label>

        <Button
          type="submit"
          variant="primary"
          className="col-span-2 h-10 md:col-span-1"
          disabled={!canSubmit}
          isLoading={isSaving}
          leftIcon={<Plus size={16} />}
        >
          Adicionar
          <kbd className="ml-1 hidden rounded border border-white/30 px-1 text-[10px] font-normal opacity-80 md:inline">Enter</kbd>
        </Button>
      </div>
      <div className="mx-0.5 mt-2.5 min-h-[22px] text-sm text-text-secondary">{hint}</div>
    </form>
  );
});
