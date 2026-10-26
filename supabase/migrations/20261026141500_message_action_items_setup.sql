-- Migration: message_action_items table and policies
-- Supports raising Action Items between Stores and Super Admin / HR

CREATE TABLE IF NOT EXISTS public.message_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  raised_by UUID NOT NULL,
  assigned_to UUID NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  module_key TEXT NOT NULL DEFAULT 'general',
  module_label TEXT NOT NULL DEFAULT 'General',
  module_route TEXT NOT NULL DEFAULT '/dashboard',
  reference_date TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  acknowledged_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  completion_note TEXT,
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_action_items_assigned ON public.message_action_items(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_message_action_items_raised ON public.message_action_items(raised_by);
CREATE INDEX IF NOT EXISTS idx_message_action_items_convo ON public.message_action_items(conversation_id);

-- Enable RLS
ALTER TABLE public.message_action_items ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'message_action_items' AND policyname = 'Authenticated users can select action items'
  ) THEN
    CREATE POLICY "Authenticated users can select action items"
      ON public.message_action_items FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'message_action_items' AND policyname = 'Authenticated users can insert action items'
  ) THEN
    CREATE POLICY "Authenticated users can insert action items"
      ON public.message_action_items FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'message_action_items' AND policyname = 'Authenticated users can update action items'
  ) THEN
    CREATE POLICY "Authenticated users can update action items"
      ON public.message_action_items FOR UPDATE
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Enable Realtime for message_action_items safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_action_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_action_items;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignore if publication alteration is restricted
END $$;
