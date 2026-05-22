CREATE TABLE public.employee_separations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  left_on date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_employee_separations_employee ON public.employee_separations(employee_id);
CREATE INDEX idx_employee_separations_branch ON public.employee_separations(branch_id);

ALTER TABLE public.employee_separations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view separations"
  ON public.employee_separations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins/HR/Branch managers can insert separations"
  ON public.employee_separations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'hr'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.branch_id = employee_separations.branch_id
    )
  );

CREATE POLICY "Admins/HR can update separations"
  ON public.employee_separations FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Admins/HR can delete separations"
  ON public.employee_separations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'hr'::app_role));

CREATE TRIGGER trg_employee_separations_updated_at
  BEFORE UPDATE ON public.employee_separations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();