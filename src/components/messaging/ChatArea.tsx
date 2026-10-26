import { useState, useRef, useEffect, useMemo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageSquare,
  Send,
  Paperclip,
  X,
  Image,
  File,
  Download,
  Loader2,
  Shield,
  Building2,
  UserCog,
  Pin,
  Reply,
  MoreVertical,
  CheckCheck,
  Search,
  Trash2,
  CheckSquare,
  AtSign,
  ClipboardList,
  CheckCircle2,
  ExternalLink,
  Calendar,
  Check,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { useActionItemsGlobal } from '@/contexts/ActionItemsContext';
import { ACTION_MODULES, getActionModuleByKey, ActionItem } from './hooks/useActionItems';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import type { Message, Attachment, UserProfile, Conversation } from './types';

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  pinnedMessages: Message[];
  loading: boolean;
  sending: boolean;
  typingUsers: string[];
  participants: UserProfile[];
  actionItems?: ActionItem[];
  onSendMessage: (
    content: string,
    attachments?: Attachment[],
    replyToId?: string,
    mentions?: string[]
  ) => Promise<any>;
  onTogglePin: (messageId: string, pinned: boolean) => void;
  settings: Record<string, string>;
  onRaiseAction?: (message: Message) => void;
}

export default function ChatArea({
  conversation,
  messages,
  pinnedMessages,
  loading,
  sending,
  typingUsers,
  participants,
  actionItems = [],
  onSendMessage,
  onTogglePin,
  settings,
  onRaiseAction,
}: ChatAreaProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { createActionItem, markDone } = useActionItemsGlobal();

  // Action item tagging state in typing space
  const [actionItemMode, setActionItemMode] = useState(false);
  const [actionAssignee, setActionAssignee] = useState<string>('');
  const [actionModuleKey, setActionModuleKey] = useState<string>('general');
  const [actionDueDate, setActionDueDate] = useState<string>('');
  const [extraAssignees, setExtraAssignees] = useState<UserProfile[]>([]);

  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [deletingMessages, setDeletingMessages] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = user?.role === 'super_admin';

  // Fetch admin and store manager profiles so store accounts can ALWAYS raise for superadmin and vice-versa
  useEffect(() => {
    const fetchAdminsAndStores = async () => {
      try {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('role', ['super_admin', 'hr', 'manager']);

        const userIds = roles?.map(r => r.user_id) || [];
        if (userIds.length === 0) return;

        const { data: profiles } = await supabase
          .rpc('get_messaging_profiles', { p_user_ids: userIds });

        const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
        const loaded: UserProfile[] = (profiles || []).map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          role: roleMap.get(p.id),
        }));
        setExtraAssignees(loaded);
      } catch (err) {
        console.error('Error fetching assignees for action items:', err);
      }
    };

    fetchAdminsAndStores();
  }, []);

  const assignableUsers = useMemo(() => {
    const map = new Map<string, UserProfile>();
    // First, participants in the current conversation
    participants.forEach(p => {
      if (p.id !== user?.id) map.set(p.id, p);
    });
    // Add extra assignees (superadmin, hr, managers)
    extraAssignees.forEach(u => {
      if (u.id !== user?.id && !map.has(u.id)) {
        map.set(u.id, u);
      }
    });

    const list = Array.from(map.values());

    // Sort: if user is store account (manager), put super_admin / hr at top!
    // If user is super_admin, put managers at top!
    list.sort((a, b) => {
      if (user?.role === 'manager') {
        if (a.role === 'super_admin' && b.role !== 'super_admin') return -1;
        if (b.role === 'super_admin' && a.role !== 'super_admin') return 1;
        if (a.role === 'hr' && b.role !== 'hr') return -1;
        if (b.role === 'hr' && a.role !== 'hr') return 1;
      } else {
        if (a.role === 'manager' && b.role !== 'manager') return -1;
        if (b.role === 'manager' && a.role !== 'manager') return 1;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    return list;
  }, [participants, extraAssignees, user]);

  useEffect(() => {
    if (!actionAssignee && assignableUsers.length > 0) {
      setActionAssignee(assignableUsers[0].id);
    }
  }, [assignableUsers, actionAssignee]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getInitials = (name: string) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const formatMessageTime = (dateStr: string) => format(new Date(dateStr), 'HH:mm');

  const formatDateDivider = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const getAvatarColor = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-destructive/10 text-destructive';
      case 'hr':
        return 'bg-primary/10 text-primary';
      case 'manager':
        return 'bg-accent/30 text-accent-foreground';
      default:
        return 'bg-muted';
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return (
          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20">
            <Shield className="h-2.5 w-2.5 mr-0.5" />
            Admin
          </Badge>
        );
      case 'hr':
        return (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            <UserCog className="h-2.5 w-2.5 mr-0.5" />
            HR
          </Badge>
        );
      case 'manager':
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            <Building2 className="h-2.5 w-2.5 mr-0.5" />
            Store
          </Badge>
        );
      default:
        return null;
    }
  };

  // Filter out messages from deleted users (no sender profile) and group by date
  const groupedMessages = useMemo(() => {
    const validMessages = messages.filter(msg => {
      // Keep own messages always; filter out messages where sender has no name (deleted user)
      if (msg.sender_id === user?.id) return true;
      return msg.sender?.name && msg.sender.name !== 'Unknown';
    });
    return validMessages.reduce(
      (acc, msg, idx) => {
        const msgDate = new Date(msg.created_at);
        const prevMsg = validMessages[idx - 1];
        const showDateDivider = !prevMsg || !isSameDay(msgDate, new Date(prevMsg.created_at));

        if (showDateDivider) {
          acc.push({ type: 'divider' as const, date: msg.created_at });
        }
        acc.push({ type: 'message' as const, message: msg });
        return acc;
      },
      [] as Array<{ type: 'divider'; date: string } | { type: 'message'; message: Message }>
    );
  }, [messages, user?.id]);

  // File handling
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
    const uploaded: Attachment[] = [];

    for (const file of attachments) {
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error } = await supabase.storage.from('message-attachments').upload(filePath, file);

      if (error) {
        console.error('Error uploading file:', error);
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      uploaded.push({
        name: file.name,
        path: filePath,
        type: file.type,
        size: file.size,
      });
    }

    return uploaded;
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

  // Mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    setCursorPosition(e.target.selectionStart || 0);

    // Check for @ mentions
    const textBeforeCursor = value.slice(0, e.target.selectionStart || 0);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setMentionFilter(textAfterAt.toLowerCase());
        setShowMentions(true);
        return;
      }
    }

    setShowMentions(false);
    setMentionFilter('');
  };

  const insertMention = (userProfile: UserProfile) => {
    const textBeforeCursor = newMessage.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = newMessage.slice(cursorPosition);

    const newText = textBeforeCursor.slice(0, lastAtIndex) + `@${userProfile.name} ` + textAfterCursor;
    setNewMessage(newText);
    setShowMentions(false);
    setMentionFilter('');
    inputRef.current?.focus();
  };

  const filteredMentionUsers = participants.filter(
    p => p.id !== user?.id && p.name.toLowerCase().includes(mentionFilter)
  );

  // Extract mentioned user IDs from message
  const extractMentions = (text: string): string[] => {
    const mentionedIds: string[] = [];
    participants.forEach(p => {
      if (text.includes(`@${p.name}`)) {
        mentionedIds.push(p.id);
      }
    });
    return mentionedIds;
  };

  // Send message
  const handleSend = async () => {
    if ((!newMessage.trim() && attachments.length === 0) || !conversation) return;

    setUploading(attachments.length > 0);

    try {
      let uploadedAttachments: Attachment[] = [];
      if (attachments.length > 0) {
        uploadedAttachments = await uploadAttachments();
      }

      const mentions = extractMentions(newMessage);
      const success = await onSendMessage(
        newMessage,
        uploadedAttachments,
        replyTo?.id,
        mentions
      );

      if (success) {
        if (actionItemMode && conversation) {
          const targetAssignee = actionAssignee || assignableUsers[0]?.id;
          if (targetAssignee) {
            const mod = getActionModuleByKey(actionModuleKey);
            const msgId = typeof success === 'object' && (success as any)?.id ? (success as any).id : null;
            await createActionItem({
              conversation_id: conversation.id,
              message_id: msgId,
              assigned_to: targetAssignee,
              title: newMessage.trim().slice(0, 80) || `Action Item: ${mod.label}`,
              details: newMessage.trim() || undefined,
              module: mod,
              due_date: actionDueDate || null,
            });
            setActionItemMode(false);
            setActionDueDate('');
          }
        }
        setNewMessage('');
        setAttachments([]);
        setReplyTo(null);
      }
    } finally {
      setUploading(false);
    }
  };

  // Search
  const handleSearch = async () => {
    if (!searchQuery.trim() || !conversation) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .eq('is_deleted', false)
      .ilike('content', `%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    setSearchResults(
      (data || []).map(m => ({
        ...m,
        is_edited: m.is_edited ?? false,
        is_deleted: m.is_deleted ?? false,
        is_pinned: m.is_pinned ?? false,
        pinned_by: m.pinned_by ?? null,
        pinned_at: m.pinned_at ?? null,
        reply_to_id: m.reply_to_id ?? null,
        attachments: m.attachments as unknown as Attachment[] | null,
      }))
    );
  };

  // Selection mode
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

  const selectAllMessages = () => {
    if (selectedMessages.size === messages.length) {
      setSelectedMessages(new Set());
    } else {
      setSelectedMessages(new Set(messages.map(m => m.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMessages.size === 0 || !conversation) return;

    setDeletingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-delete-messages', {
        body: {
          messageIds: Array.from(selectedMessages),
          conversationId: conversation.id,
        },
      });

      if (error) throw error;
      if (data?.success !== true) {
        throw new Error(data?.error || 'Failed to delete messages');
      }

      toast.success(`${selectedMessages.size} message(s) deleted`);
      setSelectedMessages(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error('Error deleting messages:', error);
      toast.error('Failed to delete messages');
    } finally {
      setDeletingMessages(false);
    }
  };

  const cancelSelectionMode = () => {
    setSelectionMode(false);
    setSelectedMessages(new Set());
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/10">
        <div className="text-center">
          <MessageSquare className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Select a conversation</h3>
          <p className="text-sm text-muted-foreground/70">Choose from the list or start a new chat</p>
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <NizaLoaderInline />
      </div>
    );
  }

  const conversationName =
    conversation.name || participants.find(p => p.id !== user?.id)?.name || 'Chat';

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-16 px-4 border-b flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
        {selectionMode ? (
          <>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <CheckSquare className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold">{selectedMessages.size} Selected</h3>
                <p className="text-xs text-muted-foreground">Click messages to select/deselect</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAllMessages}>
                <CheckSquare className="h-4 w-4 mr-1" />
                {selectedMessages.size === messages.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={selectedMessages.size === 0 || deletingMessages}
              >
                {deletingMessages ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Delete ({selectedMessages.size})
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelSelectionMode}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{conversationName}</h3>
                <p className="text-xs text-muted-foreground">
                  {typingUsers.length > 0
                    ? `${participants.find(p => typingUsers.includes(p.id))?.name || 'Someone'} is typing...`
                    : `${participants.length} members`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(!searchOpen)}
                className={searchOpen ? 'bg-muted' : ''}
              >
                <Search className="h-4 w-4" />
              </Button>
              {isSuperAdmin && messages.length > 0 && (
                <Button variant="ghost" size="icon" onClick={() => setSelectionMode(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Search Panel */}
      {searchOpen && (
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="h-9"
            />
            <Button size="sm" onClick={handleSearch}>
              Search
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {searchResults.map(msg => (
                <div key={msg.id} className="text-sm p-2 rounded bg-background hover:bg-muted cursor-pointer">
                  <p className="truncate">{msg.content}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(msg.created_at), 'MMM d, HH:mm')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pinned Messages */}
      {pinnedMessages.length > 0 && (
        <div className="border-b bg-amber-50/50 dark:bg-amber-950/20">
          <button
            onClick={() => setShowPinnedMessages(!showPinnedMessages)}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm">
              <Pin className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-800 dark:text-amber-200">
                {pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {showPinnedMessages ? 'Hide' : 'Click to view'}
            </span>
          </button>
          {showPinnedMessages && (
            <div className="px-4 pb-3 space-y-2 max-h-60 overflow-y-auto">
              {pinnedMessages.map(msg => (
                <div
                  key={msg.id}
                  className="p-3 rounded-lg bg-background border border-amber-200 dark:border-amber-800"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Avatar className={`h-6 w-6 ${getAvatarColor(msg.sender?.role)}`}>
                        <AvatarFallback className="text-xs">
                          {getInitials(msg.sender?.name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{msg.sender?.name || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), 'MMM d, HH:mm')}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={e => {
                        e.stopPropagation();
                        onTogglePin(msg.id, false);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm text-foreground">{msg.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {groupedMessages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-1">No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
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
              const showAvatar =
                !isOwn &&
                (prevItem?.type === 'divider' ||
                  (prevItem?.type === 'message' && prevItem.message.sender_id !== msg.sender_id));
              const isSelected = selectedMessages.has(msg.id);

              return (
                <div
                  key={msg.id}
                  className={`group flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                    selectionMode ? 'cursor-pointer' : ''
                  }`}
                  onClick={selectionMode ? () => toggleMessageSelection(msg.id) : undefined}
                >
                  {selectionMode && (
                    <div className="flex items-center pr-3" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleMessageSelection(msg.id)}
                        className="h-5 w-5"
                      />
                    </div>
                  )}

                  <div className={`flex gap-2 max-w-[75%] ${isOwn ? 'flex-row-reverse' : ''}`}>
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
                          {getRoleBadge(msg.sender?.role)}
                        </div>
                      )}

                      {/* Reply preview */}
                      {msg.reply_to && (
                        <div
                          className={`text-xs px-3 py-1.5 rounded-t-xl border-l-2 border-primary/50 bg-muted/50 mb-1 ${
                            isOwn ? 'text-right' : ''
                          }`}
                        >
                          <p className="font-medium text-muted-foreground">
                            Replying to {msg.reply_to.sender?.name || 'Unknown'}
                          </p>
                          <p className="truncate text-muted-foreground">{msg.reply_to.content}</p>
                        </div>
                      )}

                      <div className="relative">
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          } ${msg.is_pinned ? 'ring-2 ring-amber-400/50' : ''} ${
                            isSelected ? 'ring-2 ring-destructive ring-offset-2' : ''
                          }`}
                        >
                          {msg.is_pinned && (
                            <Pin className="absolute -top-2 -right-2 h-4 w-4 text-amber-500" />
                          )}

                          {(() => {
                            const linkedAction = (actionItems || []).find(item => item.message_id === msg.id);
                            if (!linkedAction) return null;
                            return (
                              <div className={`mb-2 p-2.5 rounded-xl border space-y-1.5 text-left ${
                                isOwn
                                  ? 'bg-primary-foreground/15 border-primary-foreground/25 text-primary-foreground'
                                  : 'bg-card border-amber-500/40 text-card-foreground shadow-xs'
                              }`}>
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                  <Badge variant="outline" className={`text-[10px] py-0 px-2 font-bold gap-1 ${
                                    isOwn ? 'bg-primary-foreground/25 text-primary-foreground border-transparent' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-400/40'
                                  }`}>
                                    <ClipboardList className="h-3 w-3" />
                                    Action Item: {linkedAction.module_label || 'General'}
                                  </Badge>
                                  <Badge variant="outline" className={`text-[10px] py-0 px-2 capitalize font-semibold ${
                                    linkedAction.status === 'completed'
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                      : linkedAction.status === 'acknowledged'
                                      ? 'bg-amber-500/15 text-amber-600 border-amber-400/30'
                                      : 'bg-destructive/15 text-destructive border-destructive/30'
                                  }`}>
                                    {linkedAction.status}
                                  </Badge>
                                </div>

                                {linkedAction.due_date && (
                                  <p className="text-[10px] opacity-85 flex items-center gap-1 font-medium">
                                    <Calendar className="h-2.5 w-2.5" />
                                    Due: {format(new Date(linkedAction.due_date), 'dd/MM/yyyy')}
                                  </p>
                                )}

                                {linkedAction.completion_note && (
                                  <p className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 p-1.5 rounded-md border border-emerald-500/20 font-medium">
                                    ✓ Done: {linkedAction.completion_note}
                                  </p>
                                )}

                                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant={isOwn ? 'secondary' : 'outline'}
                                    className="h-6 text-[10px] px-2 rounded-md font-medium"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(linkedAction.module_route || '/dashboard');
                                    }}
                                  >
                                    <ExternalLink className="h-2.5 w-2.5 mr-1" />
                                    Open {linkedAction.module_label || 'Module'}
                                  </Button>

                                  {linkedAction.assigned_to === user?.id && (linkedAction.status === 'open' || linkedAction.status === 'acknowledged') && (
                                    <Button
                                      size="sm"
                                      className="h-6 text-[10px] px-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markDone(linkedAction.id);
                                      }}
                                    >
                                      <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                                      Mark Done
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {msg.content && (
                            <p className="text-sm whitespace-pre-wrap">
                              {msg.content.split(/(@\w+(?:\s\w+)*)/g).map((part, i) => {
                                if (part.startsWith('@')) {
                                  return (
                                    <span key={i} className="text-primary font-medium">
                                      {part}
                                    </span>
                                  );
                                }
                                return part;
                              })}
                            </p>
                          )}

                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className={`mt-2 space-y-1 ${msg.content ? 'pt-2 border-t border-white/20' : ''}`}>
                              {msg.attachments.map((att, i) => (
                                <div
                                  key={i}
                                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${
                                    isOwn ? 'bg-primary-foreground/10' : 'bg-background'
                                  }`}
                                  onClick={e => {
                                    if (!selectionMode) {
                                      e.stopPropagation();
                                      handleDownloadAttachment(att);
                                    }
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

                        {/* Message actions */}
                        {!selectionMode && (
                          <div
                            className={`absolute top-0 ${
                              isOwn ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'
                            } opacity-0 group-hover:opacity-100 transition-opacity`}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align={isOwn ? 'start' : 'end'}>
                                <DropdownMenuItem onClick={() => setReplyTo(msg)}>
                                  <Reply className="h-4 w-4 mr-2" />
                                  Reply
                                </DropdownMenuItem>
                                {onRaiseAction && (
                                  <DropdownMenuItem onClick={() => onRaiseAction(msg)}>
                                    <ClipboardList className="h-4 w-4 mr-2" />
                                    Raise action item
                                  </DropdownMenuItem>
                                )}
                                {isSuperAdmin && (
                                  <DropdownMenuItem onClick={() => onTogglePin(msg.id, !msg.is_pinned)}>
                                    <Pin className="h-4 w-4 mr-2" />
                                    {msg.is_pinned ? 'Unpin' : 'Pin'}
                                  </DropdownMenuItem>
                                )}

                              </DropdownMenuContent>
                            </DropdownMenu>
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

      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              <Reply className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs font-medium">Replying to {replyTo.sender?.name}</p>
                <p className="text-xs text-muted-foreground truncate max-w-xs">{replyTo.content}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyTo(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/50">
          <div className="flex flex-wrap gap-2 max-w-4xl mx-auto">
            {attachments.map((file, i) => (
              <div key={i} className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-full text-sm border">
                {file.type.startsWith('image/') ? <Image className="h-4 w-4" /> : <File className="h-4 w-4" />}
                <span className="truncate max-w-[120px]">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 hover:bg-destructive/10"
                  onClick={() => removeAttachment(i)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Item Configuration Bar attached directly to typing space */}
      {actionItemMode && (
        <div className="px-4 py-2.5 border-t border-amber-500/30 bg-amber-500/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <div className="flex flex-wrap items-center justify-between gap-2.5 max-w-4xl mx-auto">
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
              <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1 py-1 shadow-xs">
                <ClipboardList className="h-3.5 w-3.5" />
                Action Item
              </Badge>

              {/* Assignee Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">To:</span>
                <Select value={actionAssignee} onValueChange={setActionAssignee}>
                  <SelectTrigger className="h-8 text-xs min-w-[150px] sm:min-w-[180px] bg-background">
                    <SelectValue placeholder="Select Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableUsers.map(u => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        <span className="font-medium">{u.name}</span>
                        {u.role && (
                          <span className="ml-1 text-[10px] text-muted-foreground uppercase">
                            ({u.role === 'super_admin' ? 'Super Admin' : u.role === 'manager' ? 'Store' : u.role})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Module / Sidebar Section Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">Module:</span>
                <Select value={actionModuleKey} onValueChange={setActionModuleKey}>
                  <SelectTrigger className="h-8 text-xs min-w-[140px] sm:min-w-[170px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_MODULES.map(m => (
                      <SelectItem key={m.key} value={m.key} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Optional Due Date */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">Due:</span>
                <Input
                  type="date"
                  value={actionDueDate}
                  onChange={e => setActionDueDate(e.target.value)}
                  className="h-8 text-xs w-36 bg-background"
                />
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setActionItemMode(false)}
              title="Close action item mode"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Message input */}
      <div className="p-4 border-t bg-background">
        <div className="flex items-center gap-2 max-w-4xl mx-auto relative">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="*/*"
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          {/* Action Item Tagging Button in the typing bar */}
          <Button
            type="button"
            variant={actionItemMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActionItemMode(v => !v)}
            className={`h-9 px-3 rounded-full text-xs font-semibold gap-1.5 shrink-0 transition-all ${
              actionItemMode
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs ring-2 ring-amber-400/40'
                : 'text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-500/10'
            }`}
            title="Tag as Action Item with Module dropdown"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">
              {actionItemMode ? `Action: ${getActionModuleByKey(actionModuleKey).label}` : 'Action Item'}
            </span>
          </Button>

          <div className="relative flex-1">
            <Input
              ref={inputRef}
              placeholder={
                actionItemMode
                  ? `Type action instructions for ${assignableUsers.find(u => u.id === actionAssignee)?.name || 'assignee'} (Module: ${getActionModuleByKey(actionModuleKey).label})...`
                  : 'Type your message... Use @ to mention'
              }
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className={`rounded-full px-4 pr-10 transition-all ${
                actionItemMode ? 'ring-2 ring-amber-500/40 border-amber-400' : ''
              }`}
              disabled={sending}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setShowMentions(!showMentions)}
            >
              <AtSign className="h-4 w-4 text-muted-foreground" />
            </Button>

            {/* Mentions dropdown */}
            {showMentions && filteredMentionUsers.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-popover border rounded-lg shadow-lg p-1 z-50">
                {filteredMentionUsers.slice(0, 5).map(u => (
                  <button
                    key={u.id}
                    onClick={() => insertMention(u)}
                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left"
                  >
                    <Avatar className={`h-6 w-6 ${getAvatarColor(u.role)}`}>
                      <AvatarFallback className="text-xs bg-transparent">{getInitials(u.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{u.name}</span>
                    {getRoleBadge(u.role)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleSend}
            disabled={(!newMessage.trim() && attachments.length === 0) || sending}
            size="icon"
            className={`shrink-0 rounded-full transition-all ${
              actionItemMode ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs' : ''
            }`}
            title={actionItemMode ? 'Send & Raise Action Item' : 'Send message'}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
