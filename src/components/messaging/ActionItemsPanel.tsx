import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, ClipboardList, ExternalLink, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { ActionItem } from './hooks/useActionItems';
import type { UserProfile } from './types';

interface Props {
  items: ActionItem[];
  participants: UserProfile[];
  onRaise: () => void;
  onUpdateStatus: (id: string, status: ActionItem['status'], extra?: { completion_note?: string }) => Promise<boolean>;
  onClose: () => void;
}

const statusStyles: Record<string, string> = {
  open: 'bg-destructive/10 text-destructive',
  acknowledged: 'bg-amber-500/10 text-amber-600',
  completed: 'bg-primary/10 text-primary',
  closed: 'bg-muted text-muted-foreground',
};

export default function ActionItemsPanel({ items, participants, onRaise, onUpdateStatus, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const nameOf = (id: string) => participants.find(p => p.id === id)?.name || 'Unknown';
  const canClose = user?.role === 'super_admin' || user?.role === 'hr';

  return (
    <div className="w-80 border-l flex flex-col bg-background">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Action Items</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRaise} title="Raise action item">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              No action items in this conversation yet.
            </p>
          )}

          {items.map(item => {
            const isAssignee = item.assigned_to === user?.id;
            return (
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  <Badge className={statusStyles[item.status]} variant="secondary">
                    {item.status}
                  </Badge>
                </div>

                {item.details && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{item.details}</p>
                )}

                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Module: {item.module_label}</p>
                  <p>For: {nameOf(item.assigned_to)} · Raised by {nameOf(item.raised_by)}</p>
                  {item.reference_date && <p>Date concerned: {format(new Date(item.reference_date), 'dd/MM/yyyy')}</p>}
                  {item.due_date && <p>Due: {format(new Date(item.due_date), 'dd/MM/yyyy')}</p>}
                  {item.completed_at && (
                    <p>Completed: {format(new Date(item.completed_at), 'dd/MM/yyyy HH:mm')}</p>
                  )}
                  {item.completion_note && <p>Note: {item.completion_note}</p>}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => navigate(item.module_route)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open module
                  </Button>

                  {isAssignee && (item.status === 'open' || item.status === 'acknowledged') && (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setNoteFor(item.id);
                        setNote('');
                      }}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Mark done
                    </Button>
                  )}

                  {canClose && item.status === 'completed' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs"
                      onClick={() => onUpdateStatus(item.id, 'closed')}
                    >
                      Close action
                    </Button>
                  )}
                </div>

                {noteFor === item.id && (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      rows={2}
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="What did you do? (optional)"
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={async () => {
                          const ok = await onUpdateStatus(item.id, 'completed', { completion_note: note });
                          if (ok) setNoteFor(null);
                        }}
                      >
                        Submit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setNoteFor(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
