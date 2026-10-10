'use client';

import { useMemo } from 'react';
import { CheckCheck, ChevronUp, Equal, Trash2 } from 'lucide-react';
import { Button } from '@phfront/millennium-ui';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';
import { formatMonthShort } from '@/lib/finance/format';
import { shiftMonthBy, toMonthDate } from '@/lib/finance/finance';
import { installmentAmountsOf, resizeInstallments, type PlannedPurchase } from '@/lib/finance/planning';
import type { CardItemOption } from '@/hooks/finance/use-card-items';
import type { PlannedPurchaseInput } from '@/hooks/finance/use-planned-purchases';
import { PLANNING_MAX_MONTHS } from '@/hooks/finance/use-planning-baseline';
import { PAY_CHOICES, fieldClass, isSplit, parsePayChoice, payChoiceOf } from './planning-shared';

type Props = {
  purchase: PlannedPurchase;
  cardItems: CardItemOption[];
  /** Largura visível da tabela, para o editor não sumir à direita quando ela rola. */
  width: number;
  onUpdate: (patch: Partial<PlannedPurchaseInput>) => void;
  onSetInstallment: (index: number, value: number) => void;
  onRemove: (reason: 'deleted' | 'bought') => void;
  onClose: () => void;
};

const label = 'mb-1 ml-0.5 block text-[11px] font-medium text-text-muted';

/**
 * Edição em linha, logo abaixo da compra — sem modal. Os campos gravam ao sair
 * (blur / Enter), não a cada tecla: a projeção já reage à prévia da barra, e
 * gravar a cada dígito encheria o banco de updates pela metade.
 */
export function PlanningRowEditor({ purchase: p, cardItems, width, onUpdate, onSetInstallment, onRemove, onClose }: Props) {
  const money = useMoneyFormat();
  const split = isSplit(p);
  const parts = installmentAmountsOf(p);

  // Os meses do seletor: os da tela e, se a compra começou antes, o mês dela.
  const monthOptions = useMemo(() => {
    const first = toMonthDate(new Date());
    const list = Array.from({ length: PLANNING_MAX_MONTHS }, (_, i) => shiftMonthBy(first, i));
    return p.start_month < first ? [p.start_month, ...list] : list;
  }, [p.start_month]);

  function changePay(choice: string) {
    const next = parsePayChoice(choice);
    if (p.pay_mode === 'installments' && next.pay_mode === 'installments') {
      onUpdate(resizeInstallments(p, next.installments));
    } else {
      onUpdate({ ...next, installment_amounts: null });
    }
  }

  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  return (
    <div className="sticky left-0 grid grid-cols-2 items-end gap-2.5 p-3.5 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]" style={width ? { width } : undefined}>
      <label className="col-span-2 md:col-span-1">
        <span className={label}>Nome</span>
        <input
          key={`name-${p.name}`}
          className={fieldClass}
          defaultValue={p.name}
          onKeyDown={blurOnEnter}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v && v !== p.name) onUpdate({ name: v });
          }}
        />
      </label>

      <label>
        <span className={label}>
          {p.pay_mode === 'monthly'
            ? 'Valor por mês'
            : p.pay_mode === 'yearly'
              ? 'Valor por ano'
              : p.installment_amounts
                ? 'Total (soma das parcelas)'
                : 'Valor total'}
        </span>
        <input
          key={`amount-${p.amount}`}
          className={`${fieldClass} tabular-nums ${p.installment_amounts ? 'opacity-70' : ''}`}
          type="number"
          min="0"
          step="any"
          defaultValue={p.amount}
          readOnly={!!p.installment_amounts}
          title={p.installment_amounts ? 'Com parcelas diferentes, o total é a soma delas. Use "Igualar parcelas" para voltar a dividir igual.' : undefined}
          onKeyDown={blurOnEnter}
          onBlur={(e) => {
            const v = Number(e.currentTarget.value);
            if (!p.installment_amounts && Number.isFinite(v) && v > 0 && v !== p.amount) onUpdate({ amount: v });
          }}
        />
      </label>

      <label>
        <span className={label}>Como paga</span>
        <select className={fieldClass} value={payChoiceOf(p)} onChange={(e) => changePay(e.target.value)}>
          {PAY_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className={label}>{split ? 'Primeira em' : 'Quando'}</span>
        <select className={fieldClass} value={p.start_month} onChange={(e) => onUpdate({ start_month: e.target.value })}>
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {formatMonthShort(m)}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className={label}>
          Cartão <span className="font-normal">(opcional)</span>
        </span>
        <select
          className={fieldClass}
          value={p.card_item_id ?? ''}
          onChange={(e) => onUpdate({ card_item_id: e.target.value || null })}
        >
          <option value="">Nenhum</option>
          {cardItems.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {split && (
        <>
          <div className="col-span-full mt-1 flex items-center justify-between gap-2 text-xs text-text-secondary">
            <span>
              Parcelas <span className="text-text-muted">· mude qualquer uma; o total vira a soma</span>
            </span>
            {p.installment_amounts && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Equal size={14} />}
                onClick={() => onUpdate({ installment_amounts: null })}
              >
                Igualar parcelas
              </Button>
            )}
          </div>
          <div className="col-span-full grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
            {parts.map((v, k) => (
              <label key={`${k}-${v}`}>
                <span className={label}>
                  {k + 1}/{p.installments} · {formatMonthShort(shiftMonthBy(p.start_month, k))}
                </span>
                <input
                  className={`${fieldClass} h-9 text-right tabular-nums`}
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={Math.round(v * 100) / 100}
                  onKeyDown={blurOnEnter}
                  onBlur={(e) => {
                    const n = Number(e.currentTarget.value);
                    if (Number.isFinite(n) && Math.round(n * 100) !== Math.round(v * 100)) onSetInstallment(k, n);
                  }}
                />
              </label>
            ))}
          </div>
        </>
      )}

      <div className="col-span-full mt-1 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<CheckCheck size={14} />}
          title={`Tira do planejamento. Nada é lançado: a compra de ${money.format(p.amount)} entra pelo cartão, em Despesas.`}
          onClick={() => onRemove('bought')}
        >
          Já comprei
        </Button>
        <Button variant="ghost" size="sm" className="text-danger" leftIcon={<Trash2 size={14} />} onClick={() => onRemove('deleted')}>
          Excluir
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" leftIcon={<ChevronUp size={14} />} onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
