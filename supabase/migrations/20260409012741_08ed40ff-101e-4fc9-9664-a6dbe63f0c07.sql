
CREATE TABLE public.manual_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'desconto',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.manual_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for manual_adjustments"
ON public.manual_adjustments
FOR ALL
TO public
USING (true)
WITH CHECK (true);
