/**
 * Edge Function: send-push-notifications
 *
 * Disparada via cron a cada minuto pelo pg_cron do Supabase.
 * 1) Daily Goals: regras em `tracker_notifications` (horário local do utilizador).
 * 2) Nexus Finance: despesas com vencimento — `finance_user_settings` define
 *    quantos dias antes avisar e a hora do push; dedupe em `finance_expense_reminder_sent`.
 *
 * Secrets necessários (Supabase Dashboard → Settings → Edge Functions):
 *   VAPID_PUBLIC_KEY   – chave pública VAPID
 *   VAPID_PRIVATE_KEY  – chave privada VAPID
 *   VAPID_SUBJECT      – ex: mailto:seu@email.com
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import webPush from 'npm:web-push';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface TrackerNotification {
  id: string;
  tracker_id: string;
  type: 'fixed_time' | 'interval' | 'reminder';
  frequency_minutes: number | null;
  window_start: string | null;   // 'HH:MM:SS'
  window_end: string | null;
  scheduled_times: string[] | null; // ['HH:MM', ...]
  target_time: string | null;
  lead_time: number | null;
  enabled: boolean;
  trackers: {
    user_id: string;
    label: string;
    active: boolean;
  };
}

interface PushSubscription {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface LearningPlanNotification {
  id: string;
  plan_id: string;
  type: 'fixed_time' | 'interval' | 'reminder';
  frequency_minutes: number | null;
  window_start: string | null;
  window_end: string | null;
  scheduled_times: string[] | null;
  target_time: string | null;
  lead_time: number | null;
  enabled: boolean;
  learning_plans: {
    id: string;
    user_id: string;
    title: string;
    status: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers de tempo (horários configurados = relógio local do utilizador)
// ---------------------------------------------------------------------------
function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/** Hora e minuto num fuso IANA (ex.: America/Sao_Paulo), para o instante `now` em UTC. */
function getZonedClock(
  now: Date,
  timeZone: string,
): { hour: number; minute: number; hm: string; totalMinutes: number } {
  const tz = timeZone?.trim() || 'UTC';
  try {
    const dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = dtf.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    const hm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { hour, minute, hm, totalMinutes: hour * 60 + minute };
  } catch {
    return getZonedClock(now, 'UTC');
  }
}

