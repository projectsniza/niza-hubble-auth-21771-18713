-- Add criteria_ratings column to performance_reviews table
ALTER TABLE public.performance_reviews 
ADD COLUMN IF NOT EXISTS criteria_ratings jsonb DEFAULT '[]';