import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Users, MessageSquare, Plus, Search, Shield, Building2, UserCog, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import type { Conversation, UserProfile } from './types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewDM: () => void;
  onDeleteConversation?: (id: string) => Promise<boolean>;
  loading: boolean;
}

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
    // For DMs, show the other person's name
    const otherParticipant = conv.participants?.find(p => p.id !== user?.id);
    return otherParticipant?.name || 'Direct Message';
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
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return <Shield className="h-3 w-3" />;
      case 'hr':
        return <UserCog className="h-3 w-3" />;
      case 'manager':
        return <Building2 className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (!search.trim()) return true;
    const name = getConversationName(c).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  // Separate org chat and DMs
  const orgChat = filteredConversations.find(c => c.name === 'Organization Group Chat');
  const directMessages = filteredConversations.filter(c => !c.is_group);
  const groupChats = filteredConversations.filter(c => c.is_group && c.name !== 'Organization Group Chat');

  if (loading) {
    return (
      <div className="w-80 border-r flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="w-80 border-r flex flex-col bg-muted/30">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Messages</h2>
          <Button variant="ghost" size="icon" onClick={onNewDM} className="h-8 w-8">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 bg-muted/50"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Organization Chat */}
          {orgChat && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wide">
                Channels
              </p>
              <button
                onClick={() => onSelect(orgChat.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  selectedId === orgChat.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate">Organization Chat</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {orgChat.participants?.length || 0} members
                  </p>
                </div>
                {(orgChat.unread_count ?? 0) > 0 && (
                  <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center p-0 text-xs">
                    {orgChat.unread_count}
                  </Badge>
                )}
              </button>
            </div>
          )}

          {/* Group Chats */}
          {groupChats.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wide">
                Groups
              </p>
              {groupChats.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    selectedId === conv.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium truncate">{conv.name}</p>
                    {conv.last_message && (
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.last_message.content || 'Attachment'}
                      </p>
                    )}
                  </div>
                  {conv.last_message && (
                    <span className="text-xs text-muted-foreground">
                      {formatTime(conv.last_message.created_at)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Direct Messages */}
          {directMessages.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wide">
                Direct Messages
              </p>
              {directMessages.map(conv => {
                const otherParticipant = conv.participants?.find(p => p.id !== user?.id);
                return (
                  <div
                    key={conv.id}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors group cursor-pointer ${
                      selectedId === conv.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                    }`}
                    onClick={() => onSelect(conv.id)}
                  >
                    <Avatar className={`h-10 w-10 ${getAvatarColor(otherParticipant?.role)}`}>
                      <AvatarFallback className="bg-transparent text-sm font-medium">
                        {getInitials(otherParticipant?.name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium truncate">{otherParticipant?.name || 'Unknown'}</p>
                        {getRoleIcon(otherParticipant?.role)}
                      </div>
                      {conv.last_message && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.last_message.content || 'Attachment'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end gap-1">
                        {conv.last_message && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(conv.last_message.created_at)}
                          </span>
                        )}
                        {(conv.unread_count ?? 0) > 0 && (
                          <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center p-0 text-xs">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                      {onDeleteConversation && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDeleteClick(e, conv.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredConversations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? All messages will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
