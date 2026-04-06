import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import ConversationList from './ConversationList';
import ChatArea from './ChatArea';
import NewConversationDialog from './NewConversationDialog';
import { useConversations } from './hooks/useConversations';
import { useMessages } from './hooks/useMessages';
import { usePresence } from './hooks/usePresence';
import type { Conversation, UserProfile } from './types';

export default function MessagingPanel() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [participants, setParticipants] = useState<UserProfile[]>([]);

  const { conversations, loading: convoLoading, fetchConversations, initializeOrgChat, createDirectMessage, deleteConversation } =
    useConversations();

  const { messages, pinnedMessages, loading: msgLoading, sending, sendMessage, togglePin } =
    useMessages(selectedConversationId);

  const { typingUsers, setTyping } = usePresence(selectedConversationId);

  const isEmployee = user?.role === 'employee';
  const canUseMessaging = !isEmployee || settings['employee_messaging_enabled'] === 'true';

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase.from('message_settings').select('*');
        if (error) {
          console.error('Error fetching settings:', error);
          setSettings({ employee_messaging_enabled: 'false' });
        } else {
          const settingsMap: Record<string, string> = {};
          data?.forEach(s => {
            settingsMap[s.setting_key] =
              typeof s.setting_value === 'string'
                ? s.setting_value
                : JSON.stringify(s.setting_value).replace(/"/g, '');
          });
          setSettings(settingsMap);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        setSettings({ employee_messaging_enabled: 'false' });
      } finally {
        setSettingsLoaded(true);
      }
    };

    if (user) {
      fetchSettings();
    }
  }, [user]);

  // Initialize org chat and select it by default
  useEffect(() => {
    const init = async () => {
      if (settingsLoaded && canUseMessaging && user) {
        const orgChatId = await initializeOrgChat();
        if (orgChatId && !selectedConversationId) {
          setSelectedConversationId(orgChatId);
        }
        await fetchConversations();
      }
    };
    init();
  }, [settingsLoaded, canUseMessaging, user, initializeOrgChat, fetchConversations, selectedConversationId]);

  // Fetch participants for selected conversation
  useEffect(() => {
    const fetchParticipants = async () => {
      if (!selectedConversationId) return;

      try {
        const { data: participantData } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', selectedConversationId);

        const userIds = participantData?.map(p => p.user_id) || [];

        const { data: profiles } = await supabase
          .rpc('get_messaging_profiles', { p_user_ids: userIds });

        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);

        const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

        const enrichedParticipants: UserProfile[] = (profiles || []).map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          role: roleMap.get(p.id),
        }));

        setParticipants(enrichedParticipants);
      } catch (error) {
        console.error('Error fetching participants:', error);
      }
    };

    fetchParticipants();
  }, [selectedConversationId]);

  const handleSendMessage = useCallback(
    async (content: string, attachments: any[] = [], replyToId?: string, mentions?: string[]) => {
      const result = await sendMessage(content, attachments, replyToId, mentions);
      if (result) {
        // Fire and forget - don't block input clearing
        fetchConversations();
      }
      return result;
    },
    [sendMessage, fetchConversations]
  );

  const handleCreateDM = useCallback(
    async (targetUserId: string) => {
      const conversationId = await createDirectMessage(targetUserId);
      if (conversationId) {
        setSelectedConversationId(conversationId);
        toast.success('Conversation started');
      }
      return conversationId;
    },
    [createDirectMessage]
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      const result = await deleteConversation(conversationId);
      if (result) {
        if (selectedConversationId === conversationId) {
          setSelectedConversationId(null);
        }
        toast.success('Conversation deleted');
      }
      return result;
    },
    [deleteConversation, selectedConversationId]
  );

  const selectedConversation: Conversation | null =
    conversations.find(c => c.id === selectedConversationId) || null;

  if (!settingsLoaded) {
    return (
      <Card className="h-[calc(100vh-12rem)] flex items-center justify-center">
        <NizaLoaderInline />
      </Card>
    );
  }

  if (!canUseMessaging) {
    return (
      <Card className="h-[calc(100vh-12rem)] flex items-center justify-center p-8">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Messaging Disabled</h3>
          <p className="text-muted-foreground">
            Messaging is currently disabled for employees. Please contact your administrator.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="h-[calc(100vh-12rem)] flex border rounded-xl overflow-hidden bg-card shadow-sm">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          onNewDM={() => setNewDmOpen(true)}
          onDeleteConversation={handleDeleteConversation}
          loading={convoLoading}
        />

        <ChatArea
          conversation={selectedConversation}
          messages={messages}
          pinnedMessages={pinnedMessages}
          loading={msgLoading}
          sending={sending}
          typingUsers={typingUsers}
          participants={participants}
          onSendMessage={handleSendMessage}
          onTogglePin={togglePin}
          settings={settings}
        />
      </div>

      <NewConversationDialog
        open={newDmOpen}
        onOpenChange={setNewDmOpen}
        onCreateDM={handleCreateDM}
      />
    </>
  );
}
