
ALTER TABLE public.custom_roles
  ADD COLUMN IF NOT EXISTS branch_ids uuid[] NOT NULL DEFAULT '{}';

-- Backfill: if a legacy single branch_id is set, mirror into branch_ids
UPDATE public.custom_roles
SET branch_ids = ARRAY[branch_id]
WHERE branch_id IS NOT NULL
  AND (branch_ids IS NULL OR array_length(branch_ids, 1) IS NULL);

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS vending_split_mode text NOT NULL DEFAULT 'culverstone';

-- Sanity constraint on allowed values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'branches_vending_split_mode_check'
  ) THEN
    ALTER TABLE public.branches
      ADD CONSTRAINT branches_vending_split_mode_check
      CHECK (vending_split_mode IN ('culverstone','houndsmills'));
  END IF;
END $$;
