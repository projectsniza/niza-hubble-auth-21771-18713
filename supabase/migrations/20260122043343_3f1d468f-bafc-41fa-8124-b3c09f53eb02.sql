-- Add storage policy to allow managers to upload to template-assets bucket
CREATE POLICY "Managers can manage template assets" 
ON storage.objects FOR ALL 
TO authenticated
USING (
  bucket_id = 'template-assets' 
  AND has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  bucket_id = 'template-assets' 
  AND has_role(auth.uid(), 'manager'::app_role)
);