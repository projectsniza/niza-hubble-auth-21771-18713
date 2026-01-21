-- Fix the admin policy using user_roles table
CREATE POLICY "Admins can view all leave documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'leave-documents' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'hr', 'manager')
  )
);