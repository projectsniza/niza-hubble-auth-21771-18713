-- ============================================
-- FIX INFINITE RECURSION IN MESSAGING RLS
-- ============================================

-- Create security definer function to check if user is in a conversation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE user_id = _user_id
      AND conversation_id = _conversation_id
  )
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can insert participants when creating conversation" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can read receipts in their conversations" ON public.message_read_receipts;
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.message_read_receipts;

-- Create new non-recursive policies for conversations
CREATE POLICY "Users can view their conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR
  id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
);

-- Create new non-recursive policies for conversation_participants
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  public.is_conversation_participant(auth.uid(), conversation_id)
);

CREATE POLICY "Users can insert participants when creating conversation"
ON public.conversation_participants FOR INSERT
TO authenticated
WITH CHECK (
  -- User can add themselves
  user_id = auth.uid() OR
  -- Or user is creating the conversation (check via conversations table)
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  )
);

-- Create new non-recursive policies for messages
CREATE POLICY "Users can view messages in their conversations"
ON public.messages FOR SELECT
TO authenticated
USING (
  public.is_conversation_participant(auth.uid(), conversation_id)
);

CREATE POLICY "Users can send messages to their conversations"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  public.is_conversation_participant(auth.uid(), conversation_id)
);

-- Create new non-recursive policies for message_read_receipts
CREATE POLICY "Users can read receipts in their conversations"
ON public.message_read_receipts FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  public.is_conversation_participant(auth.uid(), (SELECT conversation_id FROM public.messages WHERE id = message_id))
);

CREATE POLICY "Users can mark messages as read"
ON public.message_read_receipts FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  public.is_conversation_participant(auth.uid(), (SELECT conversation_id FROM public.messages WHERE id = message_id))
);

-- ============================================
-- CUSTOM ROLES SYSTEM
-- ============================================

-- Create custom roles table
CREATE TABLE public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  -- Base role type this custom role is based on
  base_role TEXT NOT NULL CHECK (base_role IN ('manager', 'hr', 'employee')),
  -- For manager/hr roles, which org/branch they have access to
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  -- Feature permissions
  permissions JSONB NOT NULL DEFAULT '{}',
  -- Extra app access
  app_access JSONB NOT NULL DEFAULT '{"niza_safe": false, "niza_finance": false, "niza_templates": false}',
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_custom_roles assignment table
CREATE TABLE public.user_custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, custom_role_id)
);

-- Create indexes
CREATE INDEX idx_custom_roles_base_role ON public.custom_roles(base_role);
CREATE INDEX idx_custom_roles_org ON public.custom_roles(organization_id);
CREATE INDEX idx_custom_roles_branch ON public.custom_roles(branch_id);
CREATE INDEX idx_user_custom_roles_user ON public.user_custom_roles(user_id);
CREATE INDEX idx_user_custom_roles_role ON public.user_custom_roles(custom_role_id);

-- Enable RLS
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_roles
CREATE POLICY "Super admins can manage custom roles"
ON public.custom_roles FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Authenticated users can view active custom roles"
ON public.custom_roles FOR SELECT
TO authenticated
USING (is_active = true);

-- RLS Policies for user_custom_roles
CREATE POLICY "Super admins can manage user custom role assignments"
ON public.user_custom_roles FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Users can view their own custom role assignments"
ON public.user_custom_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_custom_roles_updated_at
BEFORE UPDATE ON public.custom_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();