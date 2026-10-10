-- ============================================================
-- NEXUS FINANCE — Assinatura sabe em que cartão é cobrada
--
-- Continuação da 074. Lá, o cartão deixou de ser entidade própria:
-- é uma linha de despesa marcada `is_card`, e outras linhas podem
-- declarar-se pagas dentro dela.
--
-- Aqui a assinatura ganha o mesmo ponteiro — e SÓ isso. Diferença
-- deliberada em relação às despesas: nas despesas, apontar para um
-- cartão vira a soma (a linha deixa de somar e passa a decompor a
-- fatura). Numa assinatura não vira nada, porque as assinaturas já
-- não somam: `finance_subscriptions` não entra em
-- `finance_monthly_summary`, nem em `finance_budget_monthly`, nem no
-- arquivo do mês. A lista é informativa, e o que a fatura cobra já
-- está na linha do cartão.
--
-- Fazer as assinaturas abaterem o restante da fatura contaria o mesmo
-- dinheiro noutro sítio — exatamente o que a 074 tornou
-- irrepresentável. Logo: nenhuma vista é tocada por esta migration.
-- O ponteiro serve para a tela responder "quais assinaturas caem no
-- Itaú Black, e quanto dão por mês" — organização, não contabilidade.
--
-- Reutiliza o nome `paid_with_item_id` de propósito: é o mesmo
-- conceito ("cobrada dentro deste item-cartão"), e a simetria evita
-- ter de lembrar dois nomes para a mesma coisa.
-- ============================================================

ALTER TABLE public.finance_subscriptions
  ADD COLUMN IF NOT EXISTS paid_with_item_id UUID
    REFERENCES public.finance_expense_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.finance_subscriptions.paid_with_item_id IS
  'Item-cartão (finance_expense_items.is_card) em que esta assinatura é cobrada. Puramente organizacional: NÃO afeta totais, orçamento nem arquivo do mês — as assinaturas não entram nessas contas. NULL = fora de cartão ou por definir.';

CREATE INDEX IF NOT EXISTS idx_finance_subscriptions_paid_with
  ON public.finance_subscriptions (user_id, paid_with_item_id);
