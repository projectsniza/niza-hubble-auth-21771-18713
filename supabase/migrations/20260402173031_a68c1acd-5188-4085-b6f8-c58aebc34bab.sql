-- Activate all existing bulk uploaded employees (move to pending accounts)
-- This sets their status to 'active' so they appear in Pending Accounts instead of Bulk Uploads
UPDATE employees 
SET status = 'active', updated_at = now()
WHERE bulk_upload_id IS NOT NULL 
  AND status = 'pending';