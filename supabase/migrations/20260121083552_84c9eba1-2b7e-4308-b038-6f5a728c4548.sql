-- Add requires_supporting_document to leave_types
ALTER TABLE public.leave_types 
  ADD COLUMN IF NOT EXISTS requires_supporting_document BOOLEAN DEFAULT false;

-- Add supporting document fields to leave_requests
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS supporting_document_path TEXT,
  ADD COLUMN IF NOT EXISTS supporting_document_name TEXT;