import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDueFollowUps, DueItem } from '@/contexts/DueFollowUpsContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  Clock, 
  Calendar, 
  CalendarClock, 
  CheckCircle2, 
  Eye, 
  FileText, 
  User, 
  Building, 
  MapPin, 
  ChevronRight, 
  Layers, 
  BellOff, 
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { 
  addMinutes, 
  addHours, 
  addDays, 
  startOfTomorrow, 
  setHours, 
  setMinutes, 
  format, 
  formatDistanceToNow, 
  parseISO 
} from 'date-fns';

export default function OpenItemsHeaderWidget() {
  const navigate = useNavigate();
  const {
    items,
    overdueItems,
    upcomingItems,
    reminderItems,
    totalCount,
    overdueCount,
    upcomingCount,
    loading,
    refetch,
    snoozeAll,
    snoozeItem,
    acknowledgeItem,
    acknowledgeAll,
    completeItem,
    viewDocument,
    openReviewModal,
  } = useDueFollowUps();

  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'upcoming' | 'tasks'>('all');
  const [snoozeAllOpen, setSnoozeAllOpen] = useState(false);

  const now = new Date();

  const filteredItems = items.filter((item) => {
    if (activeFilter === 'overdue') return item.sourceType === 'document_overdue';
    if (activeFilter === 'upcoming') return item.sourceType === 'document_upcoming';
    if (activeFilter === 'tasks') return item.sourceType === 'reminder';
    return true;
  });

  const handleQuickSnoozeAll = (until: Date) => {
    snoozeAll(until);
    setSnoozeAllOpen(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`relative h-9 px-2.5 sm:px-3 rounded-xl gap-2 font-medium transition-all ${
            overdueCount > 0
              ? 'bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 border border-red-200/60 dark:border-red-900/50'
              : totalCount > 0
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-200/60 dark:border-amber-900/50'
              : 'hover:bg-accent text-muted-foreground'
          }`}
          title={
            totalCount > 0
              ? `${totalCount} open item${totalCount > 1 ? 's' : ''} requiring attention (${overdueCount} overdue, ${upcomingCount} upcoming)`
              : 'No overdue follow-ups or tasks'
          }
        >
          {overdueCount > 0 ? (
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          ) : totalCount > 0 ? (
            <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          ) : (
            <CalendarClock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}

          <span className="hidden sm:inline text-xs font-semibold">
            {overdueCount > 0
              ? `${overdueCount} Overdue`
              : totalCount > 0
              ? `${totalCount} Due`
              : 'Follow-ups'}
          </span>

          {totalCount > 0 && (
            <Badge
              variant={overdueCount > 0 ? 'destructive' : 'secondary'}
              className={`h-5 min-w-[20px] px-1.5 text-[11px] font-bold rounded-full flex items-center justify-center ${
                overdueCount > 0
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              {totalCount > 99 ? '99+' : totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] sm:w-[460px] p-0 rounded-2xl border shadow-2xl bg-card overflow-hidden"
      >
        {/* Header Bar */}
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Open Follow-ups & Reminders</h3>
                <p className="text-[11px] text-muted-foreground">
                  {totalCount === 0
                    ? 'All items are caught up'
                    : `${totalCount} item${totalCount > 1 ? 's' : ''} requiring attention`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => refetch()}
                disabled={loading}
                title="Refresh items"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>

              {totalCount > 0 && (
                <Popover open={snoozeAllOpen} onOpenChange={setSnoozeAllOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1.5 rounded-lg font-medium border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    >
                      <Clock className="h-3 w-3" />
                      Snooze All
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-52 p-1.5 text-xs space-y-0.5 rounded-xl shadow-xl">
                    <div className="px-2 py-1 font-semibold text-[11px] text-muted-foreground border-b mb-1">
                      Snooze all {totalCount} open items:
                    </div>
                    <button
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors"
                      onClick={() => handleQuickSnoozeAll(addMinutes(now, 15))}
                    >
                      15 minutes
                    </button>
                    <button
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors"
                      onClick={() => handleQuickSnoozeAll(addHours(now, 1))}
                    >
                      1 hour
                    </button>
                    <button
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors font-medium text-primary"
                      onClick={() => handleQuickSnoozeAll(addHours(now, 3))}
                    >
                      3 hours (Recommended)
                    </button>
                    <button
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors"
                      onClick={() => handleQuickSnoozeAll(setMinutes(setHours(startOfTomorrow(), 9), 0))}
                    >
                      Tomorrow 9:00 AM
                    </button>
                    <button
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors"
                      onClick={() => handleQuickSnoozeAll(addDays(now, 7))}
                    >
                      7 days
                    </button>
                  </PopoverContent>
                </Popover>
              )}

              {totalCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    acknowledgeAll();
                    setOpen(false);
                  }}
                  title="Dismiss all for current session"
                >
                  <BellOff className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          {totalCount > 0 && (
            <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  activeFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({totalCount})
              </button>

              {overdueCount > 0 && (
                <button
                  onClick={() => setActiveFilter('overdue')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                    activeFilter === 'overdue'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Overdue ({overdueCount})
                </button>
              )}

              {upcomingCount > 0 && (
                <button
                  onClick={() => setActiveFilter('upcoming')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                    activeFilter === 'upcoming'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Upcoming ({upcomingCount})
                </button>
              )}

              {reminderItems.length > 0 && (
                <button
                  onClick={() => setActiveFilter('tasks')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    activeFilter === 'tasks'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20'
                  }`}
                >
                  Tasks ({reminderItems.length})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Item List Scroll Area */}
        <ScrollArea className="max-h-[380px] p-3">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">All caught up!</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">
                {activeFilter === 'all'
                  ? 'No overdue documents or pending follow-ups requiring attention.'
                  : `No items found under ${activeFilter}.`}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredItems.map((item, idx) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onView={() => viewDocument(item)}
                  onComplete={() => completeItem(item)}
                  onAcknowledge={() => acknowledgeItem(item)}
                  onSnooze={(u) => snoozeItem(item, u)}
                  onReviewPopup={() => {
                    setOpen(false);
                    openReviewModal(idx);
                  }}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer actions */}
        <div className="p-3 border-t bg-muted/20 flex items-center justify-between gap-2">
          {totalCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5 rounded-xl flex-1 font-medium"
              onClick={() => {
                setOpen(false);
                openReviewModal(0);
              }}
            >
              <Layers className="h-3.5 w-3.5 text-primary" />
              Step-by-Step Review ({totalCount})
            </Button>
          ) : (
            <div />
          )}

          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 gap-1 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => {
              setOpen(false);
              navigate('/dashboard/documents?tab=submissions');
            }}
          >
            All Documents
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ItemCard({
  item,
  onView,
  onComplete,
  onAcknowledge,
  onSnooze,
  onReviewPopup,
}: {
  item: DueItem;
  itemKey?: string;
  onView: () => void;
  onComplete: () => void;
  onAcknowledge: () => void;
  onSnooze: (until: Date) => void;
  onReviewPopup: () => void;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const now = new Date();
  const isOverdue = item.sourceType === 'document_overdue';
  const isUpcoming = item.sourceType === 'document_upcoming';
  const empName = item.employee
    ? `${item.employee.first_name || ''} ${item.employee.last_name || ''}`.trim()
    : null;

  return (
    <div
      className={`p-3 rounded-xl border transition-all text-xs space-y-2 ${
        isOverdue
          ? 'bg-red-500/5 hover:bg-red-500/10 border-red-200/70 dark:border-red-900/40'
          : isUpcoming
          ? 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-200/70 dark:border-amber-900/40'
          : 'bg-card hover:bg-accent/40 border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant={isOverdue ? 'destructive' : isUpcoming ? 'secondary' : 'default'}
              className="text-[10px] px-1.5 py-0 h-4 uppercase font-bold"
            >
              {isOverdue ? 'Overdue' : isUpcoming ? 'Upcoming' : 'Task'}
            </Badge>
            <span
              onClick={onReviewPopup}
              className="font-semibold text-foreground truncate cursor-pointer hover:underline text-xs"
            >
              {item.title}
            </span>
          </div>

          {item.document?.file_name && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono mt-0.5 truncate">
              <FileText className="h-3 w-3 flex-shrink-0" />
              {item.document.file_name}
            </p>
          )}

          {item.description && !item.document && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
          )}
        </div>

        {/* Quick Date Tag */}
        <div className="text-right flex-shrink-0">
          {item.document?.expiry_date ? (
            <span
              className={`text-[10px] font-semibold block ${
                isOverdue ? 'text-destructive font-bold' : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {format(new Date(item.document.expiry_date), 'dd MMM yyyy')}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground block">
              {format(parseISO(item.due_date), 'dd MMM, HH:mm')}
            </span>
          )}
          <span className="text-[9px] text-muted-foreground block">
            {formatDistanceToNow(parseISO(item.due_date), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Employee Info if document */}
      {empName && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-background/60 rounded-lg px-2 py-1 border border-border/50">
          <span className="flex items-center gap-1 font-medium text-foreground truncate">
            <User className="h-3 w-3 text-primary flex-shrink-0" />
            {empName}
          </span>
          {(item.employee?.branches?.name || item.employee?.organizations?.name) && (
            <span className="truncate text-[10px] ml-1.5 opacity-80">
              {item.employee?.branches?.name || item.employee?.organizations?.name}
            </span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
        <div className="flex items-center gap-1">
          {item.document?.file_path && (
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              className="h-6 px-2 text-[11px] gap-1 rounded-lg"
            >
              <Eye className="h-3 w-3 text-primary" />
              View
            </Button>
          )}

          <Popover open={snoozeOpen} onOpenChange={setSnoozeOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] gap-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <Clock className="h-3 w-3" />
                Snooze
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1.5 text-xs space-y-0.5 rounded-xl shadow-xl">
              <button
                className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded-lg"
                onClick={() => {
                  onSnooze(addMinutes(now, 15));
                  setSnoozeOpen(false);
                }}
              >
                15 minutes
              </button>
              <button
                className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded-lg"
                onClick={() => {
                  onSnooze(addHours(now, 1));
                  setSnoozeOpen(false);
                }}
              >
                1 hour
              </button>
              <button
                className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded-lg font-medium text-primary"
                onClick={() => {
                  onSnooze(addHours(now, 3));
                  setSnoozeOpen(false);
                }}
              >
                3 hours
              </button>
              <button
                className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded-lg"
                onClick={() => {
                  onSnooze(setMinutes(setHours(startOfTomorrow(), 9), 0));
                  setSnoozeOpen(false);
                }}
              >
                Tomorrow 9 AM
              </button>
              <button
                className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded-lg"
                onClick={() => {
                  onSnooze(addDays(now, 7));
                  setSnoozeOpen(false);
                }}
              >
                7 days
              </button>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAcknowledge}
            className="h-6 px-2 text-[11px] rounded-lg text-muted-foreground hover:text-foreground"
            title="Dismiss for session"
          >
            Dismiss
          </Button>

          <Button
            size="sm"
            onClick={onComplete}
            className="h-6 px-2.5 text-[11px] gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
          >
            <CheckCircle2 className="h-3 w-3" />
            Complete
          </Button>
        </div>
      </div>
    </div>
  );
}
