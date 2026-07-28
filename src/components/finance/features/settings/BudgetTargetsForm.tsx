'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Input, useToast } from '@phfront/millennium-ui';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import {
  firstDayToMonthInputValue,
  monthInputValueToFirstDay,
  toMonthDate,
} from '@/lib/finance/finance';

/** Presets conhecidos; 50/30/20 é a regra clássica, 60/30/10 a variante para custo fixo alto. */
const PRESETS = [
  { label: '50 / 30 / 20', essential: 50, optional: 30, investment: 20 },
  { label: '60 / 30 / 10', essential: 60, optional: 30, investment: 10 },
  { label: '70 / 20 / 10', essential: 70, optional: 20, investment: 10 },
];

export function BudgetTargetsForm() {
  const { toast } = useToast();
  const {
    budgetPctEssential,
    budgetPctOptional,
    budgetPctInvestment,
    budgetIncludeOneTimeIncome,
    isLoading,
    updateBudgetTargets,
  } = useFinanceSpreadsheetSettings();

  const [essential, setEssential] = useState(String(budgetPctEssential));
  const [optional, setOptional] = useState(String(budgetPctOptional));
  const [investment, setInvestment] = useState(String(budgetPctInvestment));
  const [includeOneTime, setIncludeOneTime] = useState(budgetIncludeOneTimeIncome);
  /**
   * A partir de que mês estes alvos valem. O padrão é o mês corrente: mudar de
   * ideias hoje não deve reescrever o plano com que já fechaste meses passados.
   */
  const [effectiveFrom, setEffectiveFrom] = useState(() =>
    firstDayToMonthInputValue(toMonthDate(new Date())),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    setEssential(String(budgetPctEssential));
    setOptional(String(budgetPctOptional));
    setInvestment(String(budgetPctInvestment));
    setIncludeOneTime(budgetIncludeOneTimeIncome);
  }, [
    isLoading,
    budgetPctEssential,
    budgetPctOptional,
    budgetPctInvestment,
    budgetIncludeOneTimeIncome,
  ]);

  const sum = useMemo(() => {
    const n = (v: string) => {
      const x = Number(v.replace(',', '.'));
      return Number.isFinite(x) ? x : 0;
    };
    return Math.round((n(essential) + n(optional) + n(investment)) * 10) / 10;
  }, [essential, optional, investment]);

  const overflows = sum > 100;

  function applyPreset(p: (typeof PRESETS)[number]) {
    setEssential(String(p.essential));
    setOptional(String(p.optional));
    setInvestment(String(p.investment));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parse = (v: string) => Number(v.replace(',', '.'));
    setSaving(true);
    const { error } = await updateBudgetTargets({
      essential: parse(essential),
      optional: parse(optional),
      investment: parse(investment),
      includeOneTimeIncome: includeOneTime,
      effectiveFrom: monthInputValueToFirstDay(effectiveFrom),
    });
    setSaving(false);
    if (error) {
      toast.error('Não foi possível guardar', error);
      return;
    }
    toast.success('Alvos do orçamento guardados');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface-2 p-5">
      <div>
        <h2 className="mb-1 block text-sm font-medium text-text-primary">Alvos do orçamento</h2>
        <p className="mb-3 text-xs leading-relaxed text-text-muted">
          Percentuais da renda líquida usados na tela Orçamento. O padrão é 60/30/10; a regra clássica
          é 50/30/20 e a maioria das recomendações de investimento fica entre 15% e 20%. A soma pode
          ficar abaixo de 100% — o resto aparece como não alocado.
        </p>

        <div className="mb-3 rounded-lg border border-border bg-surface-3/40 p-3">
          <label
            htmlFor="budget-effective-from"
            className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted"
          >
            Vale a partir de
          </label>
          <input
            id="budget-effective-from"
            type="month"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border border-transparent bg-surface-3 px-3 py-2 text-sm text-text-primary outline-none ring-1 ring-inset ring-border focus:ring-brand-primary"
          />
          <p className="mt-1 text-[10px] leading-relaxed text-text-muted">
            Os meses anteriores mantêm o alvo que vigorava neles — mudar de ideias hoje não reescreve
            o plano com que você já fechou meses passados. Adiante um mês futuro para declarar uma
            intenção (“a partir de janeiro quero 25% de investimento”).
          </p>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              disabled={isLoading}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="budget-essential"
              className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted"
            >
              Obrigatórias
            </label>
            <Input
              id="budget-essential"
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={essential}
              onChange={(e) => setEssential(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div>
            <label
              htmlFor="budget-optional"
              className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted"
            >
              Opcionais
            </label>
            <Input
              id="budget-optional"
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={optional}
              onChange={(e) => setOptional(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div>
            <label
              htmlFor="budget-investment"
              className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted"
            >
              Investimento
            </label>
            <Input
              id="budget-investment"
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={investment}
              onChange={(e) => setInvestment(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <p
          className={`mt-2 text-xs tabular-nums ${overflows ? 'font-medium text-danger' : 'text-text-muted'}`}
          role={overflows ? 'alert' : undefined}
        >
          Soma: {String(sum).replace('.', ',')}%
          {overflows && ' — não pode passar de 100%.'}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-2 border-t border-border pt-4 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={includeOneTime}
          onChange={(e) => setIncludeOneTime(e.target.checked)}
          disabled={isLoading}
          className="mt-1 rounded border-border"
        />
        <span>
          <span className="font-medium text-text-primary">
            Incluir receitas pontuais na base
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">
            13.º, bónus e vendas avulsas passam a contar na base de cálculo. Desligado, o teto de
            gastos fica preso à renda previsível e não sobe num mês atípico.
          </span>
        </span>
      </label>

      <Button type="submit" disabled={saving || isLoading || overflows}>
        {saving ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  );
}
