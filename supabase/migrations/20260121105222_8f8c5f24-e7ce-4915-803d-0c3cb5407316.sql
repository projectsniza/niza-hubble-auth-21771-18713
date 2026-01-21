-- Add file attachment columns to safety_tasks table
ALTER TABLE public.safety_tasks 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS completion_attachments JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the columns
COMMENT ON COLUMN public.safety_tasks.attachments IS 'Files attached by admin when creating the task';
COMMENT ON COLUMN public.safety_tasks.completion_attachments IS 'Files attached by employee when completing the task';