import React, { useState } from 'react';
import { useDueFollowUps } from '@/contexts/DueFollowUpsContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Bell, 
  Clock, 
  BellOff, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  User, 
  Building, 
  MapPin, 
  Eye, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  X
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

export default function ReminderDuePopup() {
  const {
    isPopupOpen,
    setIsPopupOpen,
    currentItemIndex,
    setCurrentItemIndex,
    snoozeItem,
    snoozeAll,
    acknowledgeItem,
    acknowledgeAll,
    completeItem,
    viewDocument,
    reviewItemsList,
    items,
  } = useDueFollowUps();

  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeAllOpen, setSnoozeAllOpen] = useState(false);

  const displayList = reviewItemsList.length > 0 ? reviewItemsList : items;

  if (!isPopupOpen || displayList.length === 0) return null;

  const current = displayList[currentItemIndex] || displayList[0];
  if (!current) return null;

  const now = new Date();
  const dueDate = parseISO(current.due_date);
  const isOverdue = current.sourceType === 'document_overdue';
  const isUpcoming = current.sourceType === 'document_upcoming';
  const empName = current.employee 
    ? `${current.employee.first_name || ''} ${current.employee.last_name || ''}`.trim()
    : null;

  const handlePrev = () => {
    setCurrentItemIndex(Math.max(0, currentItemIndex - 1));
  };

  const handleNext = () => {
    setCurrentItemIndex(Math.min(displayList.length - 1, currentItemIndex + 1));
  };

  const handleSnoozeCurrent = (until: Date) => {
    snoozeItem(current, until);
    setSnoozeOpen(false);
  };

  const handleSnoozeAll = (until: Date) => {
    snoozeAll(until);
    setSnoozeAllOpen(false);
  };

  return (
    <Dialog open={isPopupOpen} onOpenChange={(open) => !open && setIsPopupOpen(false)}>
      <DialogContent className="max-w-[94vw] sm:max-w-xl md:max-w-2xl p-0 overflow-hidden border shadow-2xl rounded-2xl bg-card">
        {/* Top Highlight Banner */}
        <div className={`p-4 sm:p-5 flex items-start justify-between gap-3 border-b ${
          isOverdue 
            ? 'bg-red-500/10 border-red-200 dark:border-red-900/50' 
            : isUpcoming
            ? 'bg-amber-500/10 border-amber-200 dark:border-amber-900/50'
            : 'bg-primary/10 border-primary/20'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
              isOverdue 
                ? 'bg-red-600 text-white' 
                : isUpcoming
                ? 'bg-amber-600 text-white'
                : 'bg-primary text-primary-foreground'
            }`}>
              {isOverdue ? (
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : isUpcoming ? (
                <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : (
                <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  {isOverdue 
                    ? 'Document Overdue' 
                    : isUpcoming
                    ? 'Upcoming Document Follow-up'
                    : 'Reminder Task Due'}
                </DialogTitle>
                <Badge 
                  variant={isOverdue ? 'destructive' : isUpcoming ? 'secondary' : 'default'} 
                  className="text-[10px] px-1.5 py-0 h-4 uppercase font-bold"
                >
                  {isOverdue ? 'Action Required' : isUpcoming ? 'Upcoming' : 'Task'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {isOverdue 
                  ? 'Expired or overdue follow-up requiring immediate review' 
                  : isUpcoming
                  ? 'Upcoming expiration / review date requiring attention'
                  : 'Scheduled task alert'}
              </p>
            </div>
          </div>

          {/* Top Right: Snooze All button, Dismiss All & Close Button */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {displayList.length > 1 && (
              <Badge variant="outline" className="text-[11px] font-semibold bg-background/80 px-2 py-0.5 hidden xs:inline-flex">
                {currentItemIndex + 1} of {displayList.length}
              </Badge>
            )}

            {/* Quick Snooze All Dropdown */}
            <Popover open={snoozeAllOpen} onOpenChange={setSnoozeAllOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 rounded-lg border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-medium"
                  title="Snooze all open items and dismiss popup"
                >
                  <Clock className="h-3 w-3" />
                  <span>Snooze All</span>
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-1.5 text-xs space-y-0.5 rounded-xl shadow-xl">
                <div className="px-2 py-1 font-semibold text-[11px] text-muted-foreground border-b mb-1">
                  Snooze all {displayList.length} items:
                </div>
                <button
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg"
                  onClick={() => handleSnoozeAll(addMinutes(now, 15))}
                >
                  15 minutes
                </button>
                <button
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg"
                  onClick={() => handleSnoozeAll(addHours(now, 1))}
                >
                  1 hour
                </button>
                <button
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg font-medium text-primary"
                  onClick={() => handleSnoozeAll(addHours(now, 3))}
                >
                  3 hours (Recommended)
                </button>
                <button
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg"
                  onClick={() => handleSnoozeAll(setMinutes(setHours(startOfTomorrow(), 9), 0))}
                >
                  Tomorrow 9:00 AM
                </button>
                <button
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg"
                  onClick={() => handleSnoozeAll(addDays(now, 7))}
                >
                  7 days
                </button>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1 rounded-lg border-border text-muted-foreground hover:text-foreground hidden sm:inline-flex"
              onClick={acknowledgeAll}
              title="Dismiss all items for this session"
            >
              <BellOff className="h-3 w-3" />
              <span>Dismiss All</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => setIsPopupOpen(false)}
              title="Close popup"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Body with Rich Details */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Main Title & File Name */}
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">{current.title}</h3>
            {current.document?.file_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="break-all">{current.document.file_name}</span>
              </p>
            )}
            {current.description && !current.document && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed pt-1">
                {current.description}
              </p>
            )}
          </div>

          {/* Employee Details Card */}
          {empName && (
            <div className="bg-slate-50 dark:bg-slate-900/60 border rounded-xl p-3 sm:p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-foreground flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-primary" />
                  {empName}
                </span>
                {current.employee?.email && (
                  <span className="text-[11px] text-muted-foreground truncate">{current.employee.email}</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1.5 border-t">
                {current.employee?.organizations?.name && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Building className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate">{current.employee.organizations.name}</span>
                  </div>
                )}
                {current.employee?.branches?.name && (
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate">{current.employee.branches.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline & Schedule Dates */}
          <div className="space-y-2 bg-muted/40 rounded-xl p-3 sm:p-3.5 border text-xs">
            {current.document?.expiry_date && (
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-destructive" />
                  Expiry Date:
                </span>
                <span className="font-semibold text-foreground">
                  {format(new Date(current.document.expiry_date), 'dd MMM yyyy')}
                  <span className="text-muted-foreground text-[11px] ml-1.5">
                    ({formatDistanceToNow(new Date(current.document.expiry_date), { addSuffix: true })})
                  </span>
                </span>
              </div>
            )}
            {current.document?.follow_up_date && (
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  Follow-up Date:
                </span>
                <span className="font-semibold text-foreground">
                  {format(new Date(current.document.follow_up_date), 'dd MMM yyyy, p')}
                </span>
              </div>
            )}
            {!current.document && (
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Scheduled for:
                </span>
                <span className="font-semibold text-foreground">{format(dueDate, 'PPpp')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions with Full Wrap Safety & No Cutoffs */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/40 border-t flex flex-wrap items-center justify-between gap-2.5">
          {/* Left Action: View Document button */}
          <div className="flex items-center gap-1.5">
            {current.document?.file_path && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => viewDocument(current)} 
                className="gap-1.5 text-xs h-9 px-3"
              >
                <Eye className="h-3.5 w-3.5 text-primary" />
                View Document
              </Button>
            )}

            {displayList.length > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onClick={handlePrev}
                  disabled={currentItemIndex === 0}
                  title="Previous item"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onClick={handleNext}
                  disabled={currentItemIndex === displayList.length - 1}
                  title="Next item"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Right Actions: Snooze, Acknowledge, Mark Complete */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Popover open={snoozeOpen} onOpenChange={setSnoozeOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 px-3 font-medium border-border">
                  <Clock className="h-3.5 w-3.5" /> 
                  <span>Snooze</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-1.5 text-xs space-y-0.5 rounded-xl shadow-xl">
                <div className="px-2 py-1 font-semibold text-[11px] text-muted-foreground border-b mb-1">
                  Snooze this item:
                </div>
                <button 
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors" 
                  onClick={() => handleSnoozeCurrent(addMinutes(now, 15))}
                >
                  15 minutes
                </button>
                <button 
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors" 
                  onClick={() => handleSnoozeCurrent(addHours(now, 1))}
                >
                  1 hour
                </button>
                <button 
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors font-medium text-primary" 
                  onClick={() => handleSnoozeCurrent(addHours(now, 3))}
                >
                  3 hours
                </button>
                <button 
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors" 
                  onClick={() => handleSnoozeCurrent(setMinutes(setHours(startOfTomorrow(), 9), 0))}
                >
                  Tomorrow 9:00 AM
                </button>
                <button 
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors" 
                  onClick={() => handleSnoozeCurrent(addDays(now, 7))}
                >
                  7 days
                </button>
              </PopoverContent>
            </Popover>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => acknowledgeItem(current)} 
              className="gap-1.5 text-xs h-9 px-3 border-border"
            >
              <BellOff className="h-3.5 w-3.5" /> 
              Dismiss
            </Button>

            <Button 
              size="sm" 
              onClick={() => completeItem(current)} 
              className="gap-1.5 text-xs h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex-shrink-0 whitespace-nowrap shadow-sm"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> 
              Mark Complete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
