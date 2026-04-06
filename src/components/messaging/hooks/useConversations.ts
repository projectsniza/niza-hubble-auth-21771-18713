import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Conversation, UserProfile } from '../types';

const ORG_CHAT_NAME = 'Organization Group Chat';

const isValidDisplayName = (name?: string | null) =>
  Boolean(name && name.trim() && name.trim().toLowerCase() !== 'unknown');

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Get all conversations where user is a participant
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (!participations?.length) {
        setConversations([]);
        return;
      }

      const conversationIds = participations.map(p => p.conversation_id);

      const { data: convos } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      // Get participants for each conversation
      const { data: allParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds);

      const participantUserIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];

      const { data: profiles } = await supabase
        .rpc('get_messaging_profiles', { p_user_ids: participantUserIds });

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', participantUserIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      // Get last message for each conversation
      const lastMessages = await Promise.all(
        conversationIds.map(async (convId) => {
          const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', convId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          return { convId, message: data };
        })
      );
      const lastMessageMap = new Map(lastMessages.map(m => [m.convId, m.message]));

      // Get unread counts
      const { data: participantData } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)
        .in('conversation_id', conversationIds);

      const readAtMap = new Map(participantData?.map(p => [p.conversation_id, p.last_read_at]) || []);

      const enrichedConvos: Conversation[] = (convos || [])
        .map(conv => {
          const participants = (allParticipants || [])
            .filter(p => p.conversation_id === conv.id)
            .map(p => {
              const profile = profileMap.get(p.user_id);
              if (!profile || !isValidDisplayName(profile.name)) {
                return null;
              }

              return {
                id: p.user_id,
                name: profile.name,
                email: profile.email || '',
                role: roleMap.get(p.user_id),
              } as UserProfile;
            })
            .filter((p): p is UserProfile => p !== null);

          const lastMessage = lastMessageMap.get(conv.id);
          const lastReadAt = readAtMap.get(conv.id);

          return {
            ...conv,
            participants,
            last_message: lastMessage
              ? {
                  ...lastMessage,
                  is_edited: lastMessage.is_edited ?? false,
                  is_deleted: lastMessage.is_deleted ?? false,
                  is_pinned: lastMessage.is_pinned ?? false,
                  pinned_by: lastMessage.pinned_by ?? null,
                  pinned_at: lastMessage.pinned_at ?? null,
                  reply_to_id: lastMessage.reply_to_id ?? null,
                  attachments: lastMessage.attachments as unknown as null,
                }
              : undefined,
            unread_count:
              lastMessage && lastReadAt && new Date(lastMessage.created_at) > new Date(lastReadAt) ? 1 : 0,
          };
        })
        .filter(conv => {
          if (conv.is_group) return true;
          return conv.participants?.some(p => p.id !== user?.id && isValidDisplayName(p.name)) ?? false;
        });

      setConversations(enrichedConvos);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const initializeOrgChat = useCallback(async () => {
    if (!user?.id) return null;

    try {
      // Check for existing org-wide conversation - use limit(1) to handle duplicates
      const { data: existingConvos } = await supabase
        .from('conversations')
        .select('id')
        .eq('name', ORG_CHAT_NAME)
        .eq('is_group', true)
        .order('created_at', { ascending: true })
        .limit(1);

      let conversationId: string;

      if (existingConvos && existingConvos.length > 0) {
        conversationId = existingConvos[0].id;
      } else {
        // Create new org-wide conversation
        const { data: newConvo, error } = await supabase
          .from('conversations')
          .insert({
            name: ORG_CHAT_NAME,
            is_group: true,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        conversationId = newConvo.id;
      }

      // Ensure current user is a participant (most important)
      const { data: myParticipation } = await supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!myParticipation) {
        await supabase.from('conversation_participants').insert({
          conversation_id: conversationId,
          user_id: user.id,
        });
      }

      // Sync all users with credentials to the org chat (background)
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id')
        .not('name', 'is', null);

      if (allProfiles && allProfiles.length > 0) {
        const { data: existingParticipants } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conversationId);

        const existingUserIds = new Set(existingParticipants?.map(p => p.user_id) || []);

        const newParticipants = allProfiles
          .filter(p => !existingUserIds.has(p.id))
          .map(p => ({
            conversation_id: conversationId,
            user_id: p.id,
          }));

        if (newParticipants.length > 0) {
          await supabase.from('conversation_participants').insert(newParticipants);
        }
      }

      return conversationId;
    } catch (error) {
      console.error('Error initializing org chat:', error);
      return null;
    }
  }, [user?.id]);

  const createDirectMessage = useCallback(async (targetUserId: string): Promise<string | null> => {
    if (!user?.id) return null;

    try {
      // Check if a DM already exists between these two users
      const { data: myConvos } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      const { data: theirConvos } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', targetUserId);

      const myConvoIds = new Set(myConvos?.map(c => c.conversation_id) || []);
      const sharedConvoIds = (theirConvos || [])
        .filter(c => myConvoIds.has(c.conversation_id))
        .map(c => c.conversation_id);

      // Check if any of these is a DM (not group)
      if (sharedConvoIds.length > 0) {
        const { data: existingDm } = await supabase
          .from('conversations')
          .select('id')
          .in('id', sharedConvoIds)
          .eq('is_group', false)
          .maybeSingle();

        if (existingDm) {
          return existingDm.id;
        }
      }

      // Create new DM
      const { data: newConvo, error } = await supabase
        .from('conversations')
        .insert({
          is_group: false,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add both users as participants
      await supabase.from('conversation_participants').insert([
        { conversation_id: newConvo.id, user_id: user.id },
        { conversation_id: newConvo.id, user_id: targetUserId },
      ]);

      await fetchConversations();
      return newConvo.id;
    } catch (error) {
      console.error('Error creating DM:', error);
      return null;
    }
  }, [user?.id, fetchConversations]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const deleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      // Get the conversation to check if it's the org chat
      const { data: conv } = await supabase
        .from('conversations')
        .select('name, is_group, created_by')
        .eq('id', conversationId)
        .single();

      // Don't allow deleting org chat
      if (conv?.name === ORG_CHAT_NAME) {
        return false;
      }

      // For DMs, just remove self from participants (soft delete for user)
      // Delete all messages in the conversation first
      await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      // Delete participants
      await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId);

      // Delete the conversation itself
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      await fetchConversations();
      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }
  }, [user?.id, fetchConversations]);

  return {
    conversations,
    loading,
    fetchConversations,
    initializeOrgChat,
    createDirectMessage,
    deleteConversation,
  };
}
