-- ============================================
-- MESSAGING SYSTEM TABLES
-- ============================================

-- Message settings table for Super Admin configuration
CREATE TABLE public.message_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default message settings
INSERT INTO public.message_settings (setting_key, setting_value, description) VALUES
  ('employee_messaging_enabled', 'true', 'Allow employees to send and receive messages'),
  ('message_retention_days', '365', 'Number of days to retain messages (0 = forever)'),
  ('allow_file_attachments', 'true', 'Allow users to send file attachments'),
  ('max_attachment_size_mb', '10', 'Maximum file attachment size in MB'),
  ('allow_group_chats', 'true', 'Allow creation of group conversations'),
  ('read_receipts_enabled', 'true', 'Show read receipts for messages'),
  ('typing_indicators_enabled', 'true', 'Show typing indicators'),
  ('notification_sound_enabled', 'true', 'Enable notification sounds for new messages');

-- Conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, -- For group chats
  is_group BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation participants
CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  is_muted BOOLEAN DEFAULT false,
  UNIQUE(conversation_id, user_id)
);

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT,
  message_type TEXT DEFAULT 'text', -- text, image, file, system
  attachments JSONB,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Message read receipts
CREATE TABLE public.message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX idx_conversation_participants_conversation ON public.conversation_participants(conversation_id);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE public.message_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Message Settings: Super Admin full access, others can read
CREATE POLICY "Super admins can manage message settings"
ON public.message_settings FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Authenticated users can view message settings"
ON public.message_settings FOR SELECT
TO authenticated
USING (true);

-- Conversations: Users can see conversations they're part of
CREATE POLICY "Users can view their conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
  id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Conversation creators can update"
ON public.conversations FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Conversation Participants
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants FOR SELECT
TO authenticated
USING (
  conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "Users can add participants to conversations they created"
ON public.conversation_participants FOR INSERT
TO authenticated
WITH CHECK (
  conversation_id IN (SELECT id FROM public.conversations WHERE created_by = auth.uid())
  OR user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "Users can update their own participation"
ON public.conversation_participants FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can leave conversations"
ON public.conversation_participants FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Messages
CREATE POLICY "Users can view messages in their conversations"
ON public.messages FOR SELECT
TO authenticated
USING (
  conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "Users can send messages to their conversations"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Users can edit their own messages"
ON public.messages FOR UPDATE
TO authenticated
USING (sender_id = auth.uid());

-- Message Read Receipts
CREATE POLICY "Users can view read receipts in their conversations"
ON public.message_read_receipts FOR SELECT
TO authenticated
USING (
  message_id IN (
    SELECT m.id FROM public.messages m
    JOIN public.conversation_participants cp ON m.conversation_id = cp.conversation_id
    WHERE cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can mark messages as read"
ON public.message_read_receipts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;
ALTER TABLE public.message_read_receipts REPLICA IDENTITY FULL;

-- Add tables to realtime publication if not already added
DO $$
BEGIN
  -- Check if tables are already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  END IF;
END $$;

-- ============================================
-- UPDATE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_conversation_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_timestamp();