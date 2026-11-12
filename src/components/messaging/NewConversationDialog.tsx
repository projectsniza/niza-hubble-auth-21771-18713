import { useState, useEffect, useMemo } from 'react';
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
import {
  Search,
  Shield,
  Building2,
  UserCog,
  MessageSquare,
  User,
  Store,
  X,
  UserPlus,
} from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile } from './types';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateDM: (userId: string) => Promise<string | null>;
}

type RoleFilter = 'all' | 'managers' | 'admins' | 'employees';

export default function NewConversationDialog({
  open,
  onOpenChange,
  onCreateDM,
}: NewConversationDialogProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchUsers();
      setSearch('');
      setRoleFilter('all');
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

      // Fetch employee branch/store mapping for richer context
      const branchMap = new Map<string, string>();
      try {
        const { data: emps } = await supabase
          .from('employees')
          .select('user_id, branch:branches(name)')
          .not('user_id', 'is', null);

        if (emps) {
          emps.forEach((e: any) => {
            const bName = (e.branch as any)?.name;
            if (e.user_id && bName) {
              branchMap.set(e.user_id, bName);
            }
          });
        }
      } catch (err) {
        console.error('Error fetching employee branches:', err);
      }

      const enrichedUsers: UserProfile[] = (profiles || []).map(p => ({
        id: p.id,
        name: p.name || 'Team Member',
        email: p.email || '',
        role: roleMap.get(p.id),
        branchName: branchMap.get(p.id) || undefined,
      }));

      setUsers(enrichedUsers);
    } catch (error) {
      console.error('Error fetching users for messaging:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

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

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return (
          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-destructive/15 text-destructive border-destructive/20 font-bold">
            Super Admin
          </Badge>
        );
      case 'hr':
        return (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/15 text-primary border-primary/20 font-semibold">
            HR
          </Badge>
        );
      case 'manager':
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 font-semibold">
            Store Manager
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
            Staff
          </Badge>
        );
    }
  };

  // Filtered users by search & role
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Role filter
      if (roleFilter === 'admins') {
        if (u.role !== 'super_admin' && u.role !== 'hr') return false;
      } else if (roleFilter === 'managers') {
        if (u.role !== 'manager') return false;
      } else if (roleFilter === 'employees') {
        if (u.role && u.role !== 'employee') return false;
      }

      // Text search
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.branchName && u.branchName.toLowerCase().includes(q))
      );
    });
  }, [users, roleFilter, search]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full max-h-[85vh] p-0 flex flex-col overflow-hidden border shadow-2xl rounded-2xl bg-card">
        {/* Fixed Header */}
        <div className="p-4 sm:p-5 border-b bg-muted/20 flex-shrink-0 space-y-3">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">New Direct Message</DialogTitle>
                <DialogDescription className="text-xs">
                  Choose a colleague, store manager, or administrator to chat with
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by colleague name, email, or store..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs bg-background rounded-xl"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                roleFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('managers')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                roleFilter === 'managers'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              Store Managers
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('admins')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                roleFilter === 'admins'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              Admins & HR
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('employees')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                roleFilter === 'employees'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              Staff
            </button>
          </div>
        </div>

        {/* Scrollable Members List - Native, Smooth Scrolling */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-1 min-h-[220px]">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <NizaLoaderInline />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <User className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-xs font-semibold text-foreground">No team members found</p>
              <p className="text-[11px] opacity-75 max-w-[220px] mx-auto">
                {search
                  ? 'Try searching with another keyword or change your role filter.'
                  : 'No colleagues match the selected category.'}
              </p>
            </div>
          ) : (
            filteredUsers.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelectUser(u.id)}
                disabled={creating !== null}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/70 transition-all text-left border border-transparent hover:border-border/60 disabled:opacity-50 group"
              >
                <Avatar className={`h-9 w-9 border ${getAvatarColor(u.role)}`}>
                  <AvatarFallback className="bg-transparent text-xs font-semibold">
                    {getInitials(u.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                      {u.name}
                    </p>
                    {getRoleIcon(u.role)}
                    {getRoleBadge(u.role)}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate mt-0.5">
                    {u.branchName && (
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium truncate">
                        <Store className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{u.branchName}</span>
                      </span>
                    )}
                    {u.branchName && <span className="opacity-50">•</span>}
                    <span className="truncate">{u.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Chat</span>
                  <UserPlus className="h-3.5 w-3.5" />
                </div>

                {creating === u.id && (
                  <div className="h-4 w-4 animate-spin border-2 border-primary border-t-transparent rounded-full flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-muted/20 border-t flex items-center justify-between text-xs text-muted-foreground flex-shrink-0">
          <span>{filteredUsers.length} colleague{filteredUsers.length !== 1 ? 's' : ''} available</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs rounded-lg"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
