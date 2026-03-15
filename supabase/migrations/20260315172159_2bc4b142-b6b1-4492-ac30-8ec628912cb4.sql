
ALTER TABLE courses ADD COLUMN IF NOT EXISTS difficulty_level text DEFAULT 'beginner';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS xp_reward integer DEFAULT 100;
