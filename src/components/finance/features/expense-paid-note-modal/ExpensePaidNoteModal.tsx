'use client';

import { useEffect, useState } from 'react';
import { Modal, Button, Textarea } from '@phfront/millennium-ui';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Texto de ajuda acima do campo */
  description?: string;
  onConfirm: (note: string) => void | Promise<void>;
  /** Enquanto confirma (desativa botões) */
  submitting?: boolean;
};

export function ExpensePaidNoteModal({
  isOpen,
  onClose,
  title = 'Marcar como pago',
  description = 'Opcional: nota sobre este pagamento (fica guardada no histórico quando o mês for arquivado).',
  onConfirm,
  submitting = false,
}: Props) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen) setNote('');
  }, [isOpen]);

  async function handleConfirm() {
    await onConfirm(note);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <>
        <p className="text-sm text-text-muted mb-3">{description}</p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex.: pago no cartão, comprovante no e-mail…"
          rows={4}
          className="w-full min-h-[88px] text-sm"
          disabled={submitting}
        />
        <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" onClick={() => void handleConfirm()} disabled={submitting}>
            {submitting ? 'A guardar…' : 'Confirmar'}
          </Button>
        </div>
      </>
    </Modal>
  );
}
