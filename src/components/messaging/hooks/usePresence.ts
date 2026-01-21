import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { UserPresence } from '../types';

export function usePresence(conversationId: string | null) {
  const { user } = useAuth();
  const [presence, setPresence] = useState<Map<string, UserPresence>>(new Map());
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Update own presence
  const updatePresence = useCallback(
    async (status: 'online' | 'away' | 'busy' | 'offline') => {
      if (!user?.id) return;

      try {
        await supabase.from('user_presence').upsert(
          {
            user_id: user.id,
            status,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    },
    [user?.id]
  );

  // Set typing status
  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (!user?.id || !conversationId) return;

      try {
        await supabase.from('user_presence').upsert(
          {
            user_id: user.id,
            is_typing_in: isTyping ? conversationId : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        // Clear typing after 3 seconds if still typing
        if (isTyping) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setTyping(false);
          }, 3000);
        }
      } catch (error) {
        console.error('Error setting typing:', error);
      }
    },
    [user?.id, conversationId]
  );

  // Fetch presence for all users in conversation
  const fetchPresence = useCallback(async () => {
    if (!conversationId) return;

    try {
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (!participants?.length) return;

      const userIds = participants.map(p => p.user_id);

      const { data: presenceData } = await supabase
        .from('user_presence')
        .select('*')
        .in('user_id', userIds);

      const presenceMap = new Map<string, UserPresence>();
      (presenceData || []).forEach(p => {
        presenceMap.set(p.user_id, {
          user_id: p.user_id,
          status: p.status as 'online' | 'away' | 'busy' | 'offline',
          last_seen: p.last_seen,
          is_typing_in: p.is_typing_in,
        });
      });

      setPresence(presenceMap);

      // Set typing users
      const typing = (presenceData || [])
        .filter(p => p.is_typing_in === conversationId && p.user_id !== user?.id)
        .map(p => p.user_id);

      setTypingUsers(typing);
    } catch (error) {
      console.error('Error fetching presence:', error);
    }
  }, [conversationId, user?.id]);

  // Set online when component mounts
  useEffect(() => {
    updatePresence('online');

    // Set offline when tab is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        updatePresence('away');
      } else {
        updatePresence('online');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Set offline on unmount
    return () => {
      updatePresence('offline');
      document.removeEventListener('visibilitychange', handleVisibility);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [updatePresence]);

  // Subscribe to presence changes
  useEffect(() => {
    if (!conversationId) return;

    fetchPresence();

    channelRef.current = supabase
      .channel(`presence-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        () => {
          fetchPresence();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, fetchPresence]);

  return {
    presence,
    typingUsers,
    updatePresence,
    setTyping,
    fetchPresence,
  };
}
