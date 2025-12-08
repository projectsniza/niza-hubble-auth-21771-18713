-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for documents bucket
CREATE POLICY "Super admins can manage all documents" ON storage.objects
FOR ALL USING (
  bucket_id = 'documents' AND 
  public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "HR can manage documents in their scope" ON storage.objects
FOR ALL USING (
  bucket_id = 'documents' AND 
  public.has_role(auth.uid(), 'hr')
);

CREATE POLICY "Managers can upload documents for their branch" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND 
  public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Managers can view documents in their branch" ON storage.objects
FOR SELECT USING (
  bucket_id = 'documents' AND 
  public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Employees can view their own documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'documents' AND 
  public.has_role(auth.uid(), 'employee') AND
  (storage.foldername(name))[1] = 'employees' AND
  (storage.foldername(name))[2] = auth.uid()::text
);