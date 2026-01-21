import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  MessageSquare, Send, Users, CheckCheck, 
  Paperclip, X, Image, File, Download, Loader2, Shield, Building2, UserCog, Trash2, CheckSquare
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

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
    role?: string;
  };
}

interface OnlineUser {
  id: string;
  name: string;
  role: string;
}

const ORG_CHAT_NAME = 'Organization Group Chat';

export default function MessagingPanel() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [deletingMessages, setDeletingMessages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = user?.role === 'super_admin';

  const isEmployee = user?.role === 'employee';
  // Only restrict employees - all other roles (super_admin, hr, manager) can always use messaging
  const canUseMessaging = !isEmployee || settings['employee_messaging_enabled'] === 'true';

  // Fetch settings first
  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  // Then set up the organization chat
  useEffect(() => {
    if (settingsLoaded && canUseMessaging && user) {
      initializeOrgChat();
      fetchOnlineUsers();
    }
  }, [settingsLoaded, canUseMessaging, user]);

  useEffect(() => {
    if (!conversationId) return;
    
    fetchMessages();
    
    // Subscribe to new messages
    const channel = supabase
      .channel(`org-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

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

  const initializeOrgChat = async () => {
    setLoading(true);
    try {
      // Get current session to ensure user id matches auth.uid()
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.user?.id) {
        console.error('No active session for chat initialization');
        return;
      }

      const userId = currentSession.user.id;

      // Check for existing org-wide conversation
      const { data: existingConvo } = await supabase
        .from('conversations')
        .select('id')
        .eq('name', ORG_CHAT_NAME)
        .eq('is_group', true)
        .maybeSingle();

      if (existingConvo) {
        // Check if user is participant
        const { data: participation } = await supabase
          .from('conversation_participants')
          .select('id')
          .eq('conversation_id', existingConvo.id)
          .eq('user_id', userId)
          .maybeSingle();

        if (!participation) {
          // Add user as participant
          const { error: participantError } = await supabase.from('conversation_participants').insert({
            conversation_id: existingConvo.id,
            user_id: userId
          });
          if (participantError) {
            console.error('Error adding participant:', participantError);
          }
        }

        setConversationId(existingConvo.id);
      } else {
        // Create new org-wide conversation
        const { data: newConvo, error: createError } = await supabase
          .from('conversations')
          .insert({
            name: ORG_CHAT_NAME,
            is_group: true,
            created_by: userId
          })
          .select()
          .single();

        if (createError) throw createError;

        // Add current user as participant
        await supabase.from('conversation_participants').insert({
          conversation_id: newConvo.id,
          user_id: userId
        });

        setConversationId(newConvo.id);
      }
    } catch (error) {
      console.error('Error initializing org chat:', error);
      toast.error('Failed to initialize chat');
    } finally {
      setLoading(false);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      // Fetch all users who can message (super_admin, hr, manager, and employees if enabled)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .order('name');

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const roleMap = new Map(userRoles?.map(r => [r.user_id, r.role]) || []);
      
      const allowedUsers = (profiles || []).filter(p => {
        const role = roleMap.get(p.id);
        if (role === 'employee') {
          return settings['employee_messaging_enabled'] === 'true';
        }
        return ['super_admin', 'hr', 'manager'].includes(role || '');
      }).map(p => ({
        id: p.id,
        name: p.name,
        role: roleMap.get(p.id) || 'user'
      }));

      setOnlineUsers(allowedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchMessages = async () => {
    if (!conversationId) return;
    
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

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const roleMap = new Map(userRoles?.map(r => [r.user_id, r.role]) || []);

      const enrichedMsgs = (msgs || []).map(m => ({
        ...m,
        attachments: (m.attachments as unknown) as Attachment[] | null,
        sender: {
          ...profileMap.get(m.sender_id),
          role: roleMap.get(m.sender_id)
        }
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
    if ((!newMessage.trim() && attachments.length === 0) || !conversationId) return;

    // Ensure we have a valid user and session
    if (!user?.id) {
      toast.error('You must be logged in to send messages');
      return;
    }

    // Get the current session to ensure auth.uid() will match
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.user?.id) {
      toast.error('Session expired. Please refresh the page and try again.');
      return;
    }

    // Verify the session user matches our context user
    if (currentSession.user.id !== user.id) {
      console.error('Session mismatch:', { sessionUserId: currentSession.user.id, contextUserId: user.id });
      toast.error('Session error. Please log out and log back in.');
      return;
    }

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

      // Use the session user id to ensure it matches auth.uid() in the RLS policy
      const { error } = await supabase.from('messages').insert([{
        conversation_id: conversationId,
        sender_id: currentSession.user.id,
        content: newMessage.trim() || null,
        message_type: messageType,
        attachments: uploadedAttachments.length > 0 ? (uploadedAttachments as unknown as any) : null
      }]);

      if (error) {
        console.error('Message insert error:', error);
        throw error;
      }

      setNewMessage('');
      setAttachments([]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      toast.error(errorMessage);
    } finally {
      setSendingMessage(false);
      setUploading(false);
    }
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'HH:mm');
  };

  const formatDateDivider = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const getRoleBadgeSmall = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4"><Shield className="h-2.5 w-2.5 mr-0.5" />Admin</Badge>;
      case 'hr':
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4"><UserCog className="h-2.5 w-2.5 mr-0.5" />HR</Badge>;
      case 'manager':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4"><Building2 className="h-2.5 w-2.5 mr-0.5" />Store</Badge>;
      case 'employee':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Employee</Badge>;
      default:
        return null;
    }
  };

  const getAvatarColor = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-500 text-white';
      case 'hr':
        return 'bg-blue-500 text-white';
      case 'manager':
        return 'bg-green-500 text-white';
      default:
        return 'bg-muted';
    }
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    const { data } = await supabase.storage
      .from('message-attachments')
      .createSignedUrl(attachment.path, 3600);
    
    if (data?.signedUrl) {
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = attachment.name;
      link.click();
    }
  };

  // Toggle message selection
  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  // Select all messages
  const selectAllMessages = () => {
    if (selectedMessages.size === messages.length) {
      setSelectedMessages(new Set());
    } else {
      setSelectedMessages(new Set(messages.map(m => m.id)));
    }
  };

  // Bulk delete messages (soft delete)
  const handleBulkDelete = async () => {
    if (selectedMessages.size === 0) return;
    
    setDeletingMessages(true);
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .in('id', Array.from(selectedMessages));

      if (error) throw error;

      toast.success(`${selectedMessages.size} message(s) deleted`);
      setSelectedMessages(new Set());
      setSelectionMode(false);
      fetchMessages();
    } catch (error) {
      console.error('Error deleting messages:', error);
      toast.error('Failed to delete messages');
    } finally {
      setDeletingMessages(false);
    }
  };

  // Cancel selection mode
  const cancelSelectionMode = () => {
    setSelectionMode(false);
    setSelectedMessages(new Set());
  };

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg, idx) => {
    const msgDate = new Date(msg.created_at);
    const prevMsg = messages[idx - 1];
    const showDateDivider = !prevMsg || !isSameDay(msgDate, new Date(prevMsg.created_at));
    
    if (showDateDivider) {
      acc.push({ type: 'divider', date: msg.created_at });
    }
    acc.push({ type: 'message', message: msg });
    return acc;
  }, [] as Array<{ type: 'divider'; date: string } | { type: 'message'; message: Message }>);

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

  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex border rounded-lg overflow-hidden bg-card">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between">
            {selectionMode ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <CheckSquare className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedMessages.size} Selected</h3>
                    <p className="text-xs text-muted-foreground">
                      Click messages to select/deselect
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllMessages}
                    className="gap-1"
                  >
                    <CheckSquare className="h-4 w-4" />
                    {selectedMessages.size === messages.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={selectedMessages.size === 0 || deletingMessages}
                    className="gap-1"
                  >
                    {deletingMessages ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete ({selectedMessages.size})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelSelectionMode}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Organization Chat</h3>
                    <p className="text-xs text-muted-foreground">
                      {onlineUsers.length} members • All organizations
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSuperAdmin && messages.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectionMode(true)}
                      className="gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      Bulk Delete
                    </Button>
                  )}
                  <Badge variant="outline" className="hidden md:flex">
                    <Users className="h-3 w-3 mr-1" />
                    Group Chat
                  </Badge>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-4xl mx-auto">
            {groupedMessages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-1">Welcome to Organization Chat</p>
                <p className="text-sm">Start a conversation with your team</p>
              </div>
            ) : (
              groupedMessages.map((item, idx) => {
                if (item.type === 'divider') {
                  return (
                    <div key={`divider-${idx}`} className="flex items-center gap-4 my-6">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground font-medium px-2">
                        {formatDateDivider(item.date)}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  );
                }

                const msg = item.message;
                const isOwn = msg.sender_id === user?.id;
                const prevItem = groupedMessages[idx - 1];
                const showAvatar = !isOwn && (
                  prevItem?.type === 'divider' || 
                  (prevItem?.type === 'message' && prevItem.message.sender_id !== msg.sender_id)
                );

                const isSelected = selectedMessages.has(msg.id);

                return (
                  <div 
                    key={msg.id} 
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${selectionMode ? 'cursor-pointer' : ''}`}
                    onClick={selectionMode ? () => toggleMessageSelection(msg.id) : undefined}
                  >
                    {/* Checkbox in selection mode */}
                    {selectionMode && (
                      <div className="flex items-center pr-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleMessageSelection(msg.id)}
                          className="h-5 w-5"
                        />
                      </div>
                    )}
                    <div className={`flex gap-2 max-w-[75%] ${isOwn ? 'flex-row-reverse' : ''} ${isSelected ? 'opacity-60' : ''}`}>
                      {showAvatar && !isOwn ? (
                        <Avatar className={`h-8 w-8 ${getAvatarColor(msg.sender?.role)}`}>
                          <AvatarFallback className="text-xs bg-transparent">
                            {getInitials(msg.sender?.name || 'U')}
                          </AvatarFallback>
                        </Avatar>
                      ) : !isOwn ? (
                        <div className="w-8" />
                      ) : null}
                      <div className="flex flex-col">
                        {showAvatar && !isOwn && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">{msg.sender?.name}</span>
                            {getRoleBadgeSmall(msg.sender?.role)}
                          </div>
                        )}
                        <div className={`rounded-2xl px-4 py-2 ${
                          isOwn 
                            ? 'bg-primary text-primary-foreground rounded-br-md' 
                            : 'bg-muted rounded-bl-md'
                        } ${isSelected ? 'ring-2 ring-destructive ring-offset-2' : ''}`}>
                          {msg.content && (
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          )}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className={`mt-2 space-y-1 ${msg.content ? 'pt-2 border-t border-white/20' : ''}`}>
                              {msg.attachments.map((att, i) => (
                                <div 
                                  key={i} 
                                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${
                                    isOwn ? 'bg-primary-foreground/10' : 'bg-background'
                                  }`}
                                  onClick={(e) => {
                                    if (!selectionMode) {
                                      handleDownloadAttachment(att);
                                    }
                                    e.stopPropagation();
                                  }}
                                >
                                  {att.type.startsWith('image/') ? (
                                    <Image className="h-4 w-4 shrink-0" />
                                  ) : (
                                    <File className="h-4 w-4 shrink-0" />
                                  )}
                                  <span className="text-xs flex-1 truncate">{att.name}</span>
                                  <Download className="h-3 w-3 shrink-0" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                          <span className="text-[10px] text-muted-foreground">
                            {formatMessageTime(msg.created_at)}
                          </span>
                          {isOwn && settings['read_receipts_enabled'] === 'true' && (
                            <CheckCheck className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/50">
            <div className="flex flex-wrap gap-2 max-w-4xl mx-auto">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-full text-sm border">
                  {file.type.startsWith('image/') ? <Image className="h-4 w-4" /> : <File className="h-4 w-4" />}
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive/10" onClick={() => removeAttachment(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="p-4 border-t bg-background">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={() => fileInputRef.current?.click()} 
                disabled={uploading}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
            </>
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1 rounded-full px-4"
              disabled={sendingMessage}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={(!newMessage.trim() && attachments.length === 0) || sendingMessage}
              size="icon"
              className="shrink-0 rounded-full"
            >
              {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Members Sidebar - Desktop Only */}
      <div className="w-64 border-l hidden lg:flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <h4 className="font-medium text-sm">Members</h4>
          <p className="text-xs text-muted-foreground">{onlineUsers.length} people</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {onlineUsers.map(u => (
              <div 
                key={u.id} 
                className={`flex items-center gap-2 p-2 rounded-lg ${u.id === user?.id ? 'bg-primary/5' : 'hover:bg-muted'}`}
              >
                <Avatar className={`h-8 w-8 ${getAvatarColor(u.role)}`}>
                  <AvatarFallback className="text-xs bg-transparent">
                    {getInitials(u.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {u.name}
                    {u.id === user?.id && <span className="text-muted-foreground"> (You)</span>}
                  </p>
                  {getRoleBadgeSmall(u.role)}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
