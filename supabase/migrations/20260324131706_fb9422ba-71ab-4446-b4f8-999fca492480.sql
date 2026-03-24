
-- Tabela: system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enable_teams BOOLEAN DEFAULT true,
  teams_webhook_url TEXT,
  enable_whatsapp BOOLEAN DEFAULT true,
  manager_whatsapp TEXT DEFAULT '',
  enable_email BOOLEAN DEFAULT true,
  admin_emails TEXT,
  finance_whatsapp TEXT DEFAULT '',
  finance_emails TEXT DEFAULT '',
  hr_whatsapp TEXT DEFAULT '',
  hr_emails TEXT DEFAULT '',
  discount_alert_date INTEGER DEFAULT 25,
  discount_auto_send BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

-- Tabela: custom_holidays
CREATE TABLE IF NOT EXISTS public.custom_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.custom_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for custom_holidays" ON public.custom_holidays FOR ALL USING (true) WITH CHECK (true);
