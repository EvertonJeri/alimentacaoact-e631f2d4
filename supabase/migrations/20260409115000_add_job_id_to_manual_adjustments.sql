
ALTER TABLE public.manual_adjustments ADD COLUMN job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL;
