/**
 * Edge Function: send-push-notifications
 *
 * Disparada via cron a cada 5 minutos (no Dashboard Supabase ou pg_cron: passo
 * de 5 no campo minuto do padrão cron). Tipos fixed_time / reminder e horários
 * fixos (nutrição)
 * usam janela de catch-up de 5 min para não perder o minuto exacto entre ticks.
 * O dedupe usa o minuto local programado para evitar reenvios nas janelas
 * sobrepostas do catch-up.
 * I/O: uma leitura de `push_subscriptions` no início; Daily Goals e nutrição só
 * consideram usuários com push.
 * 1) Daily Goals: regras em `tracker_notifications` (horário local do usuário).
 * 2) Nutrição — lembretes por `diet_plan_meals.target_time` (relógio local via `profiles.timezone`),
 *    antecedência em `diet_settings.meal_reminder_lead_minutes`, opt-in `meal_reminder_push_enabled`;
 *    além dos fixos 16h (água) e 21h (checklist vazio).
 *    Dedupe em `diet_push_reminder_sent` (o catch-up de 5 min re-dispararia
 *    o mesmo lembrete em cada tick enquanto o minuto cair na janela).
 *
 * Secrets necessários (Supabase Dashboard → Settings → Edge Functions):
 *   VAPID_PUBLIC_KEY   – chave pública VAPID
 *   VAPID_PRIVATE_KEY  – chave privada VAPID
 *   VAPID_SUBJECT      – ex: mailto:seu@email.com
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webPush from 'web-push';
import { isPeriodCompleteFromLogs } from '@/lib/habits-goals/period';
import type { Log, Tracker } from '@/types/habits-goals';

type SupabaseServiceClient = SupabaseClient;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface HabitsGoalsTrackerRow {
  user_id: string;
  label: string;
  active: boolean;
  recurrence_days: number[] | null;
  period_kind: string;
  period_aggregation: string;
  goal_value: number | null;
  type: string;
  checklist_items: unknown;
  source_key: string | null;
  source_config: unknown;
}

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
  trackers: HabitsGoalsTrackerRow;
}

interface PushSubscription {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ---------------------------------------------------------------------------
// Helpers de tempo (horários configurados = relógio local do usuário)
// ---------------------------------------------------------------------------
function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/** Minuto do dia local em que deve disparar o lembrete (N minutos antes do target_time). */
function mealReminderMinuteOfDay(targetTimeStr: string, leadMinutes: number): number {
  const targetMin = toMinutes(targetTimeStr.slice(0, 5));
  let reminderMin = targetMin - leadMinutes;
  if (reminderMin < 0) reminderMin += 24 * 60;
  return reminderMin;
}

function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

/** Igual ao intervalo do cron que invoca esta função (catch-up para horários fixos). */
const PUSH_CRON_INTERVAL_MINUTES = 5;

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

function getZonedClockAtLag(
  now: Date,
  timeZone: string,
  lagMinutes: number,
): ReturnType<typeof getZonedClock> {
  const t = new Date(now.getTime() - lagMinutes * 60_000);
  return getZonedClock(t, timeZone);
}

/** `HH:MM` local coincidiu com o alvo em algum dos últimos N minutos (inclui o instante actual). */
function zonedHmMatchedInCatchupWindow(now: Date, timeZone: string, targetHm: string): boolean {
  const hm = targetHm.slice(0, 5);
  for (let lag = 0; lag <= PUSH_CRON_INTERVAL_MINUTES; lag++) {
    if (getZonedClockAtLag(now, timeZone, lag).hm === hm) return true;
  }
  return false;
}

function zonedTotalMinutesMatchedInCatchupWindow(
  now: Date,
  timeZone: string,
  targetTotalMinutes: number,
): boolean {
  for (let lag = 0; lag <= PUSH_CRON_INTERVAL_MINUTES; lag++) {
    if (getZonedClockAtLag(now, timeZone, lag).totalMinutes === targetTotalMinutes) return true;
  }
  return false;
}

