-- Add attachments column to method_statements table
ALTER TABLE public.method_statements 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;