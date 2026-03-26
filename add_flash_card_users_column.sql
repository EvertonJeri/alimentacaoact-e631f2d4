-- Rode este comando no "SQL Editor" do seu Supabase para adicionar a coluna que falta

ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS flash_card_users UUID[] DEFAULT '{}';
