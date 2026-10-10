'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PiggyBank, ArrowRight } from 'lucide-react';
import { Modal, Input, Button } from '@phfront/millennium-ui';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';

/** Linha de despesa classificada como investimento, com o valor que já tem no mês. */
export type InvestmentTarget = {
  id: string;
  name: string;
  /** Valor efetivo do item neste mês (lançamento, ou o padrão se recorrente). */
  currentAmount: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Rótulo do mês a que a sobra pertence, só para o texto. */
  monthLabel: string;
  surplus: number;
  targets: InvestmentTarget[];
  /** Soma `amount` ao valor que o item já tem no mês. */
  onApply: (itemId: string, amount: number) => Promise<void>;
};

/**
 * Move a sobra do mês para uma linha de investimento.
 *
 * O aporte SOMA ao que o item já tem no mês em vez de substituir: a sobra é
 * dinheiro que ainda não tinha destino, e quem já aportava todo mês não quer
 * ver a recorrência apagada por um clique. Como a linha é despesa, o total do
 * mês sobe e a sobra desce exatamente o mesmo tanto — é a mesma conta vista
 * dos dois lados, não um número novo.
 */
export function SurplusAllocationModal({
  isOpen,
  onClose,
  monthLabel,
  surplus,
  targets,
  onApply,
}: Props) {
  const money = useMoneyFormat();
  const [targetId, setTargetId] = useState('');
  const [raw, setRaw] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTargetId(targets.length === 1 ? targets[0].id : '');
    setRaw(
      surplus > 0
        ? surplus.toFixed(2).replace('.', ',')
        : '',
    );
  }, [isOpen, surplus, targets]);

  const amount = money.parse(raw);
  const target = targets.find((t) => t.id === targetId) ?? null;
  const canApply = !!target && amount > 0 && !saving;
  const remaining = surplus - amount;

  async function submit() {
    if (!target || amount <= 0) return;
    setSaving(true);
    try {
      await onApply(target.id, amount);
      onClose();
    } catch {
      // Quem chama já avisou pelo toast; ficamos abertos para nova tentativa.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="Guardar a sobra" size="md">
      <>
        {targets.length === 0 ? (
          <div className="flex flex-col gap-3 text-sm text-text-secondary">
            <p>
              Você ainda não tem nenhuma despesa classificada como{' '}
              <strong className="text-text-primary">Investimento</strong>, que é para onde a sobra
              vai.
            </p>
            <p className="text-xs text-text-muted leading-relaxed">
              Crie a linha do aporte na planilha de Despesas (ex.: “Tesouro Direto”, “Reserva”) e
              escolha <strong>Investimento</strong> no campo Orçamento. Ela passa a aparecer aqui.
            </p>
            <div className="flex justify-end gap-2 pt-4 mt-1 border-t border-border">
              <Button type="button" variant="ghost" onClick={onClose}>
                Fechar
              </Button>
              <Link href="/finance/expenses">
                <Button type="button" variant="primary" rightIcon={<ArrowRight size={14} />}>
                  Ir para Despesas
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              Sobraram <strong className="text-text-primary">{money.format(surplus)}</strong> em{' '}
              {monthLabel}. Escolha para qual investimento levar — o valor é somado ao que a linha já
              tem no mês.
            </p>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wide">
                Investimento
              </span>
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                {targets.map((t) => {
                  const selected = t.id === targetId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTargetId(t.id)}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        selected
                          ? 'border-brand-primary bg-brand-primary/10'
                          : 'border-border bg-surface-3 hover:border-brand-primary/60'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <PiggyBank
                          size={14}
                          className={selected ? 'text-brand-primary shrink-0' : 'text-text-muted shrink-0'}
                        />
                        <span className="text-sm font-medium text-text-primary truncate">
                          {t.name}
                        </span>
                      </span>
                      <span className="text-xs text-text-muted shrink-0">
                        {money.format(t.currentAmount)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Input
              label={`Quanto levar (${money.symbol})`}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="ex. 982,24"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canApply) void submit();
              }}
            />

            {target && amount > 0 && (
              <div className="rounded-lg border border-border bg-surface-3 px-3 py-2.5 text-xs leading-relaxed text-text-secondary">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{target.name}</span>
                  <span className="shrink-0 font-medium text-text-primary">
                    {money.format(target.currentAmount)} →{' '}
                    {money.format(target.currentAmount + amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span>Sobra do mês</span>
                  <span
                    className={`shrink-0 font-medium ${
                      remaining < 0 ? 'text-red-500' : 'text-text-primary'
                    }`}
                  >
                    {money.format(surplus)} → {money.format(remaining)}
                  </span>
                </div>
                {remaining < 0 && (
                  <p className="mt-1.5 text-red-500">
                    Você está aportando mais do que sobrou: o mês fecha no negativo.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={saving}
                disabled={!canApply}
                onClick={() => void submit()}
              >
                Guardar sobra
              </Button>
            </div>
          </div>
        )}
      </>
    </Modal>
  );
}
