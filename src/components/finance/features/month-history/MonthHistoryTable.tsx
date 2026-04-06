'use client';

import { useState } from 'react';
import { Skeleton } from '@phfront/millennium-ui';
import { useFinanceMonthSnapshots } from '@/hooks/finance/use-finance-month-snapshots';
import { formatBRL, formatMonth } from '@/lib/finance/format';
import { surplusColor } from '@/lib/finance/finance';
import { MonthDetailModal } from '@/components/finance/features/month-history/MonthDetailModal';

export function MonthHistoryTable() {
  const { snapshots, isLoading } = useFinanceMonthSnapshots();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (snapshots.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-6 text-sm text-text-muted text-center">
        <p className="mb-2">Ainda não há meses arquivados.</p>
        <p>
          Quando um mês calendarial termina e voltas a abrir o Finance, guardamos automaticamente um resumo
          desse mês para consulta aqui. Os valores ficam congelados — alterações posteriores nas planilhas
          não mudam o histórico.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-surface-3 border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-text-muted">Mês</th>
              <th className="text-right px-3 py-2 font-medium text-text-muted">Receitas</th>
              <th className="text-right px-3 py-2 font-medium text-text-muted">Despesas fixas</th>
              <th className="text-right px-3 py-2 font-medium text-text-muted">Pontuais</th>
              <th className="text-right px-3 py-2 font-medium text-text-muted">Sobra</th>
              <th className="text-right px-3 py-2 font-medium text-text-muted">Acumulado</th>
              <th className="text-left px-3 py-2 font-medium text-text-muted hidden md:table-cell">
                Arquivado em
              </th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => {
              const monthKey = s.month.length >= 10 ? s.month.slice(0, 10) : s.month;
              const archived = new Date(s.snapshot_at);
              return (
                <tr
                  key={monthKey}
                  className="border-b border-border/60 hover:bg-surface-3/60 cursor-pointer transition-colors"
                  onClick={() => setSelectedMonth(monthKey)}
                  title="Clique para ver os lançamentos deste mês"
                >
                  <td className="px-3 py-2 font-medium text-text-primary">{formatMonth(monthKey)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                    {formatBRL(Number(s.total_income))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                    {formatBRL(Number(s.total_expenses))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                    {formatBRL(Number(s.total_one_time))}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${surplusColor(Number(s.surplus))}`}>
                    {formatBRL(Number(s.surplus))}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${surplusColor(Number(s.accumulated_surplus))}`}>
                    {formatBRL(Number(s.accumulated_surplus))}
                  </td>
                  <td className="px-3 py-2 text-text-muted text-xs hidden md:table-cell">
                    {archived.toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MonthDetailModal
        month={selectedMonth}
        onClose={() => setSelectedMonth(null)}
      />
    </>
  );
}
