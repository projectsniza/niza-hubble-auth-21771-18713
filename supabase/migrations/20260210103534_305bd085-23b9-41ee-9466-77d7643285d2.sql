
-- Add supporting_files column to drive_offs table
ALTER TABLE public.drive_offs ADD COLUMN IF NOT EXISTS supporting_files jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for drive-off files
INSERT INTO storage.buckets (id, name, public) VALUES ('drive-off-files', 'drive-off-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for drive-off files
CREATE POLICY "Authenticated users can upload drive-off files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'drive-off-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view drive-off files"
ON storage.objects FOR SELECT
USING (bucket_id = 'drive-off-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete drive-off files"
ON storage.objects FOR DELETE
USING (bucket_id = 'drive-off-files' AND auth.role() = 'authenticated');
