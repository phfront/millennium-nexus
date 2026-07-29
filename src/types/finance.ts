export type IncomeSource = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  /** Valor sugerido por mês; preenche células sem entrada (você pode alterar mês a mês na planilha). */
  default_monthly_amount: number;
  /**
   * Moeda ISO-4217 em que os valores desta fonte são lançados.
   * `null` = moeda padrão (a de exibição); qualquer outra é convertida pela cotação atual.
   */
  currency: string | null;
  /**
   * Primeiro mês ('YYYY-MM-DD', dia 01) em que `currency` se aplica; meses
   * anteriores são lidos na moeda padrão, sem conversão. Evita que marcar uma
   * fonte como estrangeira reinterprete todo o histórico dela.
   */
  currency_since: string | null;
  created_at: string;
};

/** Moeda em que um lançamento desta fonte deve ser lido, dado o mês. */
export function incomeEntryCurrency(
  source: Pick<IncomeSource, 'currency' | 'currency_since'>,
  month: string,
  displayCurrency: string,
): string {
  if (!source.currency) return displayCurrency;
  if (source.currency_since && month < source.currency_since) return displayCurrency;
  return source.currency;
}

export type IncomeEntry = {
  id: string;
  user_id: string;
  source_id: string;
  month: string; // 'YYYY-MM-DD' — sempre dia 01
  amount: number;
  created_at: string;
};

export type ExpenseCategory = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: string;
};

/**
 * Balde do orçamento (regra 60/30/10).
 * `deduction` = imposto ou custo do negócio: continua lançado como despesa
 * na planilha, mas no orçamento abate da base em vez de ocupar um balde.
 * `null` = ainda não classificada.
 */
export type BudgetClass = 'essential' | 'optional' | 'investment' | 'deduction';

export const BUDGET_CLASSES: BudgetClass[] = [
  'essential',
  'optional',
  'investment',
  'deduction',
];

export const BUDGET_CLASS_LABEL: Record<BudgetClass, string> = {
  essential: 'Obrigatória',
  optional: 'Opcional',
  investment: 'Investimento',
  deduction: 'Imposto / custo do negócio',
};

/** Rótulo curto para chips na planilha. */
export const BUDGET_CLASS_SHORT: Record<BudgetClass, string> = {
  essential: 'Obrig.',
  optional: 'Opc.',
  investment: 'Invest.',
  deduction: 'Imposto',
};

export function isBudgetClass(raw: unknown): raw is BudgetClass {
  return typeof raw === 'string' && (BUDGET_CLASSES as string[]).includes(raw);
}

export function normalizeBudgetClass(raw: unknown): BudgetClass | null {
  return isBudgetClass(raw) ? raw : null;
}

export type ExpenseItem = {
  id: string;
  user_id: string;
  /** null = sem categoria (ex.: após excluir a categoria). */
  category_id: string | null;
  name: string;
  default_amount: number | null;
  /** Se true, preenche meses visíveis sem linha com `default_amount` (quando > 0). */
  is_recurring: boolean;
  /** Balde do orçamento; null = a classificar. */
  budget_class: BudgetClass | null;
  /** Dia do mês do vencimento (1–31); null = sem lembrete por vencimento. */
  due_day: number | null;
  /**
   * Esta linha é a fatura de um cartão: o seu valor mensal é o total da fatura,
   * e outras linhas podem declarar-se pagas dentro dela.
   */
  is_card: boolean;
  /**
   * Item-cartão dentro do qual esta despesa é paga. Se preenchido, os
   * lançamentos deste item NÃO somam ao total do mês: decompõem a fatura.
   * `null` = pago fora de cartão (débito, pix, dinheiro) e soma normalmente.
   */
  paid_with_item_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type ExpenseEntry = {
  id: string;
  user_id: string;
  item_id: string;
  month: string; // 'YYYY-MM-DD'
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  /** Nota opcional ao marcar como pago (histórico / arquivo do mês). */
  paid_note: string | null;
  created_at: string;
};

/** Lançamento pontual: despesa ou receita não recorrente. */
export type OneTimeEntry = {
  id: string;
  user_id: string;
  name: string;
  month: string; // 'YYYY-MM-DD'
  amount: number;
  /** Despesa ou receita pontual. */
  flow: 'expense' | 'income';
  /** Balde do orçamento; só se aplica a `flow = 'expense'`. */
  budget_class: BudgetClass | null;
  /** Data de vencimento opcional (YYYY-MM-DD) para lembretes push. */
  due_date: string | null;
  is_paid: boolean;
  paid_at: string | null;
  paid_note: string | null;
  created_at: string;
};

/** @deprecated Use OneTimeEntry */
export type OneTimeExpense = OneTimeEntry;

/**
 * Fatura × detalhado × restante de um item-cartão num mês. O restante nunca é
 * gravado — é o valor da linha do cartão menos as linhas pagas dentro dela.
 */
export type CardBreakdown = {
  /** Valor da linha do cartão no mês: o total da fatura. */
  invoiceAmount: number;
  /** Soma das linhas que declararam ser pagas dentro deste cartão. */
  itemizedAmount: number;
  itemizedCount: number;
  /**
   * `invoiceAmount - itemizedAmount`. Negativo = você detalhou mais do que a
   * fatura, que é estado de erro e a UI avisa.
   */
  residualAmount: number;
};

export type Subscription = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  billing_cycle: 'monthly' | 'yearly';
  renewal_day: number | null;
  is_active: boolean;
  /**
   * Item-cartão (`ExpenseItem.is_card`) em que esta assinatura é cobrada.
   * Ao contrário das despesas, aqui o ponteiro é só organizacional: as
   * assinaturas não entram no total do mês nem no orçamento, então apontar
   * para um cartão não muda nenhuma conta — serve para saber o que compõe
   * cada fatura. `null` = fora de cartão ou por definir.
   */
  paid_with_item_id: string | null;
  created_at: string;
};

