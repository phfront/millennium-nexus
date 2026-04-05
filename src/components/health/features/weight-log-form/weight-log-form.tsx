'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, DatePicker, DeltaBadge, StepperField, useToast } from '@phfront/millennium-ui';
import { useWeightLogs } from '@/hooks/health/use-weight-logs';

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function WeightLogForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { addLog, latestLog } = useWeightLogs(10);

  const todayDate = new Date();
  todayDate.setHours(12, 0, 0, 0);

  const [weight, setWeight] = useState('');

  useEffect(() => {
    if (latestLog && !weight) {
      setWeight(String(latestLog.weight));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestLog]);
  const [loggedAt, setLoggedAt] = useState<Date>(todayDate);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const parsedWeight = parseFloat(weight);
  const diff = !isNaN(parsedWeight) && latestLog ? parsedWeight - latestLog.weight : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsedWeight || parsedWeight <= 0) {
      toast.error('Peso inválido', 'Informe um peso maior que zero.');
      return;
    }

    setIsSaving(true);
    try {
      const loggedAtStr = dateToStr(loggedAt);
      await addLog({ weight: parsedWeight, logged_at: loggedAtStr, note: note || undefined });
      toast.success('Peso registrado!', `${parsedWeight.toFixed(1)} kg em ${loggedAtStr}.`);
      router.push('/');
    } catch (err) {
      if (err instanceof Error && err.message === 'duplicate') {
        toast.error('Já registrado', 'Você já tem um registro nesta data. Exclua-o no Histórico para adicionar novo.');
      } else {
        toast.error('Erro ao salvar', 'Tente novamente.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <StepperField
          label="Peso atual"
          value={weight}
          onChange={setWeight}
          suffix="kg"
          decrementAriaLabel="Diminuir 0,1 kg"
          incrementAriaLabel="Aumentar 0,1 kg"
        />
        {diff !== null && (
          <div className="flex justify-center">
            <DeltaBadge delta={diff} unit="kg" suffix="vs. último registro" invertSemantics />
          </div>
        )}
      </div>

      <DatePicker
        label="Data do registro"
        value={loggedAt}
        onChange={(d) => setLoggedAt(d ?? todayDate)}
        max={todayDate}
        clearable={false}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">
          Observação <span className="text-text-muted font-normal">(opcional)</span>
        </label>
        <textarea
          maxLength={200}
          rows={2}
          placeholder="Ex: Pós-treino, retenção hídrica..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-lg border border-border bg-surface-3 px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-brand-primary resize-none"
        />
        <span className="text-xs text-text-muted text-right">{note.length}/200</span>
      </div>

      <Button type="submit" variant="primary" isLoading={isSaving}>
        Registrar peso
      </Button>
    </form>
  );
}
