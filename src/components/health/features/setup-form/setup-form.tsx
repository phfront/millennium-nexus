'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input, DatePicker, useToast } from '@phfront/millennium-ui';
import { useHealthSettings } from '@/hooks/health/use-health-settings';
import { calcFeasibility, feasibilityToAlertVariant } from '@/lib/health/feasibility';
import type { FeasibilityResult } from '@/types/health';

function strToDate(s: string): Date {
  return new Date(s + 'T12:00:00');
}

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function SetupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { settings, upsertSettings } = useHealthSettings();

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [startWeight, setStartWeight] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(today);
  const [targetWeight, setTargetWeight] = useState('');
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  const [height, setHeight] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feasibility, setFeasibility] = useState<FeasibilityResult | null>(null);

  useEffect(() => {
    if (settings) {
      setStartWeight(String(settings.start_weight));
      setStartDate(settings.start_date ? strToDate(settings.start_date) : today);
      setTargetWeight(String(settings.target_weight));
      setTargetDate(settings.target_date ? strToDate(settings.target_date) : undefined);
      setHeight(settings.height ? String(settings.height) : '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    const sw = parseFloat(startWeight);
    const tw = parseFloat(targetWeight);
    if (sw > 0 && tw > 0 && tw < sw && targetDate) {
      setFeasibility(calcFeasibility(sw, tw, dateToStr(targetDate)));
    } else {
      setFeasibility(null);
    }
  }, [startWeight, targetWeight, targetDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sw = parseFloat(startWeight);
    const tw = parseFloat(targetWeight);
    const h = height ? parseInt(height) : null;

    if (!sw || !tw || !targetDate) {
      toast.error('Campos obrigatórios', 'Preencha peso inicial, peso alvo e data alvo.');
      return;
    }
    if (tw >= sw) {
      toast.error('Valores inválidos', 'O peso alvo deve ser menor que o peso inicial.');
      return;
    }
    if (targetDate <= today) {
      toast.error('Data inválida', 'A data alvo deve ser uma data futura.');
      return;
    }

    setIsSaving(true);
    try {
      await upsertSettings({
        start_weight: sw,
        start_date: dateToStr(startDate ?? today),
        target_weight: tw,
        target_date: dateToStr(targetDate),
        height: h,
      });
      toast.success('Configuração salva!', 'Sua jornada está registrada.');
      router.push('/');
    } catch {
      toast.error('Erro ao salvar', 'Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }

  const isEditing = !!settings;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        label="Peso inicial (kg)"
        type="number"
        step="0.1"
        min="0"
        placeholder="Ex: 90.0"
        value={startWeight}
        onChange={(e) => setStartWeight(e.target.value)}
        required
      />
      <DatePicker
        label="Data de início (pode ser no passado)"
        value={startDate}
        onChange={(d) => setStartDate(d ?? today)}
        max={today}
        clearable={false}
      />
      <Input
        label="Peso alvo (kg)"
        type="number"
        step="0.1"
        min="0"
        placeholder="Ex: 75.0"
        value={targetWeight}
        onChange={(e) => setTargetWeight(e.target.value)}
        required
      />
      <DatePicker
        label="Data alvo"
        value={targetDate}
        onChange={setTargetDate}
        min={tomorrow}
        clearable={false}
      />
      <Input
        label="Altura (cm) — opcional"
        type="number"
        min="100"
        max="250"
        placeholder="Ex: 175"
        value={height}
        onChange={(e) => setHeight(e.target.value)}
      />

      {feasibility && (
        <Alert
          variant={feasibilityToAlertVariant(feasibility.level)}
          title={`${feasibility.weeklyRateNeeded.toFixed(2)} kg/semana necessários`}
        >
          {feasibility.message}
        </Alert>
      )}

      <Button type="submit" variant="primary" isLoading={isSaving} className="mt-2">
        {isEditing ? 'Salvar alterações' : 'Começar jornada'}
      </Button>
    </form>
  );
}