function groupSubscriptionsByUser(subs: PushSubscription[]): Map<string, PushSubscription[]> {
  const m = new Map<string, PushSubscription[]>();
  for (const s of subs) {
    const arr = m.get(s.user_id) ?? [];
    arr.push(s);
    m.set(s.user_id, arr);
  }
  return m;
}

/** Um endpoint = um envio; várias linhas em push_subscriptions duplicavam o mesmo push. */
function dedupeSubscriptionsByEndpoint(subs: PushSubscription[]): PushSubscription[] {
  const byEndpoint = new Map<string, PushSubscription>();
  for (const s of subs) {
    if (!byEndpoint.has(s.endpoint)) byEndpoint.set(s.endpoint, s);
  }
  return [...byEndpoint.values()];
}

/** Reserva envio único por usuário / chave / dia civil local; retorna false se já enviado. */
async function claimDietPushDedupe(
  supabase: SupabaseServiceClient,
  userId: string,
  dedupeKey: string,
  localDateYmd: string,
): Promise<boolean> {
  const { error } = await supabase.from('diet_push_reminder_sent').insert({
    user_id: userId,
    dedupe_key: dedupeKey,
    local_date: localDateYmd,
  });
  if (error) {
    if ((error as { code?: string }).code === '23505') return false;
    console.error('diet_push_reminder_sent insert:', error);
    return false;
  }
  return true;
}

async function claimPushDedupe(
  supabase: SupabaseServiceClient,
  userId: string,
  module: string,
  dedupeKey: string,
  localDateYmd: string,
): Promise<boolean> {
  const { error } = await supabase.from('push_reminder_sent').insert({
    user_id: userId,
    module,
    dedupe_key: dedupeKey,
    local_date: localDateYmd,
  });
  if (error) {
    if ((error as { code?: string }).code === '23505') return false;
    console.error('push_reminder_sent insert:', error);
    return false;
  }
  return true;
}

/** Data civil YYYY-MM-DD no fuso IANA do usuário. */
function getZonedDateYmd(now: Date, timeZone: string): string {
  const tz = timeZone?.trim() || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }
}

const DOW_SHORT_TO_NUM: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getWeekdayInTz(now: Date, timeZone: string): number {
  const tz = timeZone?.trim() || 'UTC';
  try {
    const label = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
    return DOW_SHORT_TO_NUM[label] ?? 0;
  } catch {
    return now.getUTCDay();
  }
}

function logYmd(createdAt: string): string {
  return String(createdAt).slice(0, 10);
}

function habitsGoalMetInPeriod(
  tracker: HabitsGoalsTrackerRow,
  periodStart: string,
  todayYmd: string,
  logs: {
    created_at: string;
    value: number | null;
    checked_items: boolean[] | null;
    note: string | null;
  }[],
): boolean {
  const asLogs: Log[] = logs.map((l) => ({
    id: '',
    tracker_id: '',
    value: l.value,
    checked_items: l.checked_items,
    note: l.note,
    points_earned: 0,
    created_at: l.created_at,
  }));
  return isPeriodCompleteFromLogs(tracker as unknown as Tracker, {
    startStr: periodStart,
    endStr: todayYmd,
  }, asLogs);
}

