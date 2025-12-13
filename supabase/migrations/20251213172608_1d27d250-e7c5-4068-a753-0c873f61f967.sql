-- Add only missing employee-related policies for scheduling

-- Employees can view rotas in their branch
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Employees can view rotas in their branch' AND tablename = 'rotas') THEN
    CREATE POLICY "Employees can view rotas in their branch"
    ON public.rotas
    FOR SELECT
    USING (
      has_role(auth.uid(), 'employee'::app_role) 
      AND branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    );
  END IF;
END $$;

-- Employees can view their own shifts
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Employees can view their own shifts' AND tablename = 'rota_shifts') THEN
    CREATE POLICY "Employees can view their own shifts"
    ON public.rota_shifts
    FOR SELECT
    USING (
      has_role(auth.uid(), 'employee'::app_role) 
      AND employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    );
  END IF;
END $$;

-- Employees can view trainings assigned to them
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Employees can view trainings assigned to them' AND tablename = 'trainings') THEN
    CREATE POLICY "Employees can view trainings assigned to them"
    ON public.trainings
    FOR SELECT
    USING (
      has_role(auth.uid(), 'employee'::app_role) 
      AND assigned_to = auth.uid()
    );
  END IF;
END $$;