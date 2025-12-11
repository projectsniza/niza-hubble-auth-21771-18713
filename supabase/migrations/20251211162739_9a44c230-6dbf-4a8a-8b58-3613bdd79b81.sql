-- Add RLS policies for role-based access (using IF NOT EXISTS pattern with DO blocks)

-- HR can manage risk assessments in their scope
DO $$ BEGIN
CREATE POLICY "HR can manage risk_assessments in their scope"
ON public.risk_assessments FOR ALL
USING (
    has_role(auth.uid(), 'hr'::app_role) AND (
        (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
        OR organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
        OR branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    )
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Managers can manage risk assessments in their branch
DO $$ BEGIN
CREATE POLICY "Managers can manage risk_assessments in their branch"
ON public.risk_assessments FOR ALL
USING (
    has_role(auth.uid(), 'manager'::app_role) 
    AND branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- HR can manage incidents in their scope
DO $$ BEGIN
CREATE POLICY "HR can manage incidents in their scope"
ON public.incidents FOR ALL
USING (
    has_role(auth.uid(), 'hr'::app_role) AND (
        (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
        OR organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
        OR branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    )
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Managers can manage incidents in their branch
DO $$ BEGIN
CREATE POLICY "Managers can manage incidents in their branch"
ON public.incidents FOR ALL
USING (
    has_role(auth.uid(), 'manager'::app_role) 
    AND branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- HR can manage hazard_reports in their scope
DO $$ BEGIN
CREATE POLICY "HR can manage hazard_reports in their scope"
ON public.hazard_reports FOR ALL
USING (
    has_role(auth.uid(), 'hr'::app_role) AND (
        (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
        OR organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
        OR branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    )
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Managers can manage hazard_reports in their branch
DO $$ BEGIN
CREATE POLICY "Managers can manage hazard_reports in their branch"
ON public.hazard_reports FOR ALL
USING (
    has_role(auth.uid(), 'manager'::app_role) 
    AND branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- HR can manage coshh_assessments in their scope
DO $$ BEGIN
CREATE POLICY "HR can manage coshh_assessments in their scope"
ON public.coshh_assessments FOR ALL
USING (
    has_role(auth.uid(), 'hr'::app_role) AND (
        (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
        OR organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
        OR branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    )
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Managers can manage coshh_assessments in their branch
DO $$ BEGIN
CREATE POLICY "Managers can manage coshh_assessments in their branch"
ON public.coshh_assessments FOR ALL
USING (
    has_role(auth.uid(), 'manager'::app_role) 
    AND branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- HR can manage method_statements in their scope
DO $$ BEGIN
CREATE POLICY "HR can manage method_statements in their scope"
ON public.method_statements FOR ALL
USING (
    has_role(auth.uid(), 'hr'::app_role) AND (
        (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
        OR organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
        OR branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    )
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Managers can manage method_statements in their branch
DO $$ BEGIN
CREATE POLICY "Managers can manage method_statements in their branch"
ON public.method_statements FOR ALL
USING (
    has_role(auth.uid(), 'manager'::app_role) 
    AND branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;