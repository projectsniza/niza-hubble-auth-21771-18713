-- Clean up duplicate org chats: keep only the one with most participants
-- First, find the best org chat (most participants)
WITH ranked_chats AS (
  SELECT c.id, COUNT(cp.id) as pcount,
    ROW_NUMBER() OVER (ORDER BY COUNT(cp.id) DESC) as rn
  FROM conversations c
  LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
  WHERE c.name = 'Organization Group Chat' AND c.is_group = true
  GROUP BY c.id
),
keep_id AS (
  SELECT id FROM ranked_chats WHERE rn = 1
),
delete_ids AS (
  SELECT id FROM ranked_chats WHERE rn > 1
)
-- Delete participants of duplicate chats
DELETE FROM conversation_participants 
WHERE conversation_id IN (SELECT id FROM delete_ids);

-- Now delete messages from duplicate chats
DELETE FROM messages 
WHERE conversation_id IN (
  SELECT c.id FROM conversations c
  WHERE c.name = 'Organization Group Chat' AND c.is_group = true
  AND c.id NOT IN (
    SELECT id FROM (
      SELECT c2.id, COUNT(cp.id) as pcount,
        ROW_NUMBER() OVER (ORDER BY COUNT(cp.id) DESC) as rn
      FROM conversations c2
      LEFT JOIN conversation_participants cp ON c2.id = cp.conversation_id
      WHERE c2.name = 'Organization Group Chat' AND c2.is_group = true
      GROUP BY c2.id
    ) ranked WHERE rn = 1
  )
);

-- Delete the duplicate conversations themselves
DELETE FROM conversations
WHERE name = 'Organization Group Chat' AND is_group = true
AND id NOT IN (
  SELECT id FROM (
    SELECT c.id, COUNT(cp.id) as pcount,
      ROW_NUMBER() OVER (ORDER BY COUNT(cp.id) DESC) as rn
    FROM conversations c
    LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE c.name = 'Organization Group Chat' AND c.is_group = true
    GROUP BY c.id
  ) ranked WHERE rn = 1
);

-- Now add ALL profiles as participants to the remaining org chat
INSERT INTO conversation_participants (conversation_id, user_id)
SELECT 
  (SELECT id FROM conversations WHERE name = 'Organization Group Chat' AND is_group = true LIMIT 1),
  p.id
FROM profiles p
WHERE p.name IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM conversation_participants cp 
  WHERE cp.conversation_id = (SELECT id FROM conversations WHERE name = 'Organization Group Chat' AND is_group = true LIMIT 1)
  AND cp.user_id = p.id
);