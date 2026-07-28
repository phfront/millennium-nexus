'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, useToast } from '@phfront/millennium-ui';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import { useCurrencyConversion } from '@/hooks/finance/use-currency-conversion';
import { CurrencySelect } from '@/components/finance/ui/CurrencySelect';
import { currencyName, formatMoney } from '@/lib/finance/currency';

function formatFetchedAt(iso: string | null): string {
  if (!iso) return 'sem cotações carregadas';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'sem cotações carregadas';
  return `atualizadas em ${d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
}

export function CurrencySettingsForm() {
  const { toast } = useToast();
  const { displayCurrency, isLoading, updateDisplayCurrency } = useFinanceSpreadsheetSettings();
  const { supportedCurrencies, hasRates, fetchedAt, isLoading: ratesLoading, refresh } =
    useCurrencyConversion();

  const [draft, setDraft] = useState(displayCurrency);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading) setDraft(displayCurrency);
  }, [displayCurrency, isLoading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await updateDisplayCurrency(draft);
    setSaving(false);
    if (error) {
      toast.error('Não foi possível guardar', error);
      return;
    }
    toast.success('Moeda atualizada', `Os valores passam a aparecer em ${currencyName(draft)}.`);
  }

  async function handleRefreshRates() {
    try {
      await refresh();
      toast.success('Cotações atualizadas');
    } catch {
      toast.error('Não foi possível atualizar as cotações', 'Tenta novamente daqui a pouco.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface-2 border border-border rounded-xl p-5 space-y-4">
      <div>
        <span className="text-sm font-medium text-text-primary block mb-1">Moeda de exibição</span>
        <p className="text-xs text-text-muted mb-3">
          Em que moeda você quer ver os valores do módulo. Isso <strong>não converte</strong> o que já está
          guardado: os números continuam iguais, muda só o símbolo e a formatação. As fontes de renda
          marcadas com outra moeda é que são convertidas para esta, pela cotação atual.
        </p>
        <CurrencySelect
          className="max-w-xs"
          value={draft}
          onChange={(next) => setDraft(next ?? displayCurrency)}
          supportedCurrencies={supportedCurrencies}
          disabled={isLoading}
        />
        <p className="text-xs text-text-muted mt-2">
          Exemplo: <span className="text-text-secondary">{formatMoney(1234.56, draft)}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
        <span className="text-xs text-text-muted pt-3">
          Cotações {hasRates ? formatFetchedAt(fetchedAt) : '— indisponíveis de momento'}. São usadas
          para converter receitas em moeda estrangeira.
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={handleRefreshRates}
          disabled={ratesLoading}
          leftIcon={<RefreshCw size={14} />}
        >
          {ratesLoading ? 'A atualizar…' : 'Atualizar cotações'}
        </Button>
      </div>

      <Button type="submit" disabled={saving || isLoading || draft === displayCurrency}>
        {saving ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  );
}
