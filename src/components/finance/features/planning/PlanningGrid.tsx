'use client';

import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Switch } from '@phfront/millennium-ui';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';
import { formatAmountPlain, formatAmountSigned, formatMonthShort } from '@/lib/finance/format';
import {
  amountsByMonth,
  monthDiff,
  type PlannedPurchase,
  type PlanningMonth,
  type PlanPurchaseShape,
} from '@/lib/finance/planning';
import type { CardItemOption } from '@/hooks/finance/use-card-items';
import type { PlannedPurchaseInput } from '@/hooks/finance/use-planned-purchases';
import { describePurchase, isSplit } from './planning-shared';
import { PlanningRowEditor } from './PlanningRowEditor';

type Props = {
  months: PlanningMonth[];
  /** Os mesmos meses sem o rascunho da barra; null quando não há rascunho. */
  monthsBeforeDraft: PlanningMonth[] | null;
  purchases: PlannedPurchase[];
  draft: (PlanPurchaseShape & { name: string }) | null;
  alertAmount: number;
  cardItems: CardItemOption[];
  highlightId: string | null;
  onToggleIncluded: (p: PlannedPurchase) => void;
  onSetInstallment: (p: PlannedPurchase, index: number, value: number) => void;
  onUpdate: (id: string, patch: Partial<PlannedPurchaseInput>) => void;
  onRemove: (p: PlannedPurchase, reason: 'deleted' | 'bought') => void;
};

