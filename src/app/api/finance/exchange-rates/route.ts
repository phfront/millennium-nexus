import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { isCurrencyCode } from '@/lib/finance/currency';

export const dynamic = 'force-dynamic';

/**
 * Cotações para o módulo Finanças.
 *
 * Fonte: open.er-api.com (grátis, sem chave, ~160 moedas ISO-4217, atualiza 1x/dia).
 * Base USD — guardamos "unidades por 1 USD" para qualquer par derivar da mesma
 * tabela sem refetch quando o usuário troca a moeda de exibição.
 *
 * A resposta serve o cliente (conversão na planilha) e, em paralelo, sincroniza
 * `finance_exchange_rates`, que é o que a view `finance_monthly_summary` usa
 * para os totais do dashboard/histórico.
 */

const PROVIDER_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_SECONDS = 3600;
const DB_SYNC_INTERVAL_MS = CACHE_TTL_SECONDS * 1000;

type RatesPayload = {
  base: 'USD';
  /** Unidades da moeda por 1 USD. */
  rates: Record<string, number>;
  fetchedAt: string;
};

let memoryCache: { payload: RatesPayload; expiresAt: number } | null = null;
let lastDbSyncAt = 0;

function sanitizeRates(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    const rate = Number(value);
    if (isCurrencyCode(code) && Number.isFinite(rate) && rate > 0) out[code] = rate;
  }
  return out;
}

async function fetchRates(): Promise<RatesPayload> {
  const res = await fetch(PROVIDER_URL, {
    next: { revalidate: CACHE_TTL_SECONDS },
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Provedor de câmbio respondeu ${res.status}`);

  const json = (await res.json()) as { result?: string; rates?: unknown; time_last_update_utc?: string };
  if (json.result && json.result !== 'success') {
    throw new Error('Provedor de câmbio devolveu erro.');
  }

  const rates = sanitizeRates(json.rates);
  if (Object.keys(rates).length === 0) throw new Error('Provedor de câmbio devolveu tabela vazia.');
  rates.USD = 1;

  return {
    base: 'USD',
    rates,
    fetchedAt: json.time_last_update_utc
      ? new Date(json.time_last_update_utc).toISOString()
      : new Date().toISOString(),
  };
}

/** Espelha as cotações na BD para a view converter as receitas. Falha em silêncio. */
async function syncRatesToDatabase(payload: RatesPayload, force: boolean): Promise<void> {
  if (!force && Date.now() - lastDbSyncAt < DB_SYNC_INTERVAL_MS) return;

  const url =
    process.env.SUPABASE_INTERNAL_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return;

  const supabase = createServiceClient(url, serviceRoleKey);
  const rows = Object.entries(payload.rates).map(([currency, per_usd]) => ({
    currency,
    per_usd,
    fetched_at: payload.fetchedAt,
  }));

  const { error } = await supabase
    .from('finance_exchange_rates')
    .upsert(rows, { onConflict: 'currency' });

  if (!error) lastDbSyncAt = Date.now();
}

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get('refresh') === '1';

  if (!force && memoryCache && memoryCache.expiresAt > Date.now()) {
    void syncRatesToDatabase(memoryCache.payload, false);
    return NextResponse.json({ ...memoryCache.payload, cached: true });
  }

  try {
    const payload = await fetchRates();
    memoryCache = { payload, expiresAt: Date.now() + DB_SYNC_INTERVAL_MS };
    await syncRatesToDatabase(payload, force);
    return NextResponse.json({ ...payload, cached: false });
  } catch (error) {
    // Cotação velha continua a ser melhor do que nenhuma.
    if (memoryCache) {
      return NextResponse.json({ ...memoryCache.payload, cached: true, stale: true });
    }
    const message = error instanceof Error ? error.message : 'Erro ao obter cotações.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
