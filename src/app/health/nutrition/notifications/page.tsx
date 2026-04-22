'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Bell, Save } from 'lucide-react';
import { PageHeader, Button, Skeleton, Switch, useToast } from '@phfront/millennium-ui';
import { PushNotificationsCard } from '@/components/push/PushNotificationsCard';
import { useDietSettings } from '@/hooks/health/use-diet-settings';
import { useDietPlan } from '@/hooks/health/use-diet-plan';
import { useUserStore } from '@/store/user-store';
import { TIMEZONE_OPTIONS } from '@/lib/daily-goals/timezone';

export default function NutritionNotificationsPage() {
  const user = useUserStore((s) => s.user);
  const { settings, isLoading: settingsLoading, upsertSettings } = useDietSettings();
  const { meals, isLoading: planLoading, updateMeal } = useDietPlan();
  const { toast } = useToast();

  const [pushEnabled, setPushEnabled] = useState(false);
  const [leadMinutes, setLeadMinutes] = useState(15);
  const [initialized, setInitialized] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [mealToggleId, setMealToggleId] = useState<string | null>(null);

  useEffect(() => {
    if (!settings || initialized) return;
    setPushEnabled(settings.meal_reminder_push_enabled);
    setLeadMinutes(settings.meal_reminder_lead_minutes);
    setInitialized(true);
  }, [settings, initialized]);

  const tz = user?.profile?.timezone?.trim() || 'America/Sao_Paulo';
  const tzLabel = TIMEZONE_OPTIONS.find((o) => o.value === tz)?.label ?? tz;

  async function handleSavePrefs() {
    const lead = Math.min(120, Math.max(5, Math.round(leadMinutes)));
    setSavingPrefs(true);
    try {
      await upsertSettings({
        meal_reminder_push_enabled: pushEnabled,
        meal_reminder_lead_minutes: lead,
      });
      setLeadMinutes(lead);
      toast.success('Preferências de lembrete guardadas');
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao guardar');
    }
    setSavingPrefs(false);
  }

  async function handleMealReminderToggle(mealId: string, checked: boolean) {
    setMealToggleId(mealId);
    try {
      await updateMeal(mealId, { meal_reminder_enabled: checked });
      toast.success(checked ? 'Lembrete ativado para esta refeição' : 'Lembrete desativado');
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao atualizar');
    }
    setMealToggleId(null);
  }

  const isLoading = settingsLoading || planLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 max-w-lg mx-auto">
        <Skeleton variant="block" className="h-12 w-full" />
        <Skeleton variant="block" className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto">
      <PageHeader
        title="Lembretes de refeição"
        subtitle="Receba um aviso no browser antes de cada refeição, usando o horário definido no plano e o seu fuso horário."
      />

      <div className="rounded-xl border border-border bg-surface-2 p-5 flex flex-col gap-3 text-sm text-text-muted">
        <p>
          <span className="font-medium text-text-primary">Fuso horário:</span> {tzLabel}
        </p>
        <p>
          Os lembretes usam o relógio local deste fuso. Para alterá-lo, vá ao{' '}
          <Link href="/profile" className="text-brand-primary underline hover:no-underline">
            perfil
          </Link>
          .
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-2 p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-text-primary">Notificações no browser</h2>
        <p className="text-xs text-text-muted">
          É necessário permitir notificações push para receber os lembretes quando a app não estiver
          aberta.
        </p>
        <PushNotificationsCard />
      </div>

      <div className="rounded-xl border border-border bg-surface-2 p-5 flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <Bell className="shrink-0 text-brand-primary mt-0.5" size={20} aria-hidden />
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="text-sm font-semibold text-text-primary">Lembretes por horário do plano</h2>
            <p className="text-xs text-text-muted">
              Quando ativo, enviamos um push por refeição nos minutos antes do horário planeado
              (definido em Minha Dieta). Se já tiver registado essa refeição no dia, o lembrete não é
              enviado.
            </p>
          </div>
        </div>

        <Switch
          label="Ativar lembretes de refeição"
          checked={pushEnabled}
          onCheckedChange={setPushEnabled}
        />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="lead-min">
            Antecedência (minutos antes)
          </label>
          <p className="text-xs text-text-muted">Entre 5 e 120 minutos.</p>
          <input
            id="lead-min"
            type="number"
            min={5}
            max={120}
            step={5}
            value={leadMinutes}
            onChange={(e) => setLeadMinutes(parseInt(e.target.value, 10) || 5)}
            disabled={!pushEnabled}
            className="max-w-40 px-4 py-2.5 text-sm rounded-lg bg-surface-3 border border-border text-text-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-primary/40 disabled:opacity-50"
          />
        </div>

        <Button
          onClick={handleSavePrefs}
          isLoading={savingPrefs}
          leftIcon={<Save size={16} />}
          className="self-end"
        >
          Guardar preferências
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface-2 p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-text-primary">Refeições do plano ativo</h2>
        {meals.length === 0 ? (
          <p className="text-sm text-text-muted">
            Não há plano ativo ou refeições. Crie o plano em{' '}
            <Link href="/health/nutrition/plan" className="text-brand-primary underline hover:no-underline">
              Minha Dieta
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {meals.map((meal) => {
              const hasTime = Boolean(meal.target_time);
              const timeLabel = hasTime ? meal.target_time!.slice(0, 5) : null;
              return (
                <li
                  key={meal.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-3 border border-border"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{meal.name}</p>
                    {hasTime ? (
                      <p className="text-xs text-text-muted tabular-nums">Horário planeado: {timeLabel}</p>
                    ) : (
                      <p className="text-xs text-text-muted">
                        Sem horário —{' '}
                        <Link
                          href="/health/nutrition/plan"
                          className="text-brand-primary underline hover:no-underline"
                        >
                          defina em Minha Dieta
                        </Link>
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={meal.meal_reminder_enabled}
                    disabled={!hasTime || mealToggleId === meal.id}
                    onCheckedChange={(checked) => void handleMealReminderToggle(meal.id, checked)}
                    aria-label={`Lembrete para ${meal.name}`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