/** Valor mais frequente: as parcelas fora dele ganham o sublinhado dourado. */
function mostCommon(values: number[]): number {
  const count = new Map<number, number>();
  for (const v of values) count.set(Math.round(v), (count.get(Math.round(v)) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function PlanningGrid({
  months,
  monthsBeforeDraft,
  purchases,
  draft,
  alertAmount,
  cardItems,
  highlightId,
  onToggleIncluded,
  onSetInstallment,
  onUpdate,
  onRemove,
}: Props) {
  const money = useMoneyFormat();
  const keys = months.map((m) => m.month);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editCell, setEditCell] = useState<{ id: string; index: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapWidth, setWrapWidth] = useState(0);

  // O editor da linha fica "grudado" à esquerda com a largura visível da tabela,
  // não com a largura total (24 colunas): senão os campos somem para a direita.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function commitCell(p: PlannedPurchase, index: number, raw: string) {
    setEditCell(null);
    const v = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(v)) return;
    onSetInstallment(p, index, v);
  }

  function onCellKey(e: KeyboardEvent<HTMLInputElement>, p: PlannedPurchase, index: number) {
    if (e.key === 'Escape') {
      setEditCell(null);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCell(p, index, e.currentTarget.value);
      return;
    }
    // Tab anda pelas parcelas da mesma compra, como numa planilha.
    if (e.key === 'Tab') {
      e.preventDefault();
      const next = index + (e.shiftKey ? -1 : 1);
      const raw = e.currentTarget.value;
      const v = Number(raw);
      if (raw.trim() !== '' && Number.isFinite(v)) onSetInstallment(p, index, v);
      const visible = monthDiff(keys[0], p.start_month) + next;
      setEditCell(next >= 0 && next < p.installments && visible >= 0 && visible < keys.length ? { id: p.id, index: next } : null);
    }
  }

  /** `dim`: compra com a chave desligada — fica visível, apagada e riscada. */
  function cells(p: PlanPurchaseShape & { id?: string }, ghost: boolean, dim = false) {
    const amounts = amountsByMonth(p, keys);
    const split = isSplit(p);
    const typical = split && p.installment_amounts ? mostCommon(p.installment_amounts) : null;
    const startIdx = monthDiff(keys[0], p.start_month);
    return amounts.map((v, i) => {
      if (!v) return <td key={keys[i]} className="border-l border-border/40 px-2.5 py-2" />;
      const index = i - startIdx;
      const real = !ghost && p.id ? (p as PlannedPurchase) : null;
      if (real && split && editCell?.id === real.id && editCell.index === index) {
        return (
          <td key={keys[i]} className="border-l border-border/40 px-2 py-1.5 text-right">
            <input
              autoFocus
              type="number"
              step="any"
              defaultValue={Math.round(v * 100) / 100}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => onCellKey(e, real, index)}
              onBlur={(e) => editCell && commitCell(real, index, e.currentTarget.value)}
              className="h-7 w-[84px] rounded-md border border-brand-primary bg-surface-1 px-1.5 text-right text-sm tabular-nums text-text-primary outline-none ring-2 ring-brand-primary/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>
        );
      }
      const custom = typical !== null && Math.round(v) !== typical;
      const pill = [
        'inline-block rounded-md px-1.5 py-0.5 font-medium tabular-nums',
        ghost ? 'border border-dashed border-brand-primary text-brand-primary' : 'bg-surface-3 text-text-primary',
        custom ? 'shadow-[inset_0_-2px_0_var(--color-brand-secondary)]' : '',
        real && split ? 'cursor-text hover:outline hover:outline-1 hover:outline-border-strong' : '',
      ].join(' ');
      const content = (
        <>
          {formatAmountPlain(v)}
          {split && <small className="ml-1 text-[10px] font-normal text-text-muted">{index + 1}/{p.installments}</small>}
        </>
      );
      return (
        <td key={keys[i]} className={`border-l border-border/40 px-2.5 py-2 text-right ${dim ? 'opacity-40 line-through' : ''}`}>
          {real && split ? (
            <button
              type="button"
              className={pill}
              title="Clique para mudar só esta parcela"
              onClick={(e) => {
                e.stopPropagation();
                setEditCell({ id: real.id, index });
              }}
            >
              {content}
            </button>
          ) : (
            <span className={pill}>{content}</span>
          )}
        </td>
      );
    });
  }

  const nameCol = 'sticky left-0 z-[2] w-[150px] min-w-[150px] max-w-[150px] border-r border-border bg-surface-2 px-3 py-2.5 text-left md:w-[250px] md:min-w-[250px] md:max-w-[250px]';

  return (
    <div ref={wrapRef} className="overflow-x-auto rounded-xl border border-border bg-surface-2">
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className={`${nameCol} align-bottom`}>
              <div className="text-xs font-semibold text-text-muted">{months.length} meses</div>
              <div className="text-xs font-normal text-text-muted">Sobra do mês e acumulado</div>
            </th>
            {months.map((m, i) => {
              const tone = m.accumulated < 0 ? 'neg' : m.accumulated < alertAmount ? 'low' : 'ok';
              const usage = m.free > 0 ? Math.min(1, m.spent / m.free) : m.spent > 0 ? 1 : 0;
              const was = monthsBeforeDraft?.[i];
              const changed = was && Math.round(was.left) !== Math.round(m.left);
              return (
                <th
                  key={m.month}
                  title={`Livre antes das compras: ${money.format(m.free)}\nCompras: ${money.format(m.spent)}`}
                  className={[
                    'w-[108px] min-w-[108px] border-b border-l border-border/60 px-2.5 pb-3 pt-2.5 text-left align-top font-normal',
                    tone === 'neg' ? 'bg-danger-bg' : tone === 'low' ? 'bg-warning-bg' : '',
                  ].join(' ')}
                >
                  <div className="flex justify-between text-xs font-semibold text-text-muted">
                    <span>{formatMonthShort(m.month)}</span>
                    {m.estimated && <span className="font-normal" title="Estimado pelos valores padrão (além do horizonte da planilha)">≈</span>}
                  </div>
                  <div className={`mt-1 text-base font-bold tabular-nums ${m.left < 0 ? 'text-danger' : 'text-success'}`}>
                    {formatAmountSigned(m.left)}
                  </div>
                  <div className="h-[15px] text-[11px] tabular-nums text-text-muted line-through">
                    {changed ? formatAmountSigned(was.left) : ''}
                  </div>
                  <div className="my-1.5 h-1 overflow-hidden rounded-full bg-border-strong">
                    <div
                      className={`h-full rounded-full ${m.spent > m.free ? 'bg-danger' : 'bg-text-secondary'}`}
                      style={{ width: `${Math.round(usage * 100)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-text-muted">
                    acum.{' '}
                    <b
                      className={[
                        'font-semibold tabular-nums',
                        tone === 'neg' ? 'text-danger' : tone === 'low' ? 'text-warning' : 'text-text-secondary',
                      ].join(' ')}
                    >
                      {formatAmountPlain(m.accumulated)}
                    </b>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-surface-1/40 text-xs text-text-muted">
            <td className={`${nameCol} bg-surface-2`}>Livre antes das compras</td>
            {months.map((m) => (
              <td key={m.month} className="border-l border-border/40 px-2.5 py-2 text-right tabular-nums">
                {formatAmountPlain(m.free)}
              </td>
            ))}
          </tr>

          {/* A prévia vai no topo, perto da barra, para não sumir quando a lista cresce. */}
          {draft && (
            <tr className="bg-brand-primary/5">
              <td className={`${nameCol} shadow-[inset_3px_0_0_var(--color-brand-primary)]`}>
                <div className="truncate font-semibold text-text-primary">{draft.name || 'Nova compra'}</div>
                <div className="truncate text-xs text-text-muted">prévia · {describePurchase(draft, money.format)}</div>
              </td>
              {cells(draft, true)}
            </tr>
          )}

          {purchases.map((p) => {
            const open = openId === p.id;
            return (
              <Fragment key={p.id}>
                <tr
                  onClick={() => setOpenId(open ? null : p.id)}
                  className={[
                    'cursor-pointer border-t border-border/60 hover:bg-surface-3/40',
                    open ? 'bg-surface-3/50' : '',
                    highlightId === p.id ? 'animate-pulse' : '',
                  ].join(' ')}
                >
                  <td className={`${nameCol} border-t border-border/60`}>
                    <div className="flex items-center gap-2.5">
                      <span onClick={(e) => e.stopPropagation()} className="shrink-0">
                        <Switch
                          aria-label={p.is_included ? 'Na conta: clique para ignorar' : 'Ignorada: clique para pôr na conta'}
                          checked={p.is_included}
                          onCheckedChange={() => onToggleIncluded(p)}
                        />
                      </span>
                      <div className={`min-w-0 ${p.is_included ? '' : 'opacity-40'}`}>
                        <div className="truncate font-semibold text-text-primary">{p.name}</div>
                        <div className="truncate text-xs text-text-muted" title={describePurchase(p, money.format)}>
                          {describePurchase(p, money.format)}
                        </div>
                      </div>
                    </div>
                  </td>
                  {cells(p, false, !p.is_included)}
                </tr>
                {open && (
                  <tr>
                    <td colSpan={months.length + 1} className="bg-surface-3/30 p-0">
                      <PlanningRowEditor
                        purchase={p}
                        cardItems={cardItems}
                        width={wrapWidth}
                        onUpdate={(patch) => onUpdate(p.id, patch)}
                        onSetInstallment={(index, value) => onSetInstallment(p, index, value)}
                        onRemove={(reason) => {
                          setOpenId(null);
                          onRemove(p, reason);
                        }}
                        onClose={() => setOpenId(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}

          {purchases.length === 0 && !draft && (
            <tr>
              <td colSpan={months.length + 1} className="px-6 py-8 text-center text-text-muted">
                Nenhuma compra planejada ainda. Comece pela barra acima.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
