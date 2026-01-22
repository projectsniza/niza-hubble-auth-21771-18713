-- Add DELETE policy for super_admins on safety_tasks
-- The existing 'Super admins have full access to safety_tasks' uses cmd:ALL which should cover DELETE
-- but let's verify by checking if we need explicit DELETE permissions

-- HR should be able to delete tasks in their scope
-- Managers should be able to delete tasks in their branch

-- The ALL policies should already cover DELETE, but let's ensure they work
-- No additional migration needed as ALL includes DELETE