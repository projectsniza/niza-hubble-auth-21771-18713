-- Create drive_offs table with all fields from the templates
CREATE TABLE public.drive_offs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  
  -- Core incident details
  drive_off_date DATE NOT NULL,
  vehicle_registration TEXT NOT NULL,
  vehicle_model TEXT,
  fuel_type TEXT NOT NULL,
  pump_number INTEGER NOT NULL,
  cashier_name TEXT NOT NULL,
  total_liters NUMERIC(10,2) NOT NULL,
  amount_drive_off NUMERIC(10,2) NOT NULL,
  
  -- Till breakdown (up to 5 tills)
  till_1_amount NUMERIC(10,2) DEFAULT 0,
  till_2_amount NUMERIC(10,2) DEFAULT 0,
  till_3_amount NUMERIC(10,2) DEFAULT 0,
  till_4_amount NUMERIC(10,2) DEFAULT 0,
  till_5_amount NUMERIC(10,2) DEFAULT 0,
  
  -- Payment tracking
  total_amount_received NUMERIC(10,2) DEFAULT 0,
  payment_received_date DATE,
  payment_till_1 NUMERIC(10,2) DEFAULT 0,
  payment_till_2 NUMERIC(10,2) DEFAULT 0,
  
  -- Tracking status: 'fuel_guardian', 'police_complaint', 'payment'
  tracking_status TEXT,
  tracking_reference TEXT,
  date_handed_to_guardian DATE,
  
  -- Head office notes
  head_office_notes TEXT,
  
  -- General remarks
  remarks TEXT,
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drive_offs ENABLE ROW LEVEL SECURITY;

-- Policies for drive_offs
CREATE POLICY "Super admins can manage all drive offs"
ON public.drive_offs
FOR ALL
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "HR can manage drive offs in their org/branch"
ON public.drive_offs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'hr'
    AND (
      p.hr_access_level = 'organization' AND p.organization_id = drive_offs.organization_id
      OR p.hr_access_level = 'branch' AND p.branch_id = drive_offs.branch_id
    )
  )
);

CREATE POLICY "Managers can manage drive offs in their branch"
ON public.drive_offs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'manager'
    AND p.branch_id = drive_offs.branch_id
  )
);

-- Create updated_at trigger
CREATE TRIGGER update_drive_offs_updated_at
BEFORE UPDATE ON public.drive_offs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for common queries
CREATE INDEX idx_drive_offs_branch_date ON public.drive_offs(branch_id, drive_off_date);
CREATE INDEX idx_drive_offs_org_date ON public.drive_offs(organization_id, drive_off_date);