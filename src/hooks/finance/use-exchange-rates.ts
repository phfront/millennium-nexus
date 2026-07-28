'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Cotações atuais (unidades por 1 USD) partilhadas por todo o módulo Finanças.
 *
 * Cache em módulo + `localStorage` para que abrir/fechar planilhas não dispare
 * pedidos novos; a rota `/api/finance/exchange-rates` já faz o seu próprio
 * cache de 1h contra o provedor.
 */

const STORAGE_KEY = 'nexus-finance:exchange-rates';
const TTL_MS = 60 * 60 * 1000;

export type ExchangeRatesState = {
  /** Unidades da moeda por 1 USD; `null` enquanto não há cotações. */
  rates: Record<string, number> | null;
  /** ISO da última atualização do provedor. */
  fetchedAt: string | null;
  isLoading: boolean;
  error: string | null;
};

type CacheEntry = { rates: Record<string, number>; fetchedAt: string; storedAt: number };

let cache: CacheEntry | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function readStorage(): CacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed?.rates || typeof parsed.storedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(entry: CacheEntry) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* quota/modo privado — o cache em memória chega */
  }
}

function isFresh(entry: CacheEntry | null): entry is CacheEntry {
  return !!entry && Date.now() - entry.storedAt < TTL_MS;
}

async function load(force: boolean): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const res = await fetch(`/api/finance/exchange-rates${force ? '?refresh=1' : ''}`, {
      cache: 'no-store',
    });
    // Sessão expirada: o middleware redireciona para /login e devolve HTML.
    if (!res.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Sessão expirada — recarrega a página.');
    }
    const json = (await res.json()) as {
      rates?: Record<string, number>;
      fetchedAt?: string;
      error?: string;
    };
    if (!res.ok || !json.rates) throw new Error(json.error ?? 'Não foi possível obter as cotações.');
    cache = { rates: json.rates, fetchedAt: json.fetchedAt ?? new Date().toISOString(), storedAt: Date.now() };
    writeStorage(cache);
    emit();
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

export function useExchangeRates(): ExchangeRatesState & { refresh: () => Promise<void> } {
  const [, forceRender] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!cache) cache = readStorage();
    // Stale-while-revalidate: mostra já o cache local, mas revalida assim mesmo.
    // A revalidação é o que mantém `finance_exchange_rates` em dia na BD (é essa
    // tabela que a view usa para converter os totais), por isso não pode ser
    // saltada só porque o cliente tem cotações frescas.
    const hadCache = isFresh(cache);
    if (hadCache) forceRender((n) => n + 1);

    let alive = true;
    if (!hadCache) setIsLoading(true);
    load(false)
      .then(() => alive && setError(null))
      .catch((e: unknown) => {
        // Com cache válido em mão, uma revalidação falhada não é erro para o usuário.
        if (alive && !hadCache) setError(e instanceof Error ? e.message : 'Erro de câmbio.');
      })
      .finally(() => alive && setIsLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await load(true);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro de câmbio.');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    rates: cache?.rates ?? null,
    fetchedAt: cache?.fetchedAt ?? null,
    isLoading,
    error,
    refresh,
  };
}
