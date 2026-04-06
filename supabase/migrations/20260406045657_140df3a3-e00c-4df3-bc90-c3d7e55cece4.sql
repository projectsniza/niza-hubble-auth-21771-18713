
CREATE OR REPLACE FUNCTION public.get_messaging_profiles(p_user_ids uuid[])
RETURNS TABLE(id uuid, name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.email
  FROM profiles p
  WHERE p.id = ANY(p_user_ids)
  AND (
    p.id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM conversation_participants cp1
      JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = auth.uid()
      AND cp2.user_id = p.id
    )
  );
$$;
