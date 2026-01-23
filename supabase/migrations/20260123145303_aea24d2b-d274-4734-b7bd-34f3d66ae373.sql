-- Create table for custom payroll categories
CREATE TABLE public.payroll_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_type TEXT NOT NULL CHECK (category_type IN ('addition', 'deduction')),
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payroll_categories ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All authenticated users can view payroll categories" 
ON public.payroll_categories 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins and HR can manage payroll categories" 
ON public.payroll_categories 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_role(auth.uid(), 'hr')
);

-- Create table for monthly payroll items (custom additions/deductions per employee per month)
CREATE TABLE public.payroll_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_record_id UUID REFERENCES public.payroll_records(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  category_id UUID REFERENCES public.payroll_categories(id) ON DELETE CASCADE,
  amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Employees can view their own payroll items" 
ON public.payroll_items 
FOR SELECT 
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Super admins and HR can manage all payroll items" 
ON public.payroll_items 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_role(auth.uid(), 'hr')
);

-- Insert default categories
INSERT INTO public.payroll_categories (name, category_type, is_default, description) VALUES
('HRA', 'addition', true, 'House Rent Allowance'),
('Travel Allowance', 'addition', true, 'Travel and Transport Allowance'),
('Bonus', 'addition', true, 'Performance or Festival Bonus'),
('Overtime', 'addition', true, 'Overtime Pay'),
('Other Allowance', 'addition', true, 'Other Miscellaneous Allowance'),
('Salary Advance', 'deduction', true, 'Advance Salary Deduction'),
('Late Fine', 'deduction', true, 'Late Attendance Fine'),
('Unpaid Leave', 'deduction', true, 'Unpaid Leave Deduction'),
('Tax', 'deduction', true, 'Income Tax Deduction'),
('Other Deduction', 'deduction', true, 'Other Miscellaneous Deduction');

-- Add trigger for updated_at
CREATE TRIGGER update_payroll_categories_updated_at
BEFORE UPDATE ON public.payroll_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_items_updated_at
BEFORE UPDATE ON public.payroll_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();