'use client';

import { Modal } from '@phfront/millennium-ui';
import { formatMonthLabel } from '@/lib/finance/format';
import { formatMoney } from '@/lib/finance/currency';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';

export type BreakdownRow = {
  key: string;
  label: string;
  /** Já na moeda de exibição — é o que soma no total do cartão. */
  amount: number;
  /** Valor original, quando o lançamento é noutra moeda (ex.: 2830 GBP). */
  nativeAmount?: number;
  nativeCurrency?: string;
  /** Só para despesas: estado de pagamento. */
  isPaid?: boolean;
};

export type BreakdownSection = {
  key: string;
  label: string;
  /** Cor da categoria, quando existe. */
  color?: string | null;
  rows: BreakdownRow[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  kind: 'income' | 'expense';
  month: string;
  sections: BreakdownSection[];
  /** Total do cartão; passado à parte para o modal bater sempre com ele. */
  total: number;
};

export function MonthBreakdownModal({ isOpen, onClose, kind, month, sections, total }: Props) {
  const money = useMoneyFormat();
  const isIncome = kind === 'income';
  const amountTone = isIncome ? 'text-green-500' : 'text-red-400';
  const visibleSections = sections.filter((s) => s.rows.length > 0);
  const rowCount = visibleSections.reduce((n, s) => n + s.rows.length, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${isIncome ? 'Receitas' : 'Despesas'} — ${formatMonthLabel(month)}`}
    >
      {rowCount === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">
          Nenhum lançamento de {isIncome ? 'receita' : 'despesa'} neste mês.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {visibleSections.map((section) => {
            const subtotal = section.rows.reduce((sum, r) => sum + r.amount, 0);
            // Uma secção só (ex.: receitas sem categorias) não precisa de cabeçalho nem subtotal.
            const showHeader = visibleSections.length > 1;

            return (
              <section key={section.key}>
                {showHeader && (
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="flex items-center gap-2 min-w-0">
                      {section.color && (
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: section.color }}
                        />
                      )}
                      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted truncate">
                        {section.label}
                      </span>
                    </span>
                    <span className={`text-xs tabular-nums font-semibold ${amountTone}`}>
                      {money.format(subtotal)}
                    </span>
                  </div>
                )}

                <ul className="flex flex-col border border-border/60 rounded-lg overflow-hidden">
                  {section.rows.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border/40 last:border-0 bg-surface-2/80 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-text-primary">{row.label}</span>
                        {row.isPaid != null && (
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ${
                              row.isPaid
                                ? 'bg-green-500/15 text-green-500'
                                : 'bg-surface-4 text-text-muted'
                            }`}
                          >
                            {row.isPaid ? 'Pago' : 'Pendente'}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`block tabular-nums font-medium ${amountTone}`}>
                          {money.format(row.amount)}
                        </span>
                        {row.nativeCurrency && row.nativeAmount != null && (
                          <span className="block text-[11px] leading-tight text-text-secondary">
                            {formatMoney(row.nativeAmount, row.nativeCurrency)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <div className="flex items-center justify-between rounded-lg bg-surface-3/50 px-3 py-2.5">
            <span className="text-sm font-semibold text-text-primary">
              Total {isIncome ? 'receitas' : 'despesas'}
            </span>
            <span className={`text-sm tabular-nums font-semibold ${amountTone}`}>
              {money.format(total)}
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}
