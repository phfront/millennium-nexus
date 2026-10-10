'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Modal, Input, Button } from '@phfront/millennium-ui';
import { formatMonth, parseMoneyInput } from '@/lib/finance/format';
import {
  currencySymbol,
  deriveRateFromReceived,
  formatMoney,
} from '@/lib/finance/currency';

/**
 * Travar o câmbio de um mês de receita.
 *
 * O input é o valor que REALMENTE caiu na conta, não a cotação. É o número que
 * o usuário tem à mão (está no extrato) e o único que embute spread, IOF e
 * tarifa — a cotação sai por divisão. Pedir a taxa em vez do valor obrigaria a
 * fazer a conta de cabeça e ainda assim daria um número pior.
 */

export type IncomeFxLockTarget = {
  sourceName: string;
  month: string;
  /** Valor bruto na moeda da fonte — a base da divisão. */
  amount: number;
  /** Moeda em que a célula é lançada (GBP no caso típico). */
  entryCurrency: string;
  /** Cotação já travada, se houver: abre em modo de edição. */
  lockedRate: number | null;
  /** Conversão pela cotação viva, para pré-preencher e comparar. */
  liveAmount: number;
  /** Cotação viva do par, ou null se não há cotações no momento. */
  liveRate: number | null;
  /**
   * Mês já arquivado (anterior ao corrente). O arquivo congelou o total pela
   * cotação do dia em que arquivou, e travar aqui não o reescreve — a planilha
   * passa a mostrar um número e o Histórico outro. Vale avisar em vez de fingir.
   */
  isArchived: boolean;
};

type Props = {
  target: IncomeFxLockTarget | null;
  displayCurrency: string;
  onClose: () => void;
  onLock: (rate: number) => Promise<void>;
  onUnlock: () => Promise<void>;
};

export function IncomeFxLockModal({
  target,
  displayCurrency,
  onClose,
  onLock,
  onUnlock,
}: Props) {
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);

  const isLocked = !!target?.lockedRate;

  useEffect(() => {
    if (!target) return;
    // Já travado: parte do valor travado. Ainda não: parte da cotação viva,
    // que costuma estar a centavos do que caiu na conta.
    const start = target.lockedRate
      ? target.amount * target.lockedRate
      : target.liveAmount;
    setRaw(start > 0 ? start.toFixed(2).replace('.', ',') : '');
  }, [target]);

  const received = parseMoneyInput(raw);
  const rate = useMemo(
    () => (target ? deriveRateFromReceived(target.amount, received) : null),
    [target, received],
  );

  /** Quanto o travamento muda face à cotação de mercado de hoje. */
  const delta = target && rate != null ? received - target.liveAmount : null;

  async function submit() {
    if (!target || rate == null) return;
    setBusy(true);
    try {
      await onLock(rate);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    setBusy(true);
    try {
      await onUnlock();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (!target) return null;

  return (
    <Modal
      isOpen
      onClose={() => !busy && onClose()}
      title={`${isLocked ? 'Câmbio travado' : 'Travar câmbio'}: ${target.sourceName} · ${formatMonth(target.month)}`}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          Lançado como{' '}
          <strong className="text-text-primary">
            {formatMoney(target.amount, target.entryCurrency)}
          </strong>
          . Quanto realmente caiu na conta?
        </p>

        <Input
          label={`Recebido (${currencySymbol(displayCurrency)})`}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="ex. 19.100,00"
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          autoFocus
        />

        <div className="rounded-lg border border-border bg-surface-3 p-3 text-xs flex flex-col gap-1.5">
          <p className="flex items-center justify-between gap-3">
            <span className="text-text-muted">Cotação a travar</span>
            <span className="font-medium text-text-primary">
              {rate == null ? '—' : `1 ${target.entryCurrency} = ${formatMoney(rate, displayCurrency)}`}
            </span>
          </p>
          <p className="flex items-center justify-between gap-3">
            <span className="text-text-muted">Mercado hoje</span>
            <span className="text-text-secondary">
              {target.liveRate == null
                ? 'sem cotação'
                : `1 ${target.entryCurrency} = ${formatMoney(target.liveRate, displayCurrency)}`}
            </span>
          </p>
          {delta != null && Math.abs(delta) >= 0.01 && (
            <p className="flex items-center justify-between gap-3 pt-1 border-t border-border/60">
              <span className="text-text-muted">Diferença</span>
              <span className={delta < 0 ? 'text-amber-500' : 'text-green-500'}>
                {delta > 0 ? '+' : ''}
                {formatMoney(delta, displayCurrency)}
              </span>
            </p>
          )}
        </div>

        <p className="text-xs text-text-muted">
          {isLocked ? (
            <>
              Este mês está congelado nesta cotação — não acompanha mais o mercado. Ao destravar,
              ele volta para a cotação viva e passa a oscilar de novo todos os dias.
            </>
          ) : (
            <>
              Depois de travado, {formatMonth(target.month)} deixa de mudar de valor quando o câmbio
              se mexe. Só este mês desta fonte é afetado; os outros continuam pela cotação viva.
            </>
          )}
        </p>

        {target.isArchived && (
          <p className="text-xs text-amber-500">
            {formatMonth(target.month)} já foi arquivado. Travar aqui corrige a planilha e os totais
            vivos, mas o número congelado no Histórico e no Orçamento continua o que foi arquivado —
            para alinhar os dois é preciso rearquivar o mês.
          </p>
        )}

        {rate == null && received > 0 && target.amount <= 0 && (
          <p className="text-xs text-amber-500">
            O valor lançado é zero, então não há cotação para derivar. Preencha primeiro a célula.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          {isLocked && (
            <Button
              variant="secondary"
              onClick={() => void unlock()}
              disabled={busy}
              leftIcon={<Unlock size={14} />}
            >
              Destravar
            </Button>
          )}
          <Button
            onClick={() => void submit()}
            disabled={busy || rate == null}
            leftIcon={<Lock size={14} />}
          >
            {busy ? 'Salvando…' : isLocked ? 'Atualizar' : 'Travar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
