-- Add priority column to safety_tasks table
ALTER TABLE public.safety_tasks ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';