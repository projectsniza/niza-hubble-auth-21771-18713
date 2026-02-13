
-- Fix: safety_tasks.assigned_to must allow NULL for cleanup to work
ALTER TABLE public.safety_tasks ALTER COLUMN assigned_to DROP NOT NULL;
ALTER TABLE public.safety_tasks ALTER COLUMN assigned_by DROP NOT NULL;

-- Also fix any other columns that might cause similar issues
ALTER TABLE public.hazard_reports ALTER COLUMN reported_by DROP NOT NULL;
