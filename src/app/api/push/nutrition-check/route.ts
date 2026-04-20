import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { configureWebPush, webpush } from '@/lib/push/server';

/**
 * POST /api/push/nutrition-check
 *
 * Disparo manual de verificação de notificações de nutrição.
 * Verifica hidratação (< 50% da meta) e checklist vazio do dia.
 * Pode ser chamado pela Edge Function ou para testes manuais.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    configureWebPush();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'VAPID não configurado';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Busca subscriptions do user
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id);

  if (!subs?.length) {
    return NextResponse.json({ error: 'Nenhuma subscription ativa.' }, { status: 400 });
  }

  // Busca diet_settings
  const { data: settings } = await supabase
    .from('diet_settings')
    .select('daily_water_target_ml')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!settings) {
    return NextResponse.json({ error: 'Configure a nutrição primeiro.' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const notifications: string[] = [];

  // Check water
  const waterTarget = (settings as { daily_water_target_ml: number }).daily_water_target_ml;
  if (waterTarget > 0) {
    const { data: waterRows } = await supabase
      .from('water_logs')
      .select('amount_ml')
      .eq('user_id', user.id)
      .eq('logged_date', today);

    const totalWater = (waterRows ?? []).reduce(
      (sum: number, r: { amount_ml: number }) => sum + r.amount_ml,
      0,
    );

    if (totalWater < waterTarget * 0.5) {
      const pct = Math.round((totalWater / waterTarget) * 100);
      notifications.push(`💧 Hidratação: ${pct}% da meta`);

      for (const sub of subs as { endpoint: string; p256dh: string; auth: string }[]) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: '💧 Hidratação baixa',
              body: `Você consumiu apenas ${pct}% da meta de água. Beba mais!`,
              url: '/health/nutrition',
              tag: `water-manual-${today}`,
              icon: '/icons/icon-192.png',
            }),
            { TTL: 60, urgency: 'high' as const },
          );
        } catch {
          // ignore individual failures
        }
      }
    }
  }

  // Check meals
  const { data: logRows } = await supabase
    .from('diet_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('logged_date', today)
    .limit(1);

  if (!logRows || logRows.length === 0) {
    notifications.push('🍽️ Nenhuma refeição registrada hoje');

    for (const sub of subs as { endpoint: string; p256dh: string; auth: string }[]) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: '🍽️ Marque suas refeições',
            body: 'Você ainda não registrou nenhuma refeição hoje.',
            url: '/health/nutrition',
            tag: `meal-manual-${today}`,
            icon: '/icons/icon-192.png',
          }),
          { TTL: 60, urgency: 'normal' as const },
        );
      } catch {
        // ignore individual failures
      }
    }
  }

  return NextResponse.json({
    ok: true,
    notifications,
    message: notifications.length > 0 ? 'Notificações enviadas' : 'Nenhum alerta necessário',
  });
}
