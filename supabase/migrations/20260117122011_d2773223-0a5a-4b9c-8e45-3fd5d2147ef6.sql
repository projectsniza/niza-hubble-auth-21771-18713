-- Create lottery_games table for managing scratchcard games
CREATE TABLE public.lottery_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  game_name TEXT NOT NULL,
  ticket_price DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create lottery_daily_records table for daily lottery reconciliation
CREATE TABLE public.lottery_daily_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.lottery_games(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  stock_begin INTEGER NOT NULL DEFAULT 0,
  activated_tickets INTEGER NOT NULL DEFAULT 0,
  stock_end INTEGER,
  tickets_sold INTEGER GENERATED ALWAYS AS (GREATEST(0, stock_begin + activated_tickets - COALESCE(stock_end, 0))) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(game_id, record_date)
);

-- Create lottery_monthly_summary table for monthly reconciliation
CREATE TABLE public.lottery_monthly_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  month_year DATE NOT NULL,
  total_sales_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  closing_stock_working INTEGER NOT NULL DEFAULT 0,
  closing_stock_physical INTEGER,
  stock_difference INTEGER GENERATED ALWAYS AS (closing_stock_working - COALESCE(closing_stock_physical, 0)) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(branch_id, month_year)
);

-- Enable RLS on all tables
ALTER TABLE public.lottery_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_monthly_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lottery_games
CREATE POLICY "Super admins can manage all lottery games"
ON public.lottery_games FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR with full access can manage lottery games"
ON public.lottery_games FOR ALL
USING (
  public.has_role(auth.uid(), 'hr') AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.hr_access_level = 'full'
    AND (p.organization_id = lottery_games.organization_id OR p.organization_id IS NULL)
  )
);

CREATE POLICY "Managers can view and manage their branch lottery games"
ON public.lottery_games FOR ALL
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.branch_id = lottery_games.branch_id
  )
);

-- RLS Policies for lottery_daily_records
CREATE POLICY "Super admins can manage all lottery daily records"
ON public.lottery_daily_records FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR with full access can manage lottery daily records"
ON public.lottery_daily_records FOR ALL
USING (
  public.has_role(auth.uid(), 'hr') AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.hr_access_level = 'full'
  )
);

CREATE POLICY "Managers can manage their branch lottery daily records"
ON public.lottery_daily_records FOR ALL
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.branch_id = lottery_daily_records.branch_id
  )
);

-- RLS Policies for lottery_monthly_summaries
CREATE POLICY "Super admins can manage all lottery monthly summaries"
ON public.lottery_monthly_summaries FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR with full access can manage lottery monthly summaries"
ON public.lottery_monthly_summaries FOR ALL
USING (
  public.has_role(auth.uid(), 'hr') AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.hr_access_level = 'full'
  )
);

CREATE POLICY "Managers can manage their branch lottery monthly summaries"
ON public.lottery_monthly_summaries FOR ALL
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.branch_id = lottery_monthly_summaries.branch_id
  )
);

-- Create triggers for updated_at
CREATE TRIGGER update_lottery_games_updated_at
BEFORE UPDATE ON public.lottery_games
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lottery_daily_records_updated_at
BEFORE UPDATE ON public.lottery_daily_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lottery_monthly_summaries_updated_at
BEFORE UPDATE ON public.lottery_monthly_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();