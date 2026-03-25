-- Remove duplicidades de ponto mantendo a linha mais completa por pessoa/job/data
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY person_id, job_id, date
      ORDER BY
        ((entry1 IS NOT NULL)::int +
         (exit1 IS NOT NULL)::int +
         (entry2 IS NOT NULL)::int +
         (exit2 IS NOT NULL)::int +
         (entry3 IS NOT NULL)::int +
         (exit3 IS NOT NULL)::int) DESC,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.time_entries
)
DELETE FROM public.time_entries t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

-- Garante unicidade por pessoa + job + data para impedir perda/sumiço por registros duplicados
CREATE UNIQUE INDEX IF NOT EXISTS ux_time_entries_person_job_date
ON public.time_entries (person_id, job_id, date);