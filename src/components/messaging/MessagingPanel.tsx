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
  MessageSquare, Send, Search, Plus, Users, CheckCheck, 
  Paperclip, X, ArrowLeft, Building2, Shield, UserCog, Image, File, Download, Loader2
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
  lastMessage?: any;
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

interface Attachment {
  name: string;
  path: string;
  type: string;
  size: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  attachments: Attachment[] | null;
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
  role?: string;
}

export default function MessagingPanel() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isEmployee = user?.role === 'employee';
  // Only restrict employees - all other roles (super_admin, hr, manager) can always use messaging
  const canUseMessaging = !isEmployee || settings['employee_messaging_enabled'] === 'true';

  // Fetch settings first
  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  // Then fetch conversations only after settings are loaded and user can use messaging
  useEffect(() => {
    if (settingsLoaded && canUseMessaging && user) {
      fetchConversations();
      fetchAvailableUsers();
    }
  }, [settingsLoaded, canUseMessaging, user]);

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
        () => {
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
      const { data, error } = await supabase.from('message_settings').select('*');
      if (error) {
        console.error('Error fetching settings:', error);
        setSettings({ employee_messaging_enabled: 'false' });
      } else {
        const settingsMap: Record<string, string> = {};
        data?.forEach(s => {
          settingsMap[s.setting_key] = typeof s.setting_value === 'string' 
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

  const fetchConversations = async () => {
    setLoading(true);
    try {
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

      const enrichedConvos = await Promise.all((convos || []).map(async (convo) => {
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('id, user_id, last_read_at')
          .eq('conversation_id', convo.id);

        const userIds = participants?.map(p => p.user_id) || [];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

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

      const senderIds = [...new Set(msgs?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enrichedMsgs = (msgs || []).map(m => ({
        ...m,
        attachments: (m.attachments as unknown) as Attachment[] | null,
        sender: profileMap.get(m.sender_id)
      }));

      setMessages(enrichedMsgs);

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
      // Fetch profiles with their roles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .neq('id', user?.id)
        .order('name');

      // Fetch user roles
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const roleMap = new Map(userRoles?.map(r => [r.user_id, r.role]) || []);
      
      // Filter users based on role
      // Super admins, HR, and managers (store accounts) can always message each other
      // Employees only appear if employee messaging is enabled
      const filteredUsers = (profiles || []).filter(p => {
        const role = roleMap.get(p.id);
        if (role === 'employee') {
          return settings['employee_messaging_enabled'] === 'true';
        }
        return ['super_admin', 'hr', 'manager'].includes(role || '');
      }).map(p => ({
        ...p,
        role: roleMap.get(p.id)
      }));

      setAvailableUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = parseInt(settings['max_attachment_size_mb'] || '10') * 1024 * 1024;
    
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds maximum size of ${settings['max_attachment_size_mb'] || '10'}MB`);
        return false;
      }
      return true;
    });

    setAttachments(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (): Promise<Attachment[]> => {
    const uploadedAttachments: Attachment[] = [];
    
    for (const file of attachments) {
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, file);

      if (error) {
        console.error('Error uploading file:', error);
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      uploadedAttachments.push({
        name: file.name,
        path: filePath,
        type: file.type,
        size: file.size
      });
    }

    return uploadedAttachments;
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && attachments.length === 0) || !selectedConversation) return;

    setSendingMessage(true);
    setUploading(attachments.length > 0);
    
    try {
      let uploadedAttachments: Attachment[] = [];
      
      if (attachments.length > 0) {
        uploadedAttachments = await uploadAttachments();
      }

      const messageType = uploadedAttachments.length > 0 
        ? (uploadedAttachments.some(a => a.type.startsWith('image/')) ? 'image' : 'file')
        : 'text';

      const { error } = await supabase.from('messages').insert([{
        conversation_id: selectedConversation.id,
        sender_id: user?.id,
        content: newMessage.trim() || null,
        message_type: messageType,
        attachments: uploadedAttachments.length > 0 ? (uploadedAttachments as unknown as any) : null
      }]);

      if (error) throw error;

      setNewMessage('');
      setAttachments([]);
      fetchMessages(selectedConversation.id);
      fetchConversations();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      toast.error(errorMessage);
    } finally {
      setSendingMessage(false);
      setUploading(false);
    }
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    try {
      const isGroup = selectedUsers.length > 1;
      
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
      setUserSearchQuery('');
      fetchConversations();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create conversation';
      toast.error(errorMessage);
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

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return <Badge variant="default" className="text-xs"><Shield className="h-3 w-3 mr-1" />Super Admin</Badge>;
      case 'hr':
        return <Badge variant="secondary" className="text-xs"><UserCog className="h-3 w-3 mr-1" />HR</Badge>;
      case 'manager':
        return <Badge variant="outline" className="text-xs"><Building2 className="h-3 w-3 mr-1" />Store Account</Badge>;
      case 'employee':
        return <Badge variant="outline" className="text-xs">Employee</Badge>;
      default:
        return null;
    }
  };

  const getAttachmentUrl = async (path: string): Promise<string | null> => {
    const { data } = await supabase.storage
      .from('message-attachments')
      .createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    const url = await getAttachmentUrl(attachment.path);
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name;
      link.click();
    }
  };

  const filteredConversations = conversations.filter(c => {
    const name = getConversationName(c).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const filteredAvailableUsers = availableUsers.filter(u => 
    u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

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
      <div className={`w-80 border-r flex flex-col ${selectedConversation ? 'hidden md:flex' : ''}`}>
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Messages</h3>
              <p className="text-xs text-muted-foreground">Organization-wide messaging</p>
            </div>
            <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
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
                    <Label>Search Users</Label>
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Search by name or email..."
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Select Users ({selectedUsers.length} selected)</Label>
                    <ScrollArea className="h-64 mt-2 border rounded-md p-2">
                      {filteredAvailableUsers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No users found</p>
                        </div>
                      ) : (
                        filteredAvailableUsers.map(u => (
                          <div 
                            key={u.id} 
                            className={`flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer ${
                              selectedUsers.includes(u.id) ? 'bg-muted' : ''
                            }`}
                            onClick={() => {
                              if (selectedUsers.includes(u.id)) {
                                setSelectedUsers(selectedUsers.filter(id => id !== u.id));
                              } else {
                                if (settings['allow_group_chats'] !== 'true' && selectedUsers.length > 0) {
                                  setSelectedUsers([u.id]);
                                } else {
                                  setSelectedUsers([...selectedUsers, u.id]);
                                }
                              }
                            }}
                          >
                            <Checkbox
                              checked={selectedUsers.includes(u.id)}
                              onCheckedChange={() => {}}
                            />
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{getInitials(u.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{u.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                            {getRoleBadge(u.role)}
                          </div>
                        ))
                      )}
                    </ScrollArea>
                  </div>
                  <Button onClick={handleCreateConversation} className="w-full" disabled={selectedUsers.length === 0}>
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
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                        {convo.lastMessage.content || (convo.lastMessage.message_type === 'image' ? '📷 Image' : '📎 Attachment')}
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
      <div className={`flex-1 flex flex-col ${!selectedConversation ? 'hidden md:flex' : ''}`}>
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
                            {msg.content && (
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            )}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {msg.attachments.map((att, i) => (
                                  <div 
                                    key={i} 
                                    className={`flex items-center gap-2 p-2 rounded ${
                                      isOwn ? 'bg-primary-foreground/10' : 'bg-background'
                                    }`}
                                  >
                                    {att.type.startsWith('image/') ? (
                                      <Image className="h-4 w-4" />
                                    ) : (
                                      <File className="h-4 w-4" />
                                    )}
                                    <span className="text-xs flex-1 truncate">{att.name}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleDownloadAttachment(att)}
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
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

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="px-4 py-2 border-t bg-muted/50">
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-background px-2 py-1 rounded text-sm">
                      {file.type.startsWith('image/') ? <Image className="h-4 w-4" /> : <File className="h-4 w-4" />}
                      <span className="truncate max-w-[100px]">{file.name}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeAttachment(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex items-center gap-2">
                {settings['allow_file_attachments'] === 'true' && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    />
                    <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Paperclip className="h-5 w-5" />
                    </Button>
                  </>
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
                  disabled={sendingMessage}
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={(!newMessage.trim() && attachments.length === 0) || sendingMessage}
                >
                  {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
                Message anyone across your organization
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
