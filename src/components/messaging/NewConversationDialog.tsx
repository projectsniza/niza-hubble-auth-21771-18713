import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Shield, Building2, UserCog, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile } from './types';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateDM: (userId: string) => Promise<string | null>;
}

export default function NewConversationDialog({
  open,
  onOpenChange,
  onCreateDM,
}: NewConversationDialogProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .neq('id', user?.id)
        .order('name');

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const enrichedUsers: UserProfile[] = (profiles || []).map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: roleMap.get(p.id),
      }));

      setUsers(enrichedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

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

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return (
          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20">
            Admin
          </Badge>
        );
      case 'hr':
        return (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            HR
          </Badge>
        );
      case 'manager':
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            Store
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            Employee
          </Badge>
        );
    }
  };

  const handleSelectUser = async (targetUserId: string) => {
    setCreating(targetUserId);
    try {
      const conversationId = await onCreateDM(targetUserId);
      if (conversationId) {
        onOpenChange(false);
      }
    } finally {
      setCreating(null);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true;
    return (
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            New Conversation
          </DialogTitle>
          <DialogDescription>Start a direct message with a team member</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-80">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No users found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u.id)}
                  disabled={creating !== null}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Avatar className={`h-10 w-10 ${getAvatarColor(u.role)}`}>
                    <AvatarFallback className="bg-transparent text-sm font-medium">
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{u.name}</p>
                      {getRoleIcon(u.role)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  {getRoleBadge(u.role)}
                  {creating === u.id && <Loader2 className="h-4 w-4 animate-spin" />}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
