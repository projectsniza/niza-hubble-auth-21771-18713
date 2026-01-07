-- Fix RLS policies for events, performance_reviews, and performance_criteria tables

-- ============================================
-- 1. EVENTS - Allow managers to create events
-- ============================================

-- Drop existing policies if they conflict
DROP POLICY IF EXISTS "Managers can insert events" ON public.events;
DROP POLICY IF EXISTS "Managers can update own events" ON public.events;
DROP POLICY IF EXISTS "Managers can delete own events" ON public.events;

-- Managers can insert events (only within their branch scope)
CREATE POLICY "Managers can insert events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'manager'::public.app_role)
  AND branch_id = (SELECT branch_id FROM public.get_my_profile_data())
  AND organization_id = (SELECT organization_id FROM public.get_my_profile_data())
);

-- Managers can update their own events
CREATE POLICY "Managers can update own events"
ON public.events
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::public.app_role)
  AND created_by = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager'::public.app_role)
  AND created_by = auth.uid()
);

-- Managers can delete their own events
CREATE POLICY "Managers can delete own events"
ON public.events
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::public.app_role)
  AND created_by = auth.uid()
);

-- ============================================
-- 2. PERFORMANCE_REVIEWS - Allow HR and Managers
-- ============================================

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "HR can manage performance reviews" ON public.performance_reviews;
DROP POLICY IF EXISTS "Managers can manage performance reviews" ON public.performance_reviews;
DROP POLICY IF EXISTS "Users can view own reviews" ON public.performance_reviews;

-- HR can insert performance reviews
CREATE POLICY "HR can insert performance reviews"
ON public.performance_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'hr'::public.app_role)
);

-- HR can update performance reviews
CREATE POLICY "HR can update performance reviews"
ON public.performance_reviews
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'hr'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'hr'::public.app_role)
);

-- HR can view all performance reviews
CREATE POLICY "HR can view performance reviews"
ON public.performance_reviews
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'hr'::public.app_role)
);

-- Managers can insert performance reviews (for employees in their branch)
CREATE POLICY "Managers can insert performance reviews"
ON public.performance_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'manager'::public.app_role)
  AND employee_id IN (
    SELECT id FROM public.employees 
    WHERE branch_id = (SELECT branch_id FROM public.get_my_profile_data())
  )
);

-- Managers can update performance reviews they created
CREATE POLICY "Managers can update own performance reviews"
ON public.performance_reviews
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::public.app_role)
  AND reviewer_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager'::public.app_role)
  AND reviewer_id = auth.uid()
);

-- Managers can view performance reviews for employees in their branch
CREATE POLICY "Managers can view branch performance reviews"
ON public.performance_reviews
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::public.app_role)
  AND employee_id IN (
    SELECT id FROM public.employees 
    WHERE branch_id = (SELECT branch_id FROM public.get_my_profile_data())
  )
);

-- ============================================
-- 3. PERFORMANCE_CRITERIA - Allow HR to manage
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "HR can manage performance criteria" ON public.performance_criteria;
DROP POLICY IF EXISTS "Users can view performance criteria" ON public.performance_criteria;

-- HR can insert performance criteria
CREATE POLICY "HR can insert performance criteria"
ON public.performance_criteria
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'hr'::public.app_role)
);

-- HR can update performance criteria
CREATE POLICY "HR can update performance criteria"
ON public.performance_criteria
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'hr'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'hr'::public.app_role)
);

-- All authenticated users can view performance criteria
CREATE POLICY "Users can view performance criteria"
ON public.performance_criteria
FOR SELECT
TO authenticated
USING (true);