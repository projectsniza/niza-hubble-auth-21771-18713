import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Check,
  Building2,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useActionItemsGlobal } from '@/contexts/ActionItemsContext';
import type { ActionItem } from './hooks/useActionItems';

interface Props {
  items?: ActionItem[];
  onAcknowledge?: (id: string) => void;
  onMarkDone?: (id: string, note?: string) => void;
}

export default function ActionRequiredPopup({ items: propsItems, onAcknowledge: propsOnAcknowledge }: Props) {
  const globalContext = useActionItemsGlobal();
  const navigate = useNavigate();

  const myOpenItems = propsItems ?? globalContext.myOpenItems;
  const popupOpen = globalContext.popupOpen;
  const closePopup = globalContext.closePopup;
  const snoozeItem = globalContext.snoozeItem;
  const markDone = globalContext.markDone;
  const acknowledge = propsOnAcknowledge ?? globalContext.acknowledge;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If activePopupItem is specified in context, find its index
  useEffect(() => {
    if (globalContext.activePopupItem) {
      const idx = myOpenItems.findIndex(i => i.id === globalContext.activePopupItem?.id);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [globalContext.activePopupItem, myOpenItems]);

  const currentItem = myOpenItems[currentIndex] || myOpenItems[0];

  if (!currentItem || myOpenItems.length === 0) return null;

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % myOpenItems.length);
    setShowNoteInput(false);
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + myOpenItems.length) % myOpenItems.length);
    setShowNoteInput(false);
  };

  const handleDone = async () => {
    setSubmitting(true);
    await markDone(currentItem.id, completionNote.trim() || undefined);
    setSubmitting(false);
    setShowNoteInput(false);
    setCompletionNote('');
    if (myOpenItems.length <= 1) {
      closePopup();
    } else {
      setCurrentIndex(0);
    }
  };

  const handleGoToModule = () => {
    acknowledge(currentItem.id);
    closePopup();
    navigate(currentItem.module_route || '/dashboard');
  };

  const handleLater = () => {
    snoozeItem(currentItem.id);
  };

  return (
    <Dialog open={popupOpen} onOpenChange={open => !open && handleLater()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border border-amber-500/30 shadow-2xl rounded-2xl bg-card">
        {/* Top colored highlight bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-primary" />

        <div className="p-6 space-y-4">
          <DialogHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-inner">
                  <AlertTriangle className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    Action Required
                    <Badge variant="destructive" className="text-[10px] uppercase font-bold py-0 h-4">
                      Pending
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Action item assigned to you from Messages. Complete or mark as done to dismiss.
                  </DialogDescription>
                </div>
              </div>

              {myOpenItems.length > 1 && (
                <div className="flex items-center gap-1 bg-muted/60 px-2 py-1 rounded-lg text-xs font-medium">
                  <button
                    onClick={handlePrev}
                    className="p-0.5 hover:bg-background rounded"
                    title="Previous"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span>
                    {currentIndex + 1} / {myOpenItems.length}
                  </span>
                  <button
                    onClick={handleNext}
                    className="p-0.5 hover:bg-background rounded"
                    title="Next"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Item details card */}
          <div className="rounded-xl border border-border/70 bg-gradient-to-b from-muted/30 to-muted/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold px-2.5 py-0.5">
                  <Layers className="h-3 w-3 mr-1" />
                  Module: {currentItem.module_label || 'General'}
                </Badge>
                {currentItem.due_date && (
                  <Badge variant="outline" className="text-xs border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-medium">
                    <Calendar className="h-3 w-3 mr-1" />
                    Due: {format(new Date(currentItem.due_date), 'dd/MM/yyyy')}
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(currentItem.created_at), 'dd MMM yyyy, HH:mm')}
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-foreground leading-snug">
                {currentItem.title}
              </h3>
              {currentItem.details && (
                <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap bg-background/80 p-3 rounded-lg border border-border/50 max-h-48 overflow-y-auto">
                  {currentItem.details}
                </div>
              )}
            </div>

            {/* Inline Note for Mark as Done */}
            {showNoteInput && (
              <div className="space-y-2 pt-2 border-t border-border/50 animate-in fade-in slide-in-from-top-1">
                <p className="text-xs font-medium text-foreground">Completion Note (optional):</p>
                <Textarea
                  rows={2}
                  value={completionNote}
                  onChange={e => setCompletionNote(e.target.value)}
                  placeholder="e.g. Uploaded missing invoices for 02/09/2026 into Daily Sales"
                  className="text-xs resize-none"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto text-xs font-semibold h-9 px-4 rounded-xl border border-border/80 shadow-xs hover:bg-muted text-foreground gap-1.5 cursor-pointer"
            onClick={handleLater}
          >
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            Remind Later
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!showNoteInput ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-xs font-medium border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => setShowNoteInput(true)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Mark as Done
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full sm:w-auto text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={submitting}
                onClick={handleDone}
              >
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Confirm Done
              </Button>
            )}

            <Button
              size="sm"
              className="w-full sm:w-auto text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              onClick={handleGoToModule}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Go to {currentItem.module_label || 'Module'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
