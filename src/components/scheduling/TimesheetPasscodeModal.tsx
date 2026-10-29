import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { KeyRound, ShieldCheck, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { verifyTimesheetPasscode } from '@/lib/timesheetSecurity';
import { toast } from 'sonner';

interface TimesheetPasscodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export function TimesheetPasscodeModal({
  open,
  onOpenChange,
  onSuccess,
  title = 'Timesheet & Rota Passcode Authorization',
  description = 'Enter the Super Admin security passcode to unlock store weekly timesheets and rota scheduling.',
}: TimesheetPasscodeModalProps) {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPasscode('');
      setErrorMessage(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [open]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passcode.trim()) {
      setErrorMessage('Please enter the passcode');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await verifyTimesheetPasscode(passcode.trim());

      if (!res.success || !res.verified) {
        setErrorMessage(res.error || 'Incorrect passcode. Please try again.');
        inputRef.current?.select();
        return;
      }

      toast.success('Timesheets & Rota unlocked successfully');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error verifying passcode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center ring-1 ring-amber-500/25 shrink-0">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                {title}
              </DialogTitle>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary mt-1">
                <ShieldCheck className="h-3 w-3" />
                Protected Module
              </div>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="timesheet-passcode-input" className="text-xs font-semibold text-foreground">
              Passcode
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <Lock className="h-4 w-4" />
              </div>
              <Input
                id="timesheet-passcode-input"
                ref={inputRef}
                type={showPasscode ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={loading}
                placeholder="Enter passcode..."
                className="pl-9 pr-10 text-center tracking-widest font-mono text-base font-bold h-11"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-2 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="leading-tight">{errorMessage}</p>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="sm:flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !passcode.trim()}
              className="sm:flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Unlock Timesheets'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

