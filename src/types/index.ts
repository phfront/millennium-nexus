export type IncomeSource = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  /** Valor sugerido por mês; preenche células sem entrada (podes alterar mês a mês na planilha). */
  default_monthly_amount: number;
  created_at: string;
};

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

export type ExpenseItem = {
  id: string;
  user_id: string;
  /** null = sem categoria (ex.: após excluir a categoria). */
  category_id: string | null;
  name: string;
  default_amount: number | null;
  /** Se true, preenche meses visíveis sem linha com `default_amount` (quando > 0). */
  is_recurring: boolean;
  /** Dia do mês do vencimento (1–31); null = sem lembrete por vencimento. */
  due_day: number | null;
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
  paid_note: string | null;
  created_at: string;
};

export type OneTimeEntry = {
  id: string;
  user_id: string;
  name: string;
  month: string;
  amount: number;
  flow: 'expense' | 'income';
  due_date: string | null;
  is_paid: boolean;
  paid_at: string | null;
  paid_note: string | null;
  created_at: string;
};

export type OneTimeExpense = OneTimeEntry;

export type Subscription = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  billing_cycle: 'monthly' | 'yearly';
  renewal_day: number | null;
  is_active: boolean;
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
  updated_at: string;
};

/** Resumo congelado no fecho do mês (consulta futura; não reflete edições posteriores nas entradas). */
export type FinanceMonthSnapshot = {
  user_id: string;
  month: string;
  total_income: number;
  total_expenses: number;
  total_one_time: number;
  surplus: number;
  accumulated_surplus: number;
  snapshot_at: string;
};

/** Lançamento individual congelado no fecho do mês (nome/valor gravados no momento do arquivo). */
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
  paid_note: string | null;
  one_time_flow: string | null;
};
