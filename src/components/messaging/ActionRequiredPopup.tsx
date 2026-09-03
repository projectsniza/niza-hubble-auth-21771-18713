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
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { ActionItem } from './hooks/useActionItems';

interface Props {
  items: ActionItem[];
  onAcknowledge: (id: string) => void;
}

export default function ActionRequiredPopup({ items, onAcknowledge }: Props) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const navigate = useNavigate();

  const pending = items.filter(i => i.status === 'open' && !dismissed.includes(i.id));
  const current = pending[0];

  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(Boolean(current));
  }, [current?.id]);

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Action Required
          </DialogTitle>
          <DialogDescription>
            You have been tagged in Messages with an action to complete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-base font-semibold">{current.title}</p>
          {current.details && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{current.details}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{current.module_label}</Badge>
            {current.reference_date && (
              <Badge variant="outline">Date: {format(new Date(current.reference_date), 'dd/MM/yyyy')}</Badge>
            )}
            {current.due_date && (
              <Badge variant="outline">Due: {format(new Date(current.due_date), 'dd/MM/yyyy')}</Badge>
            )}
          </div>
          {pending.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {pending.length - 1} more action item(s) pending.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setDismissed(prev => [...prev, current.id]);
              setOpen(false);
            }}
          >
            Later
          </Button>
          <Button
            onClick={() => {
              onAcknowledge(current.id);
              setDismissed(prev => [...prev, current.id]);
              setOpen(false);
              navigate(current.module_route);
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Go to {current.module_label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
