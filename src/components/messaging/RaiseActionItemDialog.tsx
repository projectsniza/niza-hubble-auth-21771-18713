import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ACTION_MODULES } from './hooks/useActionItems';
import type { UserProfile } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: UserProfile[];
  defaultAssignee?: string;
  quotedMessage?: string | null;
  onSubmit: (payload: {
    assigned_to: string;
    title: string;
    details?: string;
    moduleKey: string;
    reference_date?: string | null;
    due_date?: string | null;
  }) => Promise<boolean>;
}

export default function RaiseActionItemDialog({
  open,
  onOpenChange,
  participants,
  defaultAssignee,
  quotedMessage,
  onSubmit,
}: Props) {
  const { user } = useAuth();
  const [extraAssignees, setExtraAssignees] = useState<UserProfile[]>([]);
  const [assignedTo, setAssignedTo] = useState(defaultAssignee || '');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [moduleKey, setModuleKey] = useState(ACTION_MODULES[0].key);
  const [referenceDate, setReferenceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
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
        console.error('Error fetching assignees for dialog:', err);
      }
    };

    fetchAdminsAndStores();
  }, [open]);

  // Combined and sorted assignees list
  const assignableUsers = (() => {
    const map = new Map<string, UserProfile>();
    participants.forEach(p => {
      if (p.id !== user?.id) map.set(p.id, p);
    });
    extraAssignees.forEach(u => {
      if (u.id !== user?.id && !map.has(u.id)) {
        map.set(u.id, u);
      }
    });
    const list = Array.from(map.values());
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
  })();

  useEffect(() => {
    if (open) {
      setAssignedTo(defaultAssignee || '');
      setTitle('');
      setDetails(quotedMessage ? `Ref: ${quotedMessage}` : '');
      setModuleKey(ACTION_MODULES[0].key);
      setReferenceDate('');
      setDueDate('');
    }
  }, [open, defaultAssignee, quotedMessage]);

  const handleSubmit = async () => {
    if (!assignedTo) return toast.error('Select who must action this');
    if (!title.trim()) return toast.error('Enter what needs to be done');

    setSaving(true);
    const ok = await onSubmit({
      assigned_to: assignedTo,
      title: title.trim(),
      details: details.trim() || undefined,
      moduleKey,
      reference_date: referenceDate || null,
      due_date: dueDate || null,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise Action Item</DialogTitle>
          <DialogDescription>
            Tag a store or administrator and request an action. They receive an "Action Required" popup with a
            direct link to the module.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select a store / admin / user" />
              </SelectTrigger>
              <SelectContent>
                {assignableUsers.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.role ? `(${p.role === 'super_admin' ? 'Super Admin' : p.role === 'manager' ? 'Store' : p.role})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>What needs to be done</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Missing invoice upload"
            />
          </div>

          <div className="space-y-2">
            <Label>Module / sidebar section</Label>
            <Select value={moduleKey} onValueChange={setModuleKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_MODULES.map(m => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date concerned (optional)</Label>
              <Input type="date" value={referenceDate} onChange={e => setReferenceDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Due by (optional)</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Explanation</Label>
            <Textarea
              rows={3}
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="e.g. Invoice missing for 02/09/2026 in Daily Reports"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Raising...' : 'Raise Action Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
