-- First update the folders to not be system folders
UPDATE folders SET is_system = false, is_deletable = true 
WHERE name = 'Safety Documents' AND parent_id IS NULL AND is_system = true;

-- Update any child folders to have no parent
UPDATE folders SET parent_id = NULL, show_in_safety = true WHERE parent_id IN (
  SELECT id FROM folders WHERE name = 'Safety Documents' AND parent_id IS NULL
);

-- Now delete all the Safety Documents root folders  
DELETE FROM folders WHERE name = 'Safety Documents' AND parent_id IS NULL;