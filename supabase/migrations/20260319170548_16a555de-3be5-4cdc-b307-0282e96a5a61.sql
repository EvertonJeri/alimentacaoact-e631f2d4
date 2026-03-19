
CREATE TABLE IF NOT EXISTS public.payment_confirmations (
  id text PRIMARY KEY,
  type text NOT NULL DEFAULT 'request',
  payment_date text,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to payment_confirmations" ON public.payment_confirmations FOR ALL USING (true) WITH CHECK (true);
