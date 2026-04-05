'use client';

import { useEffect, useState } from 'react';
import { Button, Input, useToast } from '@phfront/millennium-ui';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';

export function SpreadsheetSettingsForm() {
  const { toast } = useToast();
  const { monthsForward, isLoading, updateMonthsForward } = useFinanceSpreadsheetSettings();
  const [draft, setDraft] = useState(String(monthsForward));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading) setDraft(String(monthsForward));
  }, [monthsForward, isLoading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(draft, 10);
    if (Number.isNaN(n) || n < 0 || n > 36) {
      toast.error('Valor inválido', 'Usa um número entre 0 e 36.');
      return;
    }
    setSaving(true);
    const { error, pruned } = await updateMonthsForward(n);
    setSaving(false);
    if (error) {
      toast.error('Não foi possível guardar', error);
      return;
    }
    if (pruned) {
      toast.success('Preferência guardada', 'Removidas as linhas além do novo limite de meses.');
    } else {
      toast.success('Preferência guardada');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-2 border border-border rounded-xl p-5 space-y-4"
    >
      <div>
        <label htmlFor="months-forward" className="text-sm font-medium text-text-primary block mb-1">
          Meses à frente nas planilhas
        </label>
        <p className="text-xs text-text-muted mb-3">
          Quantos meses depois do mês atual queres ver colunas para planear receitas, despesas e pontuais.
          Os meses em que já tens dados continuam sempre visíveis. O dashboard também permite navegar até
          esse último mês.
        </p>
        <Input
          id="months-forward"
          type="number"
          min={0}
          max={36}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={isLoading}
          className="max-w-[120px]"
        />
      </div>
      <Button type="submit" disabled={saving || isLoading}>
        {saving ? 'A guardar…' : 'Guardar'}
      </Button>
    </form>
  );
}
