ALTER TABLE public.temporary_employees
  ADD COLUMN IF NOT EXISTS source_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_name text;

CREATE INDEX IF NOT EXISTS idx_temporary_employees_source_branch ON public.temporary_employees(source_branch_id);