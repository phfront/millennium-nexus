-- Pontuação exclusiva do diário alimentar: aderência proporcional aos itens do plano.
-- (O UPDATE dos trackers fica na 065 — PG não permite usar enum novo na mesma transação.)

ALTER TYPE public.scoring_mode ADD VALUE IF NOT EXISTS 'planned_items';