async function filterHabitsGoalsAlreadyComplete(
  supabase: SupabaseServiceClient,
  notifs: TrackerNotification[],
  tzByUser: Map<string, string>,
  now: Date,
): Promise<TrackerNotification[]> {
  if (notifs.length === 0) return [];

  const trackerById = new Map(notifs.map((n) => [n.tracker_id, n]));
  const todayByTracker = new Map<string, string>();
  for (const n of notifs) {
    const tz = tzByUser.get(n.trackers.user_id) ?? 'America/Sao_Paulo';
    todayByTracker.set(n.tracker_id, getZonedDateYmd(now, tz));
  }

  const periodItems = [...trackerById.keys()].map((trackerId) => ({
    tracker_id: trackerId,
    local_date: todayByTracker.get(trackerId),
  }));
  const { data: periodRows, error: rpcErr } = await supabase.rpc('tracker_period_starts', {
    p_items: periodItems,
  });

  if (rpcErr) {
    console.error('tracker_period_starts', rpcErr);
    return notifs;
  }

  const periodByTracker = new Map<string, string>();
  for (const row of periodRows ?? []) {
    periodByTracker.set(String(row.tracker_id), String(row.period_start));
  }
  if (periodByTracker.size === 0) return notifs;

  const periodStarts = [...periodByTracker.values()];
  const todayValues = [...todayByTracker.values()];
  const { data: logRows, error: logErr } = await supabase
    .from('logs')
    .select('tracker_id, created_at, value, checked_items, note')
    .in('tracker_id', [...periodByTracker.keys()])
    .gte('created_at', periodStarts.sort()[0])
    .lte('created_at', todayValues.sort().at(-1)!);

  if (logErr) {
    console.error('logs fetch (habits push)', logErr);
    return notifs;
  }

  const logsByTracker = new Map<
    string,
    { created_at: string; value: number | null; checked_items: boolean[] | null; note: string | null }[]
  >();
  for (const row of logRows ?? []) {
    const trackerId = String(row.tracker_id);
    const rows = logsByTracker.get(trackerId) ?? [];
    rows.push({
      created_at: String(row.created_at),
      value: row.value as number | null,
      checked_items: row.checked_items as boolean[] | null,
      note: (row.note as string | null) ?? null,
    });
    logsByTracker.set(trackerId, rows);
  }

  return notifs.filter((n) => {
    const periodStart = periodByTracker.get(n.tracker_id);
    const todayYmd = todayByTracker.get(n.tracker_id);
    if (!periodStart || !todayYmd) return true;
    return !habitsGoalMetInPeriod(
      n.trackers,
      periodStart,
      todayYmd,
      logsByTracker.get(n.tracker_id) ?? [],
    );
  });
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
    const reminderMin = ((targetMin - notif.lead_time) % 1440 + 1440) % 1440;
    return currentMin === reminderMin;
  }

  return false;
}

/**
 * Com cron espaçado (ex. 5 min), `fixed_time` / `reminder` podem calhar entre ticks;
 * percorre os últimos PUSH_CRON_INTERVAL_MINUTES+1 minutos locais.
 * O dedupe por minuto programado evita reenvio entre janelas sobrepostas.
 */
function shouldFireWithCronCatchup(
  notif: TrackerNotification,
  now: Date,
  timeZone: string,
): boolean {
  for (let lag = 0; lag <= PUSH_CRON_INTERVAL_MINUTES; lag++) {
    if (shouldFire(notif, getZonedClockAtLag(now, timeZone, lag))) return true;
  }
  return false;
}

