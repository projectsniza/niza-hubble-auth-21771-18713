import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useActionItemsGlobal } from '@/contexts/ActionItemsContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  ClipboardList,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Clock,
  Calendar,
  AlertCircle,
  Check,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { format } from 'date-fns';

const statusStyles: Record<string, string> = {
  open: 'bg-destructive/10 text-destructive border-destructive/20',
  acknowledged: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  closed: 'bg-muted text-muted-foreground border-border/50',
};

export default function ActionItemsHeaderWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    myOpenItems,
    raisedByMe,
    openCount,
    markDone,
    acknowledge,
    closeAction,
    openPopup,
  } = useActionItemsGlobal();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'todo' | 'raised'>('todo');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Available for authenticated users (superadmin, hr, manager/store)
  if (!user) return null;

  const handleMarkDone = async (id: string) => {
    setSubmitting(true);
    await markDone(id, completionNote.trim() || undefined);
    setSubmitting(false);
    setCompletingId(null);
    setCompletionNote('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`relative h-9 px-2.5 sm:px-3 rounded-xl gap-2 font-medium transition-all ${
            openCount > 0
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-300/60 dark:border-amber-800/50 shadow-xs ring-1 ring-amber-400/20'
              : 'hover:bg-accent text-muted-foreground'
          }`}
          title={
            openCount > 0
              ? `${openCount} Action Item${openCount > 1 ? 's' : ''} requiring your action`
              : 'Action Items'
          }
        >
          <div className="relative">
            <ClipboardList className={`h-4 w-4 ${openCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
            {openCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
          </div>

          <span className="hidden sm:inline text-xs font-semibold">Action Items</span>

          {openCount > 0 && (
            <Badge
              variant="secondary"
              className="h-5 min-w-[20px] px-1.5 text-[11px] font-bold rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
            >
              {openCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] sm:w-[420px] p-0 shadow-2xl rounded-2xl border-border/80 backdrop-blur-xl bg-card/95"
      >
        <div className="p-3.5 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <ClipboardList className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground leading-tight">Action Items</h4>
              <p className="text-[11px] text-muted-foreground">Tagged tasks from Messages & Stores</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {openCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5 rounded-lg border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                onClick={() => {
                  setOpen(false);
                  openPopup();
                }}
              >
                <AlertCircle className="h-3 w-3 mr-1" />
                View Popup
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-primary"
              onClick={() => {
                setOpen(false);
                navigate('/dashboard/messages');
              }}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Messages
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'todo' | 'raised')}>
          <div className="px-3 pt-2">
            <TabsList className="w-full grid grid-cols-2 h-8">
              <TabsTrigger value="todo" className="text-xs">
                To Do ({myOpenItems.length})
              </TabsTrigger>
              <TabsTrigger value="raised" className="text-xs">
                Raised by Me ({raisedByMe.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TO DO LIST */}
          <TabsContent value="todo" className="m-0 p-0">
            <ScrollArea className="max-h-[380px] min-h-[160px]">
              <div className="p-3 space-y-2.5">
                {myOpenItems.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground space-y-1">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500/80 mb-2" />
                    <p className="text-sm font-medium">All caught up!</p>
                    <p className="text-xs">No pending action items assigned to you.</p>
                  </div>
                ) : (
                  myOpenItems.map(item => (
                    <div
                      key={item.id}
                      className="border rounded-xl p-3 bg-background/60 hover:bg-accent/30 transition-all space-y-2 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] py-0 px-2 font-semibold bg-primary/5 text-primary border-primary/20">
                              {item.module_label || 'General'}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] py-0 px-2 capitalize ${statusStyles[item.status]}`}>
                              {item.status}
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold text-foreground leading-snug pt-0.5">
                            {item.title}
                          </p>
                        </div>
                      </div>

                      {item.details && (
                        <p className="text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-3 bg-muted/40 p-2 rounded-lg border border-border/40">
                          {item.details}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(item.created_at), 'dd MMM, HH:mm')}
                        </span>
                        {item.due_date && (
                          <span className="flex items-center gap-1 text-destructive font-medium">
                            <Calendar className="h-3 w-3" />
                            Due: {format(new Date(item.due_date), 'dd/MM/yyyy')}
                          </span>
                        )}
                      </div>

                      {/* Inline complete note if selected */}
                      {completingId === item.id ? (
                        <div className="space-y-2 pt-1 border-t border-border/40">
                          <Textarea
                            rows={2}
                            value={completionNote}
                            onChange={e => setCompletionNote(e.target.value)}
                            placeholder="Add completion note (optional)..."
                            className="text-xs resize-none"
                            autoFocus
                          />
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs px-2"
                              onClick={() => {
                                setCompletingId(null);
                                setCompletionNote('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={submitting}
                              onClick={() => handleMarkDone(item.id)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Confirm Done
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5 rounded-lg flex-1 justify-center"
                            onClick={() => {
                              setOpen(false);
                              navigate(item.module_route || '/dashboard');
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1.5" />
                            Open {item.module_label || 'Module'}
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex-1 justify-center"
                            onClick={() => {
                              setCompletingId(item.id);
                              setCompletionNote('');
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1.5" />
                            Mark Done
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* RAISED BY ME LIST */}
          <TabsContent value="raised" className="m-0 p-0">
            <ScrollArea className="max-h-[380px] min-h-[160px]">
              <div className="p-3 space-y-2.5">
                {raisedByMe.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground space-y-1">
                    <Send className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm font-medium">No action items raised yet</p>
                    <p className="text-xs">Use the tag dropdown in Messages to raise action items.</p>
                  </div>
                ) : (
                  raisedByMe.map(item => (
                    <div
                      key={item.id}
                      className="border rounded-xl p-3 bg-background/60 hover:bg-accent/30 transition-all space-y-2 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] py-0 px-2 font-semibold bg-primary/5 text-primary border-primary/20">
                              {item.module_label || 'General'}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] py-0 px-2 capitalize ${statusStyles[item.status]}`}>
                              {item.status}
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold text-foreground leading-snug pt-0.5">
                            {item.title}
                          </p>
                        </div>
                      </div>

                      {item.details && (
                        <p className="text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-2 bg-muted/40 p-2 rounded-lg border border-border/40">
                          {item.details}
                        </p>
                      )}

                      {item.completion_note && (
                        <div className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-1.5 rounded-md border border-emerald-500/20">
                          <strong>Completed note:</strong> {item.completion_note}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(item.created_at), 'dd MMM yyyy')}
                        </span>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-2 text-primary"
                            onClick={() => {
                              setOpen(false);
                              navigate(item.module_route || '/dashboard');
                            }}
                          >
                            <ExternalLink className="h-2.5 w-2.5 mr-1" />
                            Module
                          </Button>
                          {item.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 text-[10px] px-2"
                              onClick={() => closeAction(item.id)}
                            >
                              Close
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
