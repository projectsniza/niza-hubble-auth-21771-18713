-- ============================================
-- MESSAGING PREMIUM UPGRADE: DMs, Threads, Pinning, Mentions
-- ============================================

-- 1. Add reply/thread support to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- Create index for replies (threading)
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Create index for pinned messages
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON public.messages(is_pinned, conversation_id) WHERE is_pinned = true;

-- 2. Add mentions table
CREATE TABLE IF NOT EXISTS public.message_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, mentioned_user_id)
);

-- Enable RLS on mentions
ALTER TABLE public.message_mentions ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see their own mentions
CREATE POLICY "Users can view their own mentions" ON public.message_mentions
  FOR SELECT USING (mentioned_user_id = auth.uid());

-- RLS: Users can insert mentions for messages they send
CREATE POLICY "Users can create mentions" ON public.message_mentions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND m.sender_id = auth.uid()
    )
  );

-- RLS: Users can update their own mentions (mark as read)
CREATE POLICY "Users can update their own mentions" ON public.message_mentions
  FOR UPDATE USING (mentioned_user_id = auth.uid());

-- 3. Typing indicators (using presence - ephemeral, no table needed)
-- Will use Supabase Realtime Presence API

-- 4. User presence status table
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  last_seen TIMESTAMPTZ DEFAULT now(),
  is_typing_in UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on presence
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can view presence
CREATE POLICY "Authenticated users can view presence" ON public.user_presence
  FOR SELECT TO authenticated USING (true);

-- RLS: Users can update their own presence
CREATE POLICY "Users can update their own presence" ON public.user_presence
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. Add indexes for search
CREATE INDEX IF NOT EXISTS idx_messages_content_search ON public.messages USING gin(to_tsvector('english', COALESCE(content, '')));

-- 6. Realtime - add new tables if not already in publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'message_mentions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_mentions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_presence') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  END IF;
END $$;