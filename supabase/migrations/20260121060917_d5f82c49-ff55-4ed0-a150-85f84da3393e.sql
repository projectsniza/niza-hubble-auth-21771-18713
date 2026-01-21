-- Employee Payroll Notes table for Holiday REF 'ANNUM / PER HOUR' + 'NOTES' columns
CREATE TABLE public.employee_payroll_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month_date DATE NOT NULL, -- The month this note applies to (e.g., 2025-04-01 for April 2025)
  annum_per_hour TEXT, -- e.g., '£27,500.00' or '£12.50'
  notes TEXT, -- e.g., 'Please add Management Allowance of £602.36'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(employee_id, month_date)
);

-- Enable RLS
ALTER TABLE public.employee_payroll_notes ENABLE ROW LEVEL SECURITY;

-- Policies for employee_payroll_notes
CREATE POLICY "Super admins can manage all payroll notes" 
ON public.employee_payroll_notes 
FOR ALL 
USING (true);

-- Add trigger for timestamps
CREATE TRIGGER update_employee_payroll_notes_updated_at
BEFORE UPDATE ON public.employee_payroll_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();