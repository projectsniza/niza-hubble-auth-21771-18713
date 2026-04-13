import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Message, Attachment, UserProfile } from '../types';

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      const senderIds = [...new Set(msgs?.map(m => m.sender_id) || [])];

      // Parallel fetch profiles, roles, and reply messages
      const replyIds = msgs?.filter(m => m.reply_to_id).map(m => m.reply_to_id) || [];

      const [profilesResult, rolesResult, replyResult] = await Promise.all([
        supabase.rpc('get_messaging_profiles', { p_user_ids: senderIds }),
        supabase.from('user_roles').select('user_id, role').in('user_id', senderIds),
        replyIds.length > 0
          ? supabase.from('messages').select('*').in('id', replyIds as string[])
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileMap = new Map(profilesResult.data?.map(p => [p.id, p]) || []);
      const roleMap = new Map(rolesResult.data?.map(r => [r.user_id, r.role]) || []);

      const replyMap = new Map(
        (replyResult.data || []).map(m => [
          m.id,
          {
            ...m,
            is_edited: m.is_edited ?? false,
            is_deleted: m.is_deleted ?? false,
            is_pinned: m.is_pinned ?? false,
            pinned_by: m.pinned_by ?? null,
            pinned_at: m.pinned_at ?? null,
            reply_to_id: m.reply_to_id ?? null,
            attachments: m.attachments as unknown as Attachment[] | null,
            sender: {
              id: m.sender_id,
              ...profileMap.get(m.sender_id),
              role: roleMap.get(m.sender_id),
            } as UserProfile,
          },
        ])
      );

      const enrichedMsgs: Message[] = (msgs || []).map(m => ({
        ...m,
        is_edited: m.is_edited ?? false,
        is_deleted: m.is_deleted ?? false,
        is_pinned: m.is_pinned ?? false,
        pinned_by: m.pinned_by ?? null,
        pinned_at: m.pinned_at ?? null,
        reply_to_id: m.reply_to_id ?? null,
        attachments: m.attachments as unknown as Attachment[] | null,
        sender: {
          id: m.sender_id,
          ...profileMap.get(m.sender_id),
          role: roleMap.get(m.sender_id),
        } as UserProfile,
        reply_to: m.reply_to_id ? replyMap.get(m.reply_to_id) : null,
      }));

      setMessages(enrichedMsgs);
      setPinnedMessages(enrichedMsgs.filter(m => m.is_pinned));

      // Mark as read (fire and forget)
      supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user?.id)
        .then(() => {});
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user?.id]);

  const sendMessage = useCallback(
    async (
      content: string,
      attachments: Attachment[] = [],
      replyToId?: string,
      mentionedUserIds: string[] = []
    ) => {
      if (!conversationId || !user?.id) return false;

      setSending(true);
      try {
        const messageType =
          attachments.length > 0
            ? attachments.some(a => a.type.startsWith('image/'))
              ? 'image'
              : 'file'
            : 'text';

        const { data: newMessage, error } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: content.trim() || null,
            message_type: messageType,
            attachments: attachments.length > 0 ? (attachments as unknown as any) : null,
            reply_to_id: replyToId || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Insert mentions
        if (mentionedUserIds.length > 0 && newMessage) {
          await supabase.from('message_mentions').insert(
            mentionedUserIds.map(uid => ({
              message_id: newMessage.id,
              mentioned_user_id: uid,
            }))
          );
        }

        // Update conversation updated_at
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);

        return true;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to send message';
        toast.error(msg);
        return false;
      } finally {
        setSending(false);
      }
    },
    [conversationId, user?.id]
  );

  const togglePin = useCallback(
    async (messageId: string, pinned: boolean) => {
      if (!user?.id) return;

      try {
        const { error } = await supabase
          .from('messages')
          .update({
            is_pinned: pinned,
            pinned_by: pinned ? user.id : null,
            pinned_at: pinned ? new Date().toISOString() : null,
          })
          .eq('id', messageId);

        if (error) throw error;

        toast.success(pinned ? 'Message pinned' : 'Message unpinned');
        fetchMessages();
      } catch (error) {
        toast.error('Failed to update pin');
      }
    },
    [user?.id, fetchMessages]
  );

  const searchMessages = useCallback(
    async (query: string): Promise<Message[]> => {
      if (!conversationId || !query.trim()) return [];

      try {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('is_deleted', false)
          .ilike('content', `%${query}%`)
          .order('created_at', { ascending: false })
          .limit(50);

        return (data || []).map(m => ({
          ...m,
          is_edited: m.is_edited ?? false,
          is_deleted: m.is_deleted ?? false,
          is_pinned: m.is_pinned ?? false,
          pinned_by: m.pinned_by ?? null,
          pinned_at: m.pinned_at ?? null,
          reply_to_id: m.reply_to_id ?? null,
          attachments: m.attachments as unknown as Attachment[] | null,
        }));
      } catch (error) {
        console.error('Error searching messages:', error);
        return [];
      }
    },
    [conversationId]
  );

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    // Reset state immediately for snappy switching
    setMessages([]);
    setPinnedMessages([]);
    setLoading(true);

    fetchMessages();

    channelRef.current = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, fetchMessages]);

  return {
    messages,
    pinnedMessages,
    loading,
    sending,
    fetchMessages,
    sendMessage,
    togglePin,
    searchMessages,
  };
}