export type Receivable = {
  id: string;
  user_id: string;
  person_name: string;
  description: string;
  amount: number;
  /** Total já recebido (parcial até quitar). */
  amount_paid: number;
  reference_month: string | null;
  is_paid: boolean;
  paid_at: string | null;
  /** Regra recorrente que gerou esta cobrança; null = avulsa. */
  series_id: string | null;
  created_at: string;
};

/**
 * Regra de cobrança recorrente. Não é cobrança: as cobranças são linhas de
 * `Receivable` geradas a partir daqui, uma por mês, até o mês corrente —
 * nunca futuras, porque o que ainda não venceu não é dívida.
 */
export type ReceivableSeries = {
  id: string;
  user_id: string;
  person_name: string;
  description: string;
  amount: number;
  /** Dia em que costuma cair (1–31); informativo, não gera vencimento. */
  due_day: number | null;
  /** Primeiro mês cobrado ('YYYY-MM-DD', dia 01). */
  start_month: string;
  /** Último mês cobrado; null = sem fim previsto. */
  end_month: string | null;
  is_active: boolean;
  created_at: string;
};

export type MonthlySummary = {
  user_id: string;
  month: string;
  total_income: number;
  total_expenses: number;
  total_one_time: number;
  surplus: number;
  accumulated_surplus: number;
};

export type ExpenseCategoryWithItems = ExpenseCategory & {
  items: ExpenseItem[];
};

export type FinanceUserSettings = {
  user_id: string;
  spreadsheet_months_forward: number;
  /** Dias antes do vencimento para push; vazio = lembretes desativados. */
  expense_due_reminder_days_before: number[];
  /** Hora local HH:MM (fuso do perfil no portal). */
  expense_due_reminder_time: string;
  /** Moeda ISO-4217 de exibição. Não converte o que já está guardado — só formata. */
  display_currency: string;
  /** Percentuais-alvo do orçamento; padrão 60/30/10. A soma não passa de 100. */
  budget_pct_essential: number;
  budget_pct_optional: number;
  budget_pct_investment: number;
  /** Receitas pontuais entram na base de cálculo do orçamento. */
  budget_include_one_time_income: boolean;
  updated_at: string;
};

/** Linha de `finance_budget_monthly` — receitas já convertidas na BD. */
export type BudgetMonthRow = {
  user_id: string;
  month: string;
  income_recurring: number;
  income_one_time: number;
  /** Impostos e custo do negócio: abatem da base. */
  deductions: number;
  essential: number;
  optional: number;
  investment: number;
  unclassified: number;
  unclassified_count: number;
  pct_essential: number;
  pct_optional: number;
  pct_investment: number;
  include_one_time_income: boolean;
  /**
   * `true` = o mês já foi arquivado e a base vem congelada do arquivo, não
   * recalculada com a cotação de hoje. É o que faz o Orçamento e o Histórico
   * contarem a mesma história sobre um mês fechado.
   */
  base_is_frozen: boolean;
};

/** Cotação global: quantas unidades de `currency` valem 1 USD. */
export type FinanceExchangeRate = {
  currency: string;
  per_usd: number;
  fetched_at: string;
};

/** Resumo congelado no fechamento do mês (consulta futura; não reflete edições posteriores nas entradas). */
export type FinanceMonthSnapshot = {
  user_id: string;
  month: string;
  total_income: number;
  total_expenses: number;
  total_one_time: number;
  surplus: number;
  accumulated_surplus: number;
  snapshot_at: string;
  /** Conclusão explícita: a sobra deste mês não entra no acumulado dos meses seguintes. */
  breaks_accumulated_carryover: boolean;
};

/** Lançamento individual congelado no fechamento do mês (nome/valor gravados no momento do arquivo). */
export type FinanceMonthSnapshotEntry = {
  id: string;
  user_id: string;
  month: string;
  entry_type: 'income' | 'expense' | 'one_time';
  /** null para receitas e pontuais */
  category_name: string | null;
  /** null para receitas e pontuais */
  category_color: string | null;
  /** Nome da fonte de renda / item de despesa / pontual congelado */
  item_name: string;
  amount: number;
  /** null para receitas */
  is_paid: boolean | null;
  /** só para pontuais (YYYY-MM-DD) */
  due_date: string | null;
  sort_order: number;
  /** Nota opcional ao marcar despesa/pontual como pago. */
  paid_note: string | null;
  /** Só quando entry_type = one_time: despesa ou receita pontual. */
  one_time_flow: string | null;
};
