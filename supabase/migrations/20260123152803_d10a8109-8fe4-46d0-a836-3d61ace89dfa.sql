-- Add registration_number column to organizations table
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS registration_number TEXT;