function shouldFire(
  notif: TrackerNotification,
  clock: { hour: number; minute: number; hm: string; totalMinutes: number },
): boolean {
  const currentMin = clock.totalMinutes;
  const currentTime = clock.hm;

  if (notif.type === 'fixed_time' && Array.isArray(notif.scheduled_times)) {
    return notif.scheduled_times.some((t) => t.slice(0, 5) === currentTime);
  }

  if (notif.type === 'interval' && notif.frequency_minutes) {
    const windowStart = toMinutes(notif.window_start?.slice(0, 5) ?? '00:00');
    const windowEnd = toMinutes(notif.window_end?.slice(0, 5) ?? '23:59');
    if (currentMin < windowStart || currentMin > windowEnd) return false;
    return (currentMin - windowStart) % notif.frequency_minutes === 0;
  }

  if (notif.type === 'reminder' && notif.target_time && notif.lead_time != null) {
    const targetMin = toMinutes(notif.target_time.slice(0, 5));
    const reminderMin = targetMin - notif.lead_time;
    return currentMin === reminderMin;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Learning — lembretes de planos de aprendizado ativos
// ---------------------------------------------------------------------------
async function sendLearningPlanReminders(
  supabase: ReturnType<typeof createClient>,
  now: Date,
): Promise<{ sent: number; expired: number; checked: number }> {
  const { data: notifications, error } = await supabase
    .from('learning_plan_notifications')
    .select(`
      id, plan_id, type,
      frequency_minutes, window_start, window_end,
      scheduled_times, target_time, lead_time, enabled,
      learning_plans!inner ( id, user_id, title, status )
    `)
    .eq('enabled', true)
    .eq('learning_plans.status', 'in_progress');

  if (error) {
    console.error('Erro ao buscar notificações de learning:', error);
    return { sent: 0, expired: 0, checked: 0 };
  }

  const notifList = (notifications ?? []) as LearningPlanNotification[];
  if (notifList.length === 0) return { sent: 0, expired: 0, checked: 0 };

  const ownerIds = [...new Set(notifList.map((n) => n.learning_plans.user_id))];

  const defaultTz = 'America/Sao_Paulo';
  const tzByUser = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, timezone')
      .in('id', ownerIds);
    for (const row of profileRows ?? []) {
      const id = row.id as string;
      const tz = (row.timezone as string | null)?.trim();
      tzByUser.set(id, tz || defaultTz);
    }
  }

  // Reuse shouldFire — the notification shape is compatible
  const firing = notifList.filter((n) => {
    const uid = n.learning_plans.user_id;
    const tz = tzByUser.get(uid) ?? defaultTz;
    return shouldFire(n as unknown as TrackerNotification, getZonedClock(now, tz));
  });

  if (firing.length === 0) return { sent: 0, expired: 0, checked: notifList.length };

  // Fetch next pending day for each plan
  const planIds = [...new Set(firing.map((n) => n.plan_id))];
  const { data: dayRows } = await supabase
    .from('learning_plan_days')
    .select('id, plan_id, day_number, title')
    .in('plan_id', planIds)
    .eq('is_completed', false)
    .order('day_number', { ascending: true });

  const nextDayByPlan = new Map<string, { id: string; day_number: number; title: string | null }>();
  for (const d of dayRows ?? []) {
    const pid = d.plan_id as string;
    if (!nextDayByPlan.has(pid)) {
      nextDayByPlan.set(pid, { id: d.id as string, day_number: d.day_number as number, title: d.title as string | null });
    }
  }

  const userIds = [...new Set(firing.map((n) => n.learning_plans.user_id))];
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  const subscriptions = (subs ?? []) as PushSubscription[];
  let sent = 0;
  let expired = 0;

  for (const notif of firing) {
    const plan = notif.learning_plans;
    const userId = plan.user_id;
    const nextDay = nextDayByPlan.get(notif.plan_id);
    const dayLabel = nextDay
      ? `Dia ${nextDay.day_number}${nextDay.title ? ` — ${nextDay.title}` : ''}`
      : 'Continue estudando';
    const url = nextDay
      ? `/learning/${plan.id}/day/${nextDay.id}`
      : `/learning/${plan.id}`;

    const userSubs = subscriptions.filter((s) => s.user_id === userId);
    for (const sub of userSubs) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: `📚 ${plan.title}`,
            body: dayLabel,
            url,
            tag: `lp-${userId.slice(0, 8)}-${notif.plan_id.slice(0, 8)}`,
            icon: '/icons/icon-192.png',
          }),
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          expired++;
        } else {
          console.error('Erro push learning:', err);
        }
      }
    }
  }

  return { sent, expired, checked: notifList.length };
}

// ---------------------------------------------------------------------------
// Finance — vencimento de despesas (mesmo pipeline Web Push)
// ---------------------------------------------------------------------------
interface FinanceUserSettingsRow {
  user_id: string;
  expense_due_reminder_days_before: number[] | null;
  expense_due_reminder_time: string;
}

function getZonedDateString(now: Date, timeZone: string): string {
  const tz = timeZone?.trim() || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }
}

