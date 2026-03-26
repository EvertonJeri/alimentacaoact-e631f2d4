
ALTER TABLE public.system_settings 
  ADD COLUMN IF NOT EXISTS admin_whatsapp text DEFAULT '',
  ADD COLUMN IF NOT EXISTS clt_alert_day integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS pj_alert_day integer DEFAULT 19;
