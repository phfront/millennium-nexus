'use client';

import { useEffect, useState } from 'react';
import { Modal, Input, Button } from '@phfront/millennium-ui';
import { parseBRLInput } from '@/lib/finance/format';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  columnLabel: string;
  monthCount: number;
  onApply: (amount: number) => Promise<void>;
};

export function SpreadsheetColumnFillModal({
  isOpen,
  onClose,
  columnLabel,
  monthCount,
  onApply,
}: Props) {
  const [raw, setRaw] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setRaw('');
  }, [isOpen, columnLabel]);

  async function submit() {
    const n = parseBRLInput(raw);
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
        label="Valor (R$)"
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
