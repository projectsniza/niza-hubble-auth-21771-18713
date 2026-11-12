import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Users,
  MessageSquare,
  Search,
  Shield,
  Building2,
  UserCog,
  Trash2,
  UserPlus,
  MessageSquarePlus,
  X,
  Hash,
  Image as ImageIcon,
} from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { useState, useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import type { Conversation, UserProfile } from './types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewDM: () => void;
  onDeleteConversation?: (id: string) => Promise<boolean>;
  loading: boolean;
}

type ConversationFilter = 'all' | 'direct' | 'unread';

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNewDM,
  onDeleteConversation,
  loading,
}: ConversationListProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ConversationFilter>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    setConversationToDelete(convId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (conversationToDelete && onDeleteConversation) {
      await onDeleteConversation(conversationToDelete);
    }
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const getInitials = (name: string) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd/MM');
  };

  const getConversationName = (conv: Conversation): string => {
    if (conv.name) return conv.name;
    const otherParticipant = conv.participants?.find(p => p.id !== user?.id);
    return otherParticipant?.name || 'Direct Message';
  };

  const renderMessageSnippet = (lastMsg: any) => {
    if (!lastMsg) return 'Start chatting...';
    const isImage = lastMsg.message_type === 'image' || (Array.isArray(lastMsg.attachments) && lastMsg.attachments.some((a: any) => a.type?.startsWith('image/')));
    if (isImage) {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium truncate">
          <ImageIcon className="h-3 w-3 shrink-0" />
          <span>{lastMsg.content || 'Photo'}</span>
        </span>
      );
    }
    if (lastMsg.attachments && lastMsg.attachments.length > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground truncate">
          <span>📎 Attachment</span>
        </span>
      );
    }
    return lastMsg.content || 'Start chatting...';
  };

  const getAvatarColor = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'hr':
        return 'bg-primary/10 text-primary border-primary/30';
      case 'manager':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return <Shield className="h-3 w-3 text-destructive" />;
      case 'hr':
        return <UserCog className="h-3 w-3 text-primary" />;
      case 'manager':
        return <Building2 className="h-3 w-3 text-amber-600" />;
      default:
        return null;
    }
  };

  // Pre-calculate counts
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
  }, [conversations]);

  const allDirectMessages = useMemo(() => {
    return conversations.filter(c => !c.is_group);
  }, [conversations]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      // Search matching
      if (search.trim()) {
        const name = getConversationName(c).toLowerCase();
        const lastMsg = c.last_message?.content?.toLowerCase() || '';
        const q = search.toLowerCase();
        if (!name.includes(q) && !lastMsg.includes(q)) return false;
      }

      // Tab filter
      if (activeFilter === 'direct') {
        return !c.is_group;
      }
      if (activeFilter === 'unread') {
        return (c.unread_count || 0) > 0;
      }

      return true;
    });
  }, [conversations, search, activeFilter, user?.id]);

  // Default Organization Chat (Single Company-Wide Group Chat)
  const orgChat = useMemo(() => {
    return conversations.find(c => c.name === 'Organization Group Chat');
  }, [conversations]);

  const directMessages = useMemo(() => {
    return filteredConversations.filter(c => !c.is_group);
  }, [filteredConversations]);

  if (loading) {
    return (
      <div className="w-80 border-r flex items-center justify-center bg-muted/20">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="w-80 border-r flex flex-col bg-muted/20">
      {/* Top Header & Action Controls */}
      <div className="p-3.5 border-b bg-background space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base tracking-tight text-foreground">Messages</h2>
            {totalUnreadCount > 0 && (
              <Badge variant="default" className="h-5 px-1.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full">
                {totalUnreadCount} new
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onNewDM}
            className="h-8 w-8 rounded-xl text-primary hover:bg-primary/10"
            title="Start a new message"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>

        {/* PROMINENT ACTION BUTTON: New Message */}
        <Button
          size="sm"
          variant="default"
          onClick={onNewDM}
          className="w-full h-9 px-3 text-xs font-semibold gap-2 rounded-xl shadow-xs justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>New Direct Message</span>
        </Button>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-7 h-8 text-xs bg-muted/40 rounded-xl"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pt-1 no-scrollbar text-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
              activeFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({conversations.length})
          </button>

          <button
            onClick={() => setActiveFilter('direct')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
              activeFilter === 'direct'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            Private DMs ({allDirectMessages.length})
          </button>

          {totalUnreadCount > 0 && (
            <button
              onClick={() => setActiveFilter('unread')}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ml-auto ${
                activeFilter === 'unread'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
              }`}
            >
              {totalUnreadCount} unread
            </button>
          )}
        </div>
      </div>

      {/* Conversation Items List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Default Organization Chat (Always present at the top) */}
          {orgChat && activeFilter !== 'direct' && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 uppercase tracking-wider">
                Default Company Channel
              </p>
              <button
                onClick={() => onSelect(orgChat.id)}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl transition-all border ${
                  selectedId === orgChat.id
                    ? 'bg-primary/10 border-primary/40 text-primary shadow-xs'
                    : 'border-transparent hover:bg-background/80 hover:border-border/60'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-500/20 flex items-center justify-center text-primary">
                    <Hash className="h-4 w-4 font-bold" />
                  </div>
                  {(orgChat.unread_count ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-background"></span>
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-xs text-foreground truncate ${(orgChat.unread_count ?? 0) > 0 ? 'font-bold' : 'font-semibold'}`}>
                      Organization Group Chat
                    </p>
                    {orgChat.last_message && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {formatTime(orgChat.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {renderMessageSnippet(orgChat.last_message)}
                  </p>
                </div>
                {(orgChat.unread_count ?? 0) > 0 && (
                  <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center p-0 text-[10px] font-bold bg-primary text-primary-foreground shadow-xs">
                    {orgChat.unread_count}
                  </Badge>
                )}
              </button>
            </div>
          )}

          {/* Direct Messages Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-0.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Direct Messages ({directMessages.length})
              </p>
            </div>

            {directMessages.length === 0 ? (
              <div className="text-center py-8 px-4 text-muted-foreground space-y-2">
                <p className="text-xs font-medium">No direct messages yet</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onNewDM}
                  className="h-7 text-xs rounded-lg gap-1.5"
                >
                  <UserPlus className="h-3 w-3" />
                  <span>Start Chat</span>
                </Button>
              </div>
            ) : (
              directMessages.map(conv => {
                const otherParticipant = conv.participants?.find(p => p.id !== user?.id);
                return (
                  <div
                    key={conv.id}
                    className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl transition-all group cursor-pointer border ${
                      selectedId === conv.id
                        ? 'bg-primary/10 border-primary/40 text-primary shadow-xs'
                        : 'border-transparent hover:bg-background/80 hover:border-border/60'
                    }`}
                    onClick={() => onSelect(conv.id)}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className={`h-9 w-9 border ${getAvatarColor(otherParticipant?.role)}`}>
                        <AvatarFallback className="bg-transparent text-xs font-semibold">
                          {getInitials(otherParticipant?.name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      {(conv.unread_count ?? 0) > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-background"></span>
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <p className={`text-xs text-foreground truncate ${(conv.unread_count ?? 0) > 0 ? 'font-bold' : 'font-semibold'}`}>
                            {otherParticipant?.name || 'Team Member'}
                          </p>
                          {getRoleIcon(otherParticipant?.role)}
                        </div>
                        {conv.last_message && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {formatTime(conv.last_message.created_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {renderMessageSnippet(conv.last_message)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(conv.unread_count ?? 0) > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center p-0 text-[10px] font-bold bg-primary text-primary-foreground shadow-xs">
                          {conv.unread_count}
                        </Badge>
                      )}
                      {onDeleteConversation && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          onClick={(e) => handleDeleteClick(e, conv.id)}
                          title="Delete conversation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? All messages will be permanently removed for you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
