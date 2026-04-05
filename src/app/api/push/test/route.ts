import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { configureWebPush, webpush } from '@/lib/push/server';

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

  const { data: rows, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rows?.length) {
    return NextResponse.json({ error: 'Nenhuma subscription ativa. Ative as notificações primeiro.' }, { status: 400 });
  }

  const payload = JSON.stringify({
    title: 'Millennium Nexus',
    body: 'Notificação de teste — push funcionando!',
    url: '/',
    tag: 'nexus-test',
  });

  const results: { endpoint: string; ok: boolean; error?: string }[] = [];

  for (const row of rows as { endpoint: string; p256dh: string; auth: string }[]) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };

    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: 60,
        urgency: 'high',
      });
      results.push({ endpoint: row.endpoint.slice(0, 48) + '…', ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ endpoint: row.endpoint.slice(0, 48) + '…', ok: false, error: message });
    }
  }

  const anyOk = results.some((r) => r.ok);
  return NextResponse.json({ ok: anyOk, results });
}
