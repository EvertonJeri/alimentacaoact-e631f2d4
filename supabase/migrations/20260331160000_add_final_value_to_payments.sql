-- Adiciona colunas de controle de saldo e valor congelado na tabela de pagamentos
ALTER TABLE public.payment_confirmations 
  ADD COLUMN IF NOT EXISTS apply_balance boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS applied_balance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_value numeric,
  ADD COLUMN IF NOT EXISTS person_id text;

-- Adiciona colunas de cronograma e profissionais Cartão Flash na tabela de configurações
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS flash_card_users text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS clt_alert_day integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS clt_alert_day2 integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS pj_alert_day integer DEFAULT 19,
  ADD COLUMN IF NOT EXISTS pj_alert_day2 integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS clt_payment_day integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS clt_advance_day integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS clt_sheet_close_day integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS pj_period1_end_day integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS pj_period1_payment_day integer DEFAULT 19,
  ADD COLUMN IF NOT EXISTS pj_period2_payment_day integer DEFAULT 4;
