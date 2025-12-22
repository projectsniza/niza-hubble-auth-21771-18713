-- Add e-signature fields to document_requirements
ALTER TABLE public.document_requirements
ADD COLUMN requires_esignature boolean DEFAULT false,
ADD COLUMN verification_message text;

-- Add signature fields to documents table for storing verification info
ALTER TABLE public.documents
ADD COLUMN verified_by_name text,
ADD COLUMN verified_by_role text,
ADD COLUMN verified_by_signature text,
ADD COLUMN verified_at timestamp with time zone,
ADD COLUMN verification_message text;