'use client';

import { useEffect, useState } from 'react';
import { Button, useToast } from '@phfront/millennium-ui';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';

const PRESET_DAYS = [
  { d: 0, label: 'No dia' },
  { d: 1, label: '1 dia antes' },
  { d: 2, label: '2 dias antes' },
  { d: 3, label: '3 dias antes' },
  { d: 5, label: '5 dias antes' },
  { d: 7, label: '7 dias antes' },
] as const;

export function ExpenseReminderSettingsForm() {
  const { toast } = useToast();
  const {
    expenseDueReminderDaysBefore,
    expenseDueReminderTime,
    isLoading,
    updateExpenseDueReminders,
  } = useFinanceSpreadsheetSettings();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [timeHm, setTimeHm] = useState('09:00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setSelected(new Set(expenseDueReminderDaysBefore));
      setTimeHm(expenseDueReminderTime);
    }
  }, [expenseDueReminderDaysBefore, expenseDueReminderTime, isLoading]);

  function toggleDay(d: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const days = [...selected].sort((a, b) => a - b);
    const { error } = await updateExpenseDueReminders(days, timeHm);
    setSaving(false);
    if (error) {
      toast.error('Não foi possível guardar', error);
      return;
    }
    toast.success(
      'Lembretes guardados',
      days.length === 0
        ? 'Sem dias selecionados, não serão enviados pushes de vencimento.'
        : 'Ativa as notificações push no perfil do Millennium Nexus se ainda não estiverem ligadas.',
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-2 border border-border rounded-xl p-5 space-y-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Lembretes de vencimento (despesas)</h3>
        <p className="text-xs text-text-muted mb-3">
          Para despesas com data ou dia de vencimento preenchidos, o Millennium Nexus envia um push no horário abaixo
          (no teu fuso definido no perfil do portal) nos dias que escolheres antes do vencimento. Requer
          notificações push ativadas no perfil.
        </p>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-text-secondary mb-2">Quando avisar</legend>
          <div className="flex flex-wrap gap-2">
            {PRESET_DAYS.map(({ d, label }) => (
              <label
                key={d}
                className={`inline-flex items-center gap-2 text-sm text-text-secondary cursor-pointer rounded-lg border px-3 py-2 bg-surface-3 hover:bg-surface-4 ${
                  selected.has(d) ? 'border-brand-primary bg-brand-primary/10' : 'border-border'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(d)}
                  onChange={() => toggleDay(d)}
                  className="rounded border-border"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div>
        <label htmlFor="reminder-time" className="text-sm font-medium text-text-primary block mb-1">
          Hora do lembrete
        </label>
        <input
          id="reminder-time"
          type="time"
          value={timeHm}
          onChange={(e) => setTimeHm(e.target.value.slice(0, 5))}
          disabled={isLoading}
          className="px-3 py-2 rounded-lg bg-surface-3 border border-border text-sm text-text-primary outline-none focus:border-brand-primary max-w-[140px]"
        />
      </div>
      <Button type="submit" disabled={saving || isLoading}>
        {saving ? 'A guardar…' : 'Guardar lembretes'}
      </Button>
    </form>
  );
}