function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const next = new Date(t + deltaDays * 86400000);
  const yy = next.getUTCFullYear();
  const mm = next.getUTCMonth() + 1;
  const dd = next.getUTCDate();
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function dueDateFromMonthFirstDay(monthFirst: string, dueDay: number): string {
  const y = Number(monthFirst.slice(0, 4));
  const m = Number(monthFirst.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(dueDay, last);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatBrDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function reminderBody(name: string, dueYmd: string, daysBefore: number): string {
  const br = formatBrDate(dueYmd);
  if (daysBefore === 0) return `${name}: vence hoje (${br}).`;
  if (daysBefore === 1) return `${name}: vence amanhã (${br}).`;
  return `${name}: vence em ${daysBefore} dias (${br}).`;
}

/** Normaliza offsets: únicos, 0–60, ordenados. */
function normalizeReminderOffsets(raw: number[] | null | undefined): number[] {
  if (!raw?.length) return [];
  const s = new Set<number>();
  for (const n of raw) {
    const x = Math.round(Number(n));
    if (Number.isFinite(x) && x >= 0 && x <= 60) s.add(x);
  }
  return [...s].sort((a, b) => a - b);
}

async function sendFinanceExpenseReminders(
  supabase: ReturnType<typeof createClient>,
  now: Date,
): Promise<{ sent: number; expired: number; candidates: number }> {
  const { data: subsRows } = await supabase
    .from('push_subscriptions')
    .select('user_id');

  const subUserIds = [...new Set((subsRows ?? []).map((r: { user_id: string }) => r.user_id))];
  if (subUserIds.length === 0) return { sent: 0, expired: 0, candidates: 0 };

  const { data: settingsRows, error: setErr } = await supabase
    .from('finance_user_settings')
    .select('user_id, expense_due_reminder_days_before, expense_due_reminder_time')
    .in('user_id', subUserIds);

  if (setErr) {
    console.error('Finance settings:', setErr);
    return { sent: 0, expired: 0, candidates: 0 };
  }

  const defaultTz = 'America/Sao_Paulo';
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, timezone')
    .in('id', subUserIds);

  const tzByUser = new Map<string, string>();
  for (const row of profileRows ?? []) {
    const id = row.id as string;
    const tz = (row.timezone as string | null)?.trim();
    tzByUser.set(id, tz || defaultTz);
  }

  const eligibleUsers: { userId: string; offsets: number[]; reminderHm: string }[] = [];

  for (const row of (settingsRows ?? []) as FinanceUserSettingsRow[]) {
    const offsets = normalizeReminderOffsets(row.expense_due_reminder_days_before ?? undefined);
    if (offsets.length === 0) continue;
    const hm = (row.expense_due_reminder_time ?? '09:00').slice(0, 5);
    const uid = row.user_id;
    const tz = tzByUser.get(uid) ?? defaultTz;
    const clock = getZonedClock(now, tz);
    if (clock.hm !== hm) continue;
    eligibleUsers.push({ userId: uid, offsets, reminderHm: hm });
  }

  if (eligibleUsers.length === 0) return { sent: 0, expired: 0, candidates: 0 };

  const eligibleIds = eligibleUsers.map((u) => u.userId);
  const settingsByUser = new Map(eligibleUsers.map((u) => [u.userId, u]));

  const { data: dueItems } = await supabase
    .from('finance_expense_items')
    .select('id, user_id, name, due_day, is_active')
    .in('user_id', eligibleIds)
    .eq('is_active', true)
    .not('due_day', 'is', null);

  const itemById = new Map(
    (dueItems ?? []).map((it: { id: string; user_id: string; name: string; due_day: number }) => [
      it.id,
      it,
    ]),
  );
  const dueItemIds = [...itemById.keys()];
  const fixedCandidates: {
    userId: string;
    name: string;
    dueYmd: string;
    offsets: number[];
    dedupeBase: string;
    url: string;
  }[] = [];

  if (dueItemIds.length > 0) {
    const { data: entryRows } = await supabase
      .from('finance_expense_entries')
      .select('month, amount, is_paid, item_id')
      .in('item_id', dueItemIds)
      .eq('is_paid', false)
      .gt('amount', 0);

    for (const er of entryRows ?? []) {
      const it = itemById.get(er.item_id as string);
      if (!it) continue;
      const cfg = settingsByUser.get(it.user_id);
      if (!cfg) continue;
      const monthStr =
        typeof er.month === 'string' ? er.month.slice(0, 10) : String(er.month).slice(0, 10);
      const dueYmd = dueDateFromMonthFirstDay(monthStr, it.due_day);
      fixedCandidates.push({
        userId: it.user_id,
        name: it.name,
        dueYmd,
        offsets: cfg.offsets,
        dedupeBase: `fi:${er.item_id as string}:${monthStr}`,
        url: '/finance/expenses',
      });
    }
  }

  const { data: oneTimeRows } = await supabase
    .from('finance_one_time_entries')
    .select('id, user_id, name, due_date, amount, is_paid, flow')
    .in('user_id', eligibleIds)
    .eq('is_paid', false)
    .eq('flow', 'expense')
    .gt('amount', 0)
    .not('due_date', 'is', null);

  const otCandidates: {
    userId: string;
    name: string;
    dueYmd: string;
    offsets: number[];
    dedupeBase: string;
    url: string;
  }[] = [];

  for (const ot of oneTimeRows ?? []) {
    const uid = ot.user_id as string;
    const cfg = settingsByUser.get(uid);
    if (!cfg) continue;
    const due = (ot.due_date as string).slice(0, 10);
    otCandidates.push({
      userId: uid,
      name: ot.name as string,
      dueYmd: due,
      offsets: cfg.offsets,
      dedupeBase: `ot:${ot.id as string}`,
      url: '/finance/one-time',
    });
  }

  const all = [...fixedCandidates, ...otCandidates];
  let sent = 0;
  let expired = 0;

  const { data: allSubs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', eligibleIds);

  const subscriptions = (allSubs ?? []) as PushSubscription[];

  for (const c of all) {
    const tz = tzByUser.get(c.userId) ?? defaultTz;
    const todayLocal = getZonedDateString(now, tz);

    for (const daysBefore of c.offsets) {
      const reminderDay = addCalendarDaysYmd(c.dueYmd, -daysBefore);
      if (reminderDay !== todayLocal) continue;

      const dedupeKey = `${c.dedupeBase}:b${daysBefore}`;

      const { error: insErr } = await supabase.from('finance_expense_reminder_sent').insert({
        user_id: c.userId,
        dedupe_key: dedupeKey,
        local_date: todayLocal,
      });

      if (insErr) {
        if ((insErr as { code?: string }).code === '23505') continue;
        console.error('finance_expense_reminder_sent insert:', insErr);
        continue;
      }

      const body = reminderBody(c.name, c.dueYmd, daysBefore);
      const userSubs = subscriptions.filter((s) => s.user_id === c.userId);

      for (const sub of userSubs) {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: 'Nexus Finance — Vencimento',
              body,
              url: c.url,
              tag: `nf-${c.userId.slice(0, 8)}-${dedupeKey.slice(0, 48)}`,
              icon: '/icons/icon-192.png',
            }),
          );
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            expired++;
          } else {
            console.error('Erro push finance:', err);
          }
        }
      }
    }
  }

  return { sent, expired, candidates: all.length };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async () => {
  const supabaseUrl            = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidPublic            = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const vapidPrivate           = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const vapidSubject           = Deno.env.get('VAPID_SUBJECT')!;

  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return new Response(
      JSON.stringify({ error: 'VAPID secrets não configurados.' }),
      { status: 500 },
    );
  }

  webPush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const now      = new Date();

  // Busca todas as notificações habilitadas de trackers ativos
  const { data: notifications, error: notifError } = await supabase
    .from('tracker_notifications')
    .select(`
      id, tracker_id, type,
      frequency_minutes, window_start, window_end,
      scheduled_times, target_time, lead_time, enabled,
      trackers!inner ( user_id, label, active )
    `)
    .eq('enabled', true)
    .eq('trackers.active', true);

  if (notifError) {
    console.error('Erro ao buscar notificações:', notifError);
    return new Response(JSON.stringify({ error: notifError.message }), { status: 500 });
  }

  const notifList = (notifications ?? []) as TrackerNotification[];
  const ownerIds = [...new Set(notifList.map((n) => n.trackers.user_id))];

  /** Alinhado ao default da migration `006_user_timezone.sql`. */
  const defaultTz = 'America/Sao_Paulo';
  const tzByUser = new Map<string, string>();

  if (ownerIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, timezone')
      .in('id', ownerIds);

    if (profileError) {
      console.error('Erro ao buscar perfis (timezone):', profileError);
      return new Response(JSON.stringify({ error: profileError.message }), { status: 500 });
    }
    for (const row of profileRows ?? []) {
      const id = row.id as string;
      const tz = (row.timezone as string | null)?.trim();
      tzByUser.set(id, tz || defaultTz);
    }
  }

  // Filtra as que devem disparar agora (relógio no fuso de cada utilizador)
  const firing = notifList.filter((n) => {
    const uid = n.trackers.user_id;
    const tz = tzByUser.get(uid) ?? defaultTz;
    return shouldFire(n, getZonedClock(now, tz));
  });

  let sent    = 0;
  let expired = 0;

  if (firing.length > 0) {
    const userIds = [...new Set(firing.map((n) => n.trackers.user_id))];

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', userIds);

    const subscriptions = (subs ?? []) as PushSubscription[];

    for (const notif of firing) {
      const userId  = notif.trackers.user_id;
      const userSubs = subscriptions.filter((s) => s.user_id === userId);

      for (const sub of userSubs) {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: 'Nexus Daily Goals',
              body:  `Lembrete: ${notif.trackers.label}`,
              url:   '/daily-goals',
              tag:   `dg-${userId.slice(0, 8)}-${notif.tracker_id.slice(0, 8)}`,
              icon:  '/icons/icon-192.png',
            }),
          );
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            expired++;
          } else {
            console.error('Erro ao enviar push:', err);
          }
        }
      }
    }
  }

  const learning = await sendLearningPlanReminders(supabase, now);
  sent += learning.sent;
  expired += learning.expired;

  const finance = await sendFinanceExpenseReminders(supabase, now);
  sent += finance.sent;
  expired += finance.expired;

  const nutrition = await sendNutritionReminders(supabase, now);
  sent += nutrition.sent;
  expired += nutrition.expired;

  console.log(
    `[send-push] ${now.toISOString()} — sent: ${sent}, expired removed: ${expired}, dg: ${firing.length}, learning: ${learning.checked}, finance: ${finance.candidates}, nutrition: ${nutrition.checked}`,
  );

  return new Response(
    JSON.stringify({
      sent,
      expired,
      checked: firing.length,
      learning_checked: learning.checked,
      finance_candidates: finance.candidates,
      nutrition_checked: nutrition.checked,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});

// ---------------------------------------------------------------------------
// Nutrition — lembretes de hidratação e checklist de refeições
// ---------------------------------------------------------------------------
async function sendNutritionReminders(
  supabase: ReturnType<typeof createClient>,
  now: Date,
): Promise<{ sent: number; expired: number; checked: number }> {
  // Busca todos os users com diet_settings (opt-in ao módulo de nutrição)
  const { data: settingsRows, error: settingsErr } = await supabase
    .from('diet_settings')
    .select('user_id, daily_water_target_ml');

  if (settingsErr || !settingsRows?.length) {
    if (settingsErr) console.error('Erro diet_settings:', settingsErr);
    return { sent: 0, expired: 0, checked: 0 };
  }

  const userIds = settingsRows.map((r: { user_id: string }) => r.user_id);
  const settingsMap = new Map(
    settingsRows.map((r: { user_id: string; daily_water_target_ml: number }) => [r.user_id, r]),
  );

  // Busca timezones
  const defaultTz = 'America/Sao_Paulo';
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, timezone')
    .in('id', userIds);

  const tzByUser = new Map<string, string>();
  for (const row of profileRows ?? []) {
    const id = row.id as string;
    const tz = (row.timezone as string | null)?.trim();
    tzByUser.set(id, tz || defaultTz);
  }

  // Busca push subscriptions
  const { data: subsRows } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  const subscriptions = (subsRows ?? []) as PushSubscription[];
  if (subscriptions.length === 0) return { sent: 0, expired: 0, checked: settingsRows.length };

  let sent = 0;
  let expired = 0;

  const todayStr = (tz: string) => getZonedDateString(now, tz);

  for (const uid of userIds) {
    const tz = tzByUser.get(uid) ?? defaultTz;
    const clock = getZonedClock(now, tz);
    const today = todayStr(tz);
    const userSubs = subscriptions.filter((s) => s.user_id === uid);
    if (userSubs.length === 0) continue;

    const settings = settingsMap.get(uid);
    if (!settings) continue;

    // --- Hidratação: se às 16h local, consumo < 50% da meta ---
    if (clock.hm === '16:00') {
      const waterTarget = (settings as { daily_water_target_ml: number }).daily_water_target_ml;
      if (waterTarget > 0) {
        const { data: waterRows } = await supabase
          .from('water_logs')
          .select('amount_ml')
          .eq('user_id', uid)
          .eq('logged_date', today);

        const totalWater = (waterRows ?? []).reduce(
          (sum: number, r: { amount_ml: number }) => sum + r.amount_ml,
          0,
        );

        if (totalWater < waterTarget * 0.5) {
          const pct = Math.round((totalWater / waterTarget) * 100);
          for (const sub of userSubs) {
            try {
              await webPush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                JSON.stringify({
                  title: '💧 Hidratação baixa',
                  body: `Você consumiu apenas ${pct}% da meta de água. Beba mais!`,
                  url: '/health/nutrition',
                  tag: `water-${uid.slice(0, 8)}-${today}`,
                  icon: '/icons/icon-192.png',
                }),
              );
              sent++;
            } catch (err: unknown) {
              const status = (err as { statusCode?: number }).statusCode;
              if (status === 404 || status === 410) {
                await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                expired++;
              } else {
                console.error('Erro push nutrition water:', err);
              }
            }
          }
        }
      }
    }

    // --- Refeições: se às 21h local, checklist vazio ---
    if (clock.hm === '21:00') {
      const { data: logRows } = await supabase
        .from('diet_logs')
        .select('id')
        .eq('user_id', uid)
        .eq('logged_date', today)
        .limit(1);

      if (!logRows || logRows.length === 0) {
        for (const sub of userSubs) {
          try {
            await webPush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({
                title: '🍽️ Marque suas refeições',
                body: 'Você ainda não registrou nenhuma refeição hoje. Marque o que comeu!',
                url: '/health/nutrition',
                tag: `meal-${uid.slice(0, 8)}-${today}`,
                icon: '/icons/icon-192.png',
              }),
            );
            sent++;
          } catch (err: unknown) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              expired++;
            } else {
              console.error('Erro push nutrition meals:', err);
            }
          }
        }
      }
    }
  }

  return { sent, expired, checked: settingsRows.length };
}

