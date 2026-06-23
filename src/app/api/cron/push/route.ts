import { NextResponse } from 'next/server';
import { runSendPushNotifications } from '@/lib/push/send-push-notifications';

/**
 * Cron local — substitui a Edge Function send-push-notifications.
 * Protegido por CRON_SECRET (header Authorization: Bearer … ou x-cron-secret).
 *
 * Task Scheduler: scripts/cron-push.ps1 a cada 15–30 min.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearer !== secret && cronHeader !== secret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const result = await runSendPushNotifications();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[cron/push]', err);
    const message = err instanceof Error ? err.message : 'Erro ao enviar push';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
