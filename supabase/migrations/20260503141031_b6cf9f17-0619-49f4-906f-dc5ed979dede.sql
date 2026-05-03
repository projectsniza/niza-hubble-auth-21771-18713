CREATE TABLE public.template_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.template_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view template types"
  ON public.template_types FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Super admins can insert template types"
  ON public.template_types FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update template types"
  ON public.template_types FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete template types"
  ON public.template_types FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_template_types_updated_at
BEFORE UPDATE ON public.template_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.template_types (value, label, sort_order) VALUES
  ('general', 'General', 10),
  ('id_card', 'ID Card', 20),
  ('business_card', 'Business Card', 30),
  ('invoice', 'Invoice', 40),
  ('letter', 'Letter', 50)
ON CONFLICT (value) DO NOTHING;