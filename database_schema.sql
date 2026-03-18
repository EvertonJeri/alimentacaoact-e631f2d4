-- Script de Criação do Banco de Dados para Registro de Horas e Refeições
-- Você pode rodar este código no "SQL Editor" do seu painel do Supabase.

-- Tabela: jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: people
CREATE TABLE IF NOT EXISTS public.people (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_registered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: time_entries (Base do Registro de Horas)
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  entry1 TIME,
  exit1 TIME,
  entry2 TIME,
  exit2 TIME,
  entry3 TIME,
  exit3 TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: meal_requests (Solicitações de Refeições)
CREATE TABLE IF NOT EXISTS public.meal_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  meals TEXT[] NOT NULL,
  daily_overrides JSONB, -- Para salvar o objeto das alterações individuais de cada dia JSON
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: food_control (Controle de Alimentação)
CREATE TABLE IF NOT EXISTS public.food_control (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL, -- 'cafe', 'almoco' ou 'janta'
  status TEXT DEFAULT 'not_consumed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security) para segurança
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_control ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir leitura e escrita livre (ajuste depois se houver autenticação)
CREATE POLICY "Enable all for jobs" ON public.jobs FOR ALL USING (true);
CREATE POLICY "Enable all for people" ON public.people FOR ALL USING (true);
CREATE POLICY "Enable all for time_entries" ON public.time_entries FOR ALL USING (true);
CREATE POLICY "Enable all for meal_requests" ON public.meal_requests FOR ALL USING (true);
CREATE POLICY "Enable all for food_control" ON public.food_control FOR ALL USING (true);