function dedupeMinuteForCronCatchup(
  notif: TrackerNotification,
  now: Date,
  timeZone: string,
): number | null {
  for (let lag = 0; lag <= PUSH_CRON_INTERVAL_MINUTES; lag++) {
    const clock = getZonedClockAtLag(now, timeZone, lag);
    if (shouldFire(notif, clock)) return clock.totalMinutes;
  }
  return null;
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
  supabase: SupabaseServiceClient,
  now: Date,
  subUserIds: string[],
  subscriptionsByUser: Map<string, PushSubscription[]>,
): Promise<{ sent: number; expired: number; candidates: number }> {
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
    if (!zonedHmMatchedInCatchupWindow(now, tz, hm)) continue;
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

  const subscriptions = eligibleIds.flatMap(
    (uid) => subscriptionsByUser.get(uid) ?? [],
  ) as PushSubscription[];

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
export type SendPushResult = {
  sent: number;
  expired: number;
  checked: number;
  nutrition_checked: number;
};

export async function runSendPushNotifications(): Promise<SendPushResult> {
  const supabaseUrl =
    process.env.SUPABASE_INTERNAL_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
  }

  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    throw new Error('VAPID secrets não configurados.');
  }

  webPush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const supabase: SupabaseServiceClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const now      = new Date();

  const { data: allSubRows, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth');

  if (subErr) {
    console.error('Erro push_subscriptions:', subErr);
    throw new Error(subErr.message);
  }

  const allSubscriptions = dedupeSubscriptionsByEndpoint(
    (allSubRows ?? []) as PushSubscription[],
  );
  const subscriptionsByUser = groupSubscriptionsByUser(allSubscriptions);

  if (allSubscriptions.length === 0) {
    return {
      sent: 0,
      expired: 0,
      checked: 0,
      nutrition_checked: 0,
    };
  }

  const pushUserIds = [...subscriptionsByUser.keys()];
  const defaultTz = 'America/Sao_Paulo';
  const tzByUser = new Map<string, string>();

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, timezone')
    .in('id', pushUserIds);

  if (profileError) {
    console.error('Erro ao buscar perfis (timezone):', profileError);
    throw new Error(profileError.message);
  }
  for (const row of profileRows ?? []) {
    const id = row.id as string;
    const tz = (row.timezone as string | null)?.trim();
    tzByUser.set(id, tz || defaultTz);
  }

  // Busca todas as notificações habilitadas de trackers ativos
  const { data: notifications, error: notifError } = await supabase
    .from('tracker_notifications')
    .select(`
      id, tracker_id, type,
      frequency_minutes, window_start, window_end,
      scheduled_times, target_time, lead_time, enabled,
      trackers!inner (
        user_id, label, active,
        recurrence_days, period_kind, period_aggregation,
        goal_value, type, checklist_items,
        source_key, source_config
      )
    `)
    .eq('enabled', true)
    .eq('trackers.active', true)
    .in('trackers.user_id', pushUserIds);

  if (notifError) {
    console.error('Erro ao buscar notificações:', notifError);
    throw new Error(notifError.message);
  }

  const notifList = (notifications ?? []) as unknown as TrackerNotification[];

  // Filtra: horário + dia da semana (recurrence_days) + meta ainda não cumprida no período corrente
  const firingRaw = notifList.filter((n) => {
    const uid = n.trackers.user_id;
    const tz = tzByUser.get(uid) ?? defaultTz;
    const days = n.trackers.recurrence_days;
    if (days != null && days.length > 0) {
      if (!days.includes(getWeekdayInTz(now, tz))) return false;
    }
    return shouldFireWithCronCatchup(n, now, tz);
  });

  const firing = await filterHabitsGoalsAlreadyComplete(supabase, firingRaw, tzByUser, now);

  let sent    = 0;
  let expired = 0;

  if (firing.length > 0) {
    for (const notif of firing) {
      const userId  = notif.trackers.user_id;
      const tz = tzByUser.get(userId) ?? defaultTz;
      const dedupeMinute = dedupeMinuteForCronCatchup(notif, now, tz);
      if (dedupeMinute == null) continue;

      const localDate = getZonedDateYmd(now, tz);
      const canSend = await claimPushDedupe(
        supabase,
        userId,
        'daily-goals',
        `${notif.id}:${dedupeMinute}`,
        localDate,
      );
      if (!canSend) continue;

      const userSubs = subscriptionsByUser.get(userId) ?? [];

      for (const sub of userSubs) {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: 'Hábitos e Metas',
              body:  `Lembrete: ${notif.trackers.label}`,
              url:   '/habits-goals',
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

  const nutrition = await sendNutritionReminders(
    supabase,
    now,
    pushUserIds,
    subscriptionsByUser,
    tzByUser,
  );
  sent += nutrition.sent;
  expired += nutrition.expired;

  if (sent > 0 || expired > 0) {
    console.log(
      `[send-push] ${now.toISOString()} — sent: ${sent}, expired removed: ${expired}, dg: ${firing.length}, nutrition: ${nutrition.checked}`,
    );
  }

  return {
    sent,
    expired,
    checked: firing.length,
    nutrition_checked: nutrition.checked,
  };
}

// ---------------------------------------------------------------------------
// Nutrition — lembretes de hidratação e checklist de refeições
// ---------------------------------------------------------------------------
async function sendNutritionReminders(
  supabase: SupabaseServiceClient,
  now: Date,
  pushUserIds: string[],
  subscriptionsByUser: Map<string, PushSubscription[]>,
  tzByUser: Map<string, string>,
): Promise<{ sent: number; expired: number; checked: number }> {
  if (pushUserIds.length === 0) return { sent: 0, expired: 0, checked: 0 };

  // Só usuários com subscrição push (evita full scan de diet_settings)
  const { data: settingsRows, error: settingsErr } = await supabase
    .from('diet_settings')
    .select(
      'user_id, daily_water_target_ml, meal_reminder_push_enabled, meal_reminder_lead_minutes',
    )
    .in('user_id', pushUserIds);

  if (settingsErr || !settingsRows?.length) {
    if (settingsErr) console.error('Erro diet_settings:', settingsErr);
    return { sent: 0, expired: 0, checked: 0 };
  }

  type DietSettingsRow = {
    user_id: string;
    daily_water_target_ml: number;
    meal_reminder_push_enabled?: boolean;
    meal_reminder_lead_minutes?: number;
  };

  const userIds = settingsRows.map((r: { user_id: string }) => r.user_id);
  const settingsMap = new Map(
    settingsRows.map((r: DietSettingsRow) => [r.user_id, r]),
  );

  const defaultTz = 'America/Sao_Paulo';

  /** user_id -> refeições do plano ativo com target_time e lembrete por refeição ativo */
  const mealsByUser = new Map<string, { id: string; name: string; target_time: string }[]>();
  const mealReminderEligible = settingsRows.filter((r: DietSettingsRow) => {
    return r.meal_reminder_push_enabled === true;
  }) as DietSettingsRow[];
  const mealTargetTimesByUser = new Map<string, Set<string>>();

  for (const row of mealReminderEligible) {
    const tz = tzByUser.get(row.user_id) ?? defaultTz;
    const lead = Math.round(Number(row.meal_reminder_lead_minutes ?? 15));
    const leadClamped = Math.min(120, Math.max(5, lead));
    const targetTimes = new Set<string>();
    for (let lag = 0; lag <= PUSH_CRON_INTERVAL_MINUTES; lag++) {
      const clock = getZonedClockAtLag(now, tz, lag);
      targetTimes.add(minutesToTime(clock.totalMinutes + leadClamped));
    }
    mealTargetTimesByUser.set(row.user_id, targetTimes);
  }

  if (mealReminderEligible.length > 0) {
    const eligibleIds = mealReminderEligible.map((r) => r.user_id);
    const possibleTargetTimes = [
      ...new Set([...mealTargetTimesByUser.values()].flatMap((times) => [...times])),
    ];
    const { data: activePlans, error: planErr } = await supabase
      .from('diet_plans')
      .select('id, user_id')
      .eq('is_active', true)
      .in('user_id', eligibleIds);

    if (planErr) {
      console.error('Erro diet_plans ativos (meal reminders):', planErr);
    } else {
      const planIdToUser = new Map(
        (activePlans ?? []).map((p: { id: string; user_id: string }) => [p.id, p.user_id]),
      );
      const planIds = [...planIdToUser.keys()];
      if (planIds.length > 0) {
        const { data: mealRows, error: mealErr } = await supabase
          .from('diet_plan_meals')
          .select('id, name, target_time, plan_id')
          .in('plan_id', planIds)
          .in('target_time', possibleTargetTimes)
          .eq('meal_reminder_enabled', true)
          .not('target_time', 'is', null);

        if (mealErr) {
          console.error('Erro diet_plan_meals (meal reminders):', mealErr);
        } else {
          for (const row of mealRows ?? []) {
            const uid = planIdToUser.get(row.plan_id as string);
            if (!uid) continue;
            const tt = row.target_time as string;
            if (!tt) continue;
            if (!mealTargetTimesByUser.get(uid)?.has(`${tt.slice(0, 5)}:00`)) continue;
            const list = mealsByUser.get(uid) ?? [];
            list.push({
              id: row.id as string,
              name: row.name as string,
              target_time: tt,
            });
            mealsByUser.set(uid, list);
          }
        }
      }
    }
  }

  /** `${userId}\t${localYmd}` -> Set de meal_name já registados (não extra) */
  const loggedMealsCache = new Map<string, Set<string>>();

  async function getLoggedMealNamesForDay(userId: string, localYmd: string): Promise<Set<string>> {
    const key = `${userId}\t${localYmd}`;
    const cached = loggedMealsCache.get(key);
    if (cached) return cached;
    const { data: logRows, error: logErr } = await supabase
      .from('diet_logs')
      .select('meal_name')
      .eq('user_id', userId)
      .eq('logged_date', localYmd)
      .eq('is_extra', false);
    if (logErr) {
      console.error('Erro diet_logs (meal reminder skip):', logErr);
      loggedMealsCache.set(key, new Set());
      return new Set();
    }
    const names = new Set((logRows ?? []).map((r: { meal_name: string }) => r.meal_name));
    loggedMealsCache.set(key, names);
    return names;
  }

  let sent = 0;
  let expired = 0;

  const todayStr = (tz: string) => getZonedDateString(now, tz);

  for (const uid of userIds) {
    const tz = tzByUser.get(uid) ?? defaultTz;
    const today = todayStr(tz);
    const userSubs = subscriptionsByUser.get(uid) ?? [];
    if (userSubs.length === 0) continue;

    const settings = settingsMap.get(uid);
    if (!settings) continue;

    // --- Hidratação: se às 16h local, consumo < 50% da meta ---
    if (zonedHmMatchedInCatchupWindow(now, tz, '16:00')) {
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
          const canSendWater = await claimDietPushDedupe(supabase, uid, 'water', today);
          if (canSendWater) {
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
    }

    // --- Lembretes por horário da refeição (target_time − lead, relógio local) ---
    const srow = settings as DietSettingsRow;
    if (srow.meal_reminder_push_enabled === true) {
      const lead = Math.round(Number(srow.meal_reminder_lead_minutes ?? 15));
      const leadClamped = Math.min(120, Math.max(5, lead));
      const mealsForUser = mealsByUser.get(uid);
      if (mealsForUser?.length) {
        for (const meal of mealsForUser) {
          const reminderMin = mealReminderMinuteOfDay(meal.target_time, leadClamped);
          if (!zonedTotalMinutesMatchedInCatchupWindow(now, tz, reminderMin)) continue;

          const loggedNames = await getLoggedMealNamesForDay(uid, today);
          if (loggedNames.has(meal.name)) continue;

          const canSendMeal = await claimDietPushDedupe(supabase, uid, `meal:${meal.id}`, today);
          if (!canSendMeal) continue;

          const hm = meal.target_time.slice(0, 5);
          const body =
            leadClamped <= 1
              ? `É hora de ${meal.name} (${hm}).`
              : `Em ${leadClamped} min é ${meal.name} (${hm}).`;

          for (const sub of userSubs) {
            try {
              await webPush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                JSON.stringify({
                  title: '🍽️ Refeição a seguir',
                  body,
                  url: '/health/nutrition',
                  tag: `meal-reminder-${meal.id}-${today}`,
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
                console.error('Erro push nutrition meal time:', err);
              }
            }
          }
        }
      }
    }

    // --- Refeições: se às 21h local, checklist vazio ---
    if (zonedHmMatchedInCatchupWindow(now, tz, '21:00')) {
      const { data: logRows } = await supabase
        .from('diet_logs')
        .select('id')
        .eq('user_id', uid)
        .eq('logged_date', today)
        .limit(1);

      if (!logRows || logRows.length === 0) {
        const canSendEvening = await claimDietPushDedupe(supabase, uid, 'checklist-empty', today);
        if (canSendEvening) {
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
  }

  return { sent, expired, checked: settingsRows.length };
}
