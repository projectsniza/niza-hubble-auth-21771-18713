
-- Customer Accounts table
CREATE TABLE public.customer_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  created_by UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

-- Monthly account entries
CREATE TABLE public.customer_monthly_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  month_date DATE NOT NULL, -- first of month, e.g. 2026-01-01
  total_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_date DATE,
  marked_paid_by UUID,
  notes TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, month_date)
);

ALTER TABLE public.customer_monthly_accounts ENABLE ROW LEVEL SECURITY;

-- Line items (optional detail for a monthly account)
CREATE TABLE public.customer_account_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monthly_account_id UUID NOT NULL REFERENCES public.customer_monthly_accounts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchased_date DATE,
  tax NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_account_items ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
CREATE TRIGGER update_customer_accounts_updated_at
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_monthly_accounts_updated_at
  BEFORE UPDATE ON public.customer_monthly_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for customer_accounts
-- Super admin & HR: full access
CREATE POLICY "Super admins full access customer_accounts"
  ON public.customer_accounts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR full access customer_accounts"
  ON public.customer_accounts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'hr'));

-- Managers: SELECT all in their branch, INSERT only (no UPDATE/DELETE)
CREATE POLICY "Managers select customer_accounts"
  ON public.customer_accounts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND branch_id IN (
      SELECT p.branch_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Managers insert customer_accounts"
  ON public.customer_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
    AND branch_id IN (
      SELECT p.branch_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- RLS Policies for customer_monthly_accounts
CREATE POLICY "Super admins full access monthly_accounts"
  ON public.customer_monthly_accounts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR full access monthly_accounts"
  ON public.customer_monthly_accounts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Managers select monthly_accounts"
  ON public.customer_monthly_accounts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND branch_id IN (
      SELECT p.branch_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Managers insert monthly_accounts"
  ON public.customer_monthly_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
    AND branch_id IN (
      SELECT p.branch_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- RLS Policies for customer_account_items
CREATE POLICY "Super admins full access account_items"
  ON public.customer_account_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR full access account_items"
  ON public.customer_account_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Managers select account_items"
  ON public.customer_account_items FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND monthly_account_id IN (
      SELECT id FROM public.customer_monthly_accounts
      WHERE branch_id IN (SELECT p.branch_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

CREATE POLICY "Managers insert account_items"
  ON public.customer_account_items FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
    AND monthly_account_id IN (
      SELECT id FROM public.customer_monthly_accounts
      WHERE branch_id IN (SELECT p.branch_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  );
