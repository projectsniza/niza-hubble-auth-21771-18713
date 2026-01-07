import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  MessageSquare, Send, Search, Plus, Users, Check, CheckCheck, 
  MoreVertical, Phone, Video, Paperclip, Smile, X, ArrowLeft
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  updated_at: string;
  participants?: Participant[];
  lastMessage?: Message;
  unreadCount?: number;
}

interface Participant {
  id: string;
  user_id: string;
  last_read_at: string | null;
  profile?: {
    name: string;
    email: string;
  };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  created_at: string;
  is_edited: boolean;
  is_deleted: boolean;
  sender?: {
    name: string;
    email: string;
  };
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export default function MessagingPanel() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isMobileView, setIsMobileView] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isEmployee = user?.role === 'employee';
  const canUseMessaging = !isEmployee || settings['employee_messaging_enabled'] === 'true';

  useEffect(() => {
    fetchSettings();
    if (canUseMessaging) {
      fetchConversations();
      fetchAvailableUsers();
    }
  }, [user]);

  useEffect(() => {
    if (!selectedConversation) return;
    
    fetchMessages(selectedConversation.id);
    
    // Subscribe to new messages
    const channel = supabase
      .channel(`messages-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        },
        (payload) => {
          fetchMessages(selectedConversation.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('message_settings').select('*');
      const settingsMap: Record<string, string> = {};
      data?.forEach(s => {
        settingsMap[s.setting_key] = typeof s.setting_value === 'string' 
          ? s.setting_value 
          : JSON.stringify(s.setting_value).replace(/"/g, '');
      });
      setSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchConversations = async () => {
    setLoading(true);
    try {
      // Get all conversations where user is a participant
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user?.id);

      if (!participations?.length) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participations.map(p => p.conversation_id);

      const { data: convos } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      // Get participants and last messages for each conversation
      const enrichedConvos = await Promise.all((convos || []).map(async (convo) => {
        // Get participants
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('id, user_id, last_read_at')
          .eq('conversation_id', convo.id);

        // Get profiles for participants
        const userIds = participants?.map(p => p.user_id) || [];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        // Get last message
        const { data: lastMessages } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: false })
          .limit(1);

        return {
          ...convo,
          participants: participants?.map(p => ({
            ...p,
            profile: profileMap.get(p.user_id)
          })),
          lastMessage: lastMessages?.[0]
        };
      }));

      setConversations(enrichedConvos);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      // Get sender profiles
      const senderIds = [...new Set(msgs?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enrichedMsgs = (msgs || []).map(m => ({
        ...m,
        sender: profileMap.get(m.sender_id)
      }));

      setMessages(enrichedMsgs);

      // Mark messages as read
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user?.id);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email')
        .neq('id', user?.id)
        .order('name');

      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        sender_id: user?.id,
        content: newMessage.trim(),
        message_type: 'text'
      });

      if (error) throw error;

      setNewMessage('');
      fetchMessages(selectedConversation.id);
      fetchConversations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    try {
      const isGroup = selectedUsers.length > 1;
      
      // For 1:1 chats, check if conversation already exists
      if (!isGroup) {
        const existingConvo = conversations.find(c => 
          !c.is_group && 
          c.participants?.some(p => p.user_id === selectedUsers[0])
        );
        
        if (existingConvo) {
          setSelectedConversation(existingConvo);
          setShowNewChat(false);
          setSelectedUsers([]);
          return;
        }
      }

      // Create conversation
      const { data: convo, error: convoError } = await supabase
        .from('conversations')
        .insert({
          name: isGroup ? (groupName || 'Group Chat') : null,
          is_group: isGroup,
          created_by: user?.id
        })
        .select()
        .single();

      if (convoError) throw convoError;

      // Add participants (including self)
      const participants = [...selectedUsers, user?.id].map(userId => ({
        conversation_id: convo.id,
        user_id: userId
      }));

      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert(participants);

      if (participantsError) throw participantsError;

      toast.success('Conversation created');
      setShowNewChat(false);
      setSelectedUsers([]);
      setGroupName('');
      fetchConversations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create conversation');
    }
  };

  const getConversationName = (convo: Conversation) => {
    if (convo.is_group && convo.name) return convo.name;
    
    const otherParticipant = convo.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.profile?.name || 'Unknown User';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd/MM/yyyy');
  };

  const filteredConversations = conversations.filter(c => {
    const name = getConversationName(c).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  if (!canUseMessaging) {
    return (
      <Card className="h-full flex items-center justify-center p-8">
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
    <div className="h-[calc(100vh-12rem)] flex border rounded-lg overflow-hidden bg-card">
      {/* Conversations List */}
      <div className={`w-80 border-r flex flex-col ${selectedConversation && isMobileView ? 'hidden' : ''}`}>
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Messages</h3>
            <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Conversation</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {settings['allow_group_chats'] === 'true' && selectedUsers.length > 1 && (
                    <div>
                      <Label>Group Name (optional)</Label>
                      <Input
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Enter group name..."
                      />
                    </div>
                  )}
                  <div>
                    <Label>Select Users</Label>
                    <ScrollArea className="h-64 mt-2 border rounded-md p-2">
                      {availableUsers.map(u => (
                        <div key={u.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
                          <Checkbox
                            checked={selectedUsers.includes(u.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                if (settings['allow_group_chats'] !== 'true' && selectedUsers.length > 0) {
                                  setSelectedUsers([u.id]);
                                } else {
                                  setSelectedUsers([...selectedUsers, u.id]);
                                }
                              } else {
                                setSelectedUsers(selectedUsers.filter(id => id !== u.id));
                              }
                            }}
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{getInitials(u.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                  <Button onClick={handleCreateConversation} className="w-full">
                    Start Conversation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No conversations yet</p>
              <Button variant="link" onClick={() => setShowNewChat(true)}>
                Start a new chat
              </Button>
            </div>
          ) : (
            filteredConversations.map(convo => (
              <div
                key={convo.id}
                className={`p-3 cursor-pointer hover:bg-muted/50 border-b transition-colors ${
                  selectedConversation?.id === convo.id ? 'bg-muted' : ''
                }`}
                onClick={() => setSelectedConversation(convo)}
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {convo.is_group ? <Users className="h-4 w-4" /> : getInitials(getConversationName(convo))}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{getConversationName(convo)}</p>
                      {convo.lastMessage && (
                        <span className="text-xs text-muted-foreground">
                          {formatMessageTime(convo.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    {convo.lastMessage && (
                      <p className="text-sm text-muted-foreground truncate">
                        {convo.lastMessage.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setSelectedConversation(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar>
                  <AvatarFallback>
                    {selectedConversation.is_group ? <Users className="h-4 w-4" /> : getInitials(getConversationName(selectedConversation))}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{getConversationName(selectedConversation)}</p>
                  {selectedConversation.is_group && (
                    <p className="text-xs text-muted-foreground">
                      {selectedConversation.participants?.length} members
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg, idx) => {
                  const isOwn = msg.sender_id === user?.id;
                  const showAvatar = !isOwn && (idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id);
                  
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-2 max-w-[70%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                        {showAvatar && !isOwn && (
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(msg.sender?.name || 'U')}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        {!showAvatar && !isOwn && <div className="w-8" />}
                        <div>
                          {showAvatar && !isOwn && (
                            <p className="text-xs text-muted-foreground mb-1">{msg.sender?.name}</p>
                          )}
                          <div className={`rounded-lg px-3 py-2 ${
                            isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <p className={`text-xs text-muted-foreground mt-1 ${isOwn ? 'text-right' : ''}`}>
                            {format(new Date(msg.created_at), 'HH:mm')}
                            {isOwn && settings['read_receipts_enabled'] === 'true' && (
                              <CheckCheck className="inline h-3 w-3 ml-1" />
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex items-center gap-2">
                {settings['allow_file_attachments'] === 'true' && (
                  <Button variant="ghost" size="icon">
                    <Paperclip className="h-5 w-5" />
                  </Button>
                )}
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim() || sendingMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
              <p className="text-muted-foreground mb-4">
                Choose a conversation or start a new one
              </p>
              <Button onClick={() => setShowNewChat(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Conversation
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
