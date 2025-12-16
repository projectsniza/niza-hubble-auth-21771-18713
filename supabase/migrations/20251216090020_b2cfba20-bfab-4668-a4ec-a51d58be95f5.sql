-- Add storage policies for training-documents bucket
DO $$
BEGIN
  -- Allow authenticated users to upload training documents
  INSERT INTO storage.policies (name, bucket_id, mode, definition)
  SELECT 
    'Authenticated users can upload training documents',
    'training-documents',
    'INSERT',
    '((auth.role() = ''authenticated''::text))'
  WHERE NOT EXISTS (
    SELECT 1 FROM storage.objects WHERE bucket_id = 'training-documents' LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN
  -- Policies might already exist or different structure
  NULL;
END $$;

-- Create storage policies using the standard approach
CREATE POLICY "Authenticated users can upload training documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'training-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read training documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'training-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their training documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'training-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their training documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'training-documents' AND auth.role() = 'authenticated');