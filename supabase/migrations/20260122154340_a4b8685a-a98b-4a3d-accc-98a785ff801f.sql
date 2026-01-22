-- Drop the old constraint and add a new one that includes 'completed'
ALTER TABLE public.performance_reviews 
DROP CONSTRAINT IF EXISTS performance_reviews_status_check;

ALTER TABLE public.performance_reviews 
ADD CONSTRAINT performance_reviews_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'acknowledged'::text, 'completed'::text]));