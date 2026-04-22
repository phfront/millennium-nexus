'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Save } from 'lucide-react';
import { PageHeader, Button, Skeleton, useToast } from '@phfront/millennium-ui';
import { useDietSettings } from '@/hooks/health/use-diet-settings';

export default function NutritionSettingsPage() {
  const { settings, isLoading, upsertSettings } = useDietSettings();
  const { toast } = useToast();

  const [values, setValues] = useState({
    weekly_extra_buffer: settings?.weekly_extra_buffer ?? 0,
    daily_water_target_ml: settings?.daily_water_target_ml ?? 2500,
  });
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync initial values once loaded
  if (settings && !initialized) {
    setValues({
      weekly_extra_buffer: settings.weekly_extra_buffer,
      daily_water_target_ml: settings.daily_water_target_ml,
    });
    setInitialized(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await upsertSettings(values);
      toast.success('Configurações salvas');
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao salvar');
    }
    setSaving(false);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 max-w-md mx-auto">
        <Skeleton variant="block" className="h-12 w-full" />
        <Skeleton variant="block" className="h-40 w-full" />
      </div>
    );
  }

  const fields = [
    {
      key: 'weekly_extra_buffer' as const,
      label: 'Buffer semanal de extras',
      unit: 'kcal',
      description: 'Calorias extras permitidas por semana (0 = desativado).',
      min: 0,
      max: 10000,
      step: 100,
    },
    {
      key: 'daily_water_target_ml' as const,
      label: 'Meta de água diária',
      unit: 'ml',
      description: 'Volume de água a consumir por dia.',
      min: 500,
      max: 10000,
      step: 100,
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto">
      <PageHeader
        title="Configurações"
        subtitle="As calorias planejadas vêm do plano de dieta. Aqui ajusta buffer de extras e meta de água."
      />

      <div className="flex flex-col gap-5 p-5 bg-surface-2 rounded-xl border border-border">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary">{field.label}</label>
            <p className="text-xs text-text-muted">{field.description}</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={values[field.key]}
                onChange={(e) =>
                  setValues((p) => ({ ...p, [field.key]: parseInt(e.target.value) || 0 }))
                }
                className="flex-1 px-4 py-2.5 text-sm rounded-lg bg-surface-3 border border-border text-text-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-primary/40 transition-all"
              />
              <span className="text-sm text-text-muted w-10">{field.unit}</span>
            </div>
          </div>
        ))}

        <Button
          onClick={handleSave}
          isLoading={saving}
          leftIcon={<Save size={16} />}
          className="self-end mt-2"
        >
          Salvar
        </Button>
      </div>

      <p className="text-sm text-text-muted text-center">
        Lembretes push antes das refeições:{' '}
        <Link href="/health/nutrition/notifications" className="text-brand-primary underline hover:no-underline">
          configurar lembretes
        </Link>
        .
      </p>
    </div>
  );
}
