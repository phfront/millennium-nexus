'use client';

import { useEffect, useState } from 'react';
import { Button, useToast } from '@phfront/millennium-ui';
import { useCaloriasSettings } from '@/hooks/health/use-calorias-settings';
import {
  formatActiveDaysLabel,
  isActiveDaysMaskJsDow,
  popcount7,
  toggleActiveDaysMaskJsDow,
  weeklyTargetKcal,
} from '@/lib/health/calorias';
import { formatKcal } from '@/lib/health/nutrition';
import { WEEK_DAY_LABELS } from '@/lib/habits-goals/scheduling';

function hasAtLeastOneDay(mask: number): boolean {
  return (mask & 0x7f) !== 0;
}

export function CaloriasSettingsForm() {
  const { settings, isLoading, upsertSettings } = useCaloriasSettings();
  const { toast } = useToast();
  const [daily, setDaily] = useState(400);
  const [mask, setMask] = useState(31);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setDaily(settings.daily_target_kcal);
    setMask(settings.active_days & 0x7f);
  }, [settings]);

  async function handleSave() {
    if (!hasAtLeastOneDay(mask)) {
      toast.error('Dias ativos', 'Selecione pelo menos um dia da semana.');
      return;
    }
    if (daily < 1 || !Number.isFinite(daily)) {
      toast.error('Meta diária', 'Indique um valor positivo de kcal.');
      return;
    }
    setSaving(true);
    try {
      await upsertSettings({ daily_target_kcal: Math.round(daily), active_days: mask });
      toast.success('Guardado', 'Configuração de calorias atualizada.');
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao guardar');
    }
    setSaving(false);
  }

  if (isLoading) {
    return <p className="text-sm text-text-muted">A carregar…</p>;
  }

  const previewWeekly = weeklyTargetKcal({ daily_target_kcal: Math.round(daily) || 400, active_days: mask });
  const activeDayCount = popcount7(mask);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-border bg-surface-2/30 p-4 sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Metas</h2>
        <p className="mt-1 text-xs text-text-muted">
          Defina a meta diária de queima nos dias ativos e quais dias contam para a meta semanal (os restantes usam o saldo
          semanal).
        </p>
      </div>

      <div>
        <label htmlFor="daily-kcal" className="mb-1 block text-xs font-medium text-text-secondary">
          Meta diária (kcal) — dias ativos
        </label>
        <input
          id="daily-kcal"
          type="number"
          min={1}
          step={1}
          value={daily}
          onChange={(e) => setDaily(Number(e.target.value))}
          className="w-full max-w-xs rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary tabular-nums outline-none focus:border-brand-primary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text-secondary">Dias ativos</label>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_DAY_LABELS.map((label, dow) => {
            const isActive = isActiveDaysMaskJsDow(mask, dow);
            return (
              <button
                key={dow}
                type="button"
                onClick={() => setMask((m) => toggleActiveDaysMaskJsDow(m, dow))}
                className={[
                  'h-10 w-10 cursor-pointer rounded-lg text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface-3 text-text-muted hover:bg-surface-4',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-text-muted">
          Selecionados: <span className="text-text-secondary">{formatActiveDaysLabel(mask)}</span>
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-secondary">
        <span className="font-medium text-text-primary">Pré-visualização:</span>{' '}
        <span className="tabular-nums">{formatKcal(previewWeekly)} kcal</span> por semana (
        {formatKcal(Math.round(daily) || 400)} × {activeDayCount} dias)
      </div>

      <Button type="button" disabled={saving} onClick={() => void handleSave()} className="w-full sm:w-auto">
        Guardar
      </Button>
    </div>
  );
}
