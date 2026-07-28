'use client';

import { useEffect, useState } from 'react';
import { Modal, Input, Button } from '@phfront/millennium-ui';
import { parseMoneyInput } from '@/lib/finance/format';
import { currencySymbol } from '@/lib/finance/currency';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  columnLabel: string;
  monthCount: number;
  /** Moeda em que a coluna é lançada; por omissão, a moeda de exibição. */
  currencyCode?: string;
  onApply: (amount: number) => Promise<void>;
};

export function SpreadsheetColumnFillModal({
  isOpen,
  onClose,
  columnLabel,
  monthCount,
  currencyCode,
  onApply,
}: Props) {
  const money = useMoneyFormat();
  const [raw, setRaw] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setRaw('');
  }, [isOpen, columnLabel]);

  async function submit() {
    const n = parseMoneyInput(raw);
    setSaving(true);
    try {
      await onApply(n);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Preencher coluna: ${columnLabel}`}>
      <p className="text-sm text-text-muted mb-3">
        Aplica o mesmo valor a todos os <strong>{monthCount}</strong> meses visíveis nesta planilha.
      </p>
      <Input
        label={`Valor (${currencySymbol(currencyCode ?? money.currency)})`}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="ex. 150,00"
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
      />
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={() => void submit()} disabled={saving}>
          Aplicar
        </Button>
      </div>
    </Modal>
  );
}
