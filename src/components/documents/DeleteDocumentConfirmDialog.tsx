import React from 'react';
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
import {
  AlertTriangle,
  Trash2,
  FileText,
  Clock,
  ShieldCheck,
  Folder,
  RotateCcw,
} from 'lucide-react';

interface DeleteDocumentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName?: string | null;
  documentType?: string | null;
  documentSize?: number | null;
  folderName?: string | null;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DeleteDocumentConfirmDialog({
  open,
  onOpenChange,
  documentName,
  documentType,
  documentSize,
  folderName,
  onConfirm,
  loading = false,
}: DeleteDocumentConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border border-amber-500/30 shadow-2xl rounded-2xl bg-card">
        {/* Accent warning gradient bar */}
        <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600" />

        <div className="p-6 space-y-4">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-inner shrink-0">
                <Trash2 className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  Delete Document
                  <Badge variant="outline" className="text-[10px] uppercase font-bold py-0.5 px-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800">
                    Move to Bin
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-sm font-semibold text-foreground pt-0.5">
                  Are you sure you want to delete this document?
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Document Preview Card */}
          {documentName && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5 flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-bold text-foreground truncate" title={documentName}>
                  {documentName}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {folderName && (
                    <span className="flex items-center gap-1">
                      <Folder className="h-3 w-3" />
                      Folder: <strong className="text-foreground">{folderName}</strong>
                    </span>
                  )}
                  {documentSize ? <span>• {formatBytes(documentSize)}</span> : null}
                  {documentType ? <span className="uppercase text-[10px]">({documentType.split('/').pop()})</span> : null}
                </div>
              </div>
            </div>
          )}

          {/* Big Highlighted 90-Day Warning & Retrieval Box */}
          <div className="rounded-xl border-2 border-amber-400/50 dark:border-amber-700/60 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-orange-500/10 p-4 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
              <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>90-Day Retrieval Guarantee</span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This document will be safely moved to the <strong className="text-foreground">Recycle Bin</strong>. It is <strong className="text-amber-700 dark:text-amber-400 font-semibold">NOT permanently destroyed</strong> right away.
            </p>

            <div className="bg-background/80 rounded-lg p-2.5 border border-amber-300/40 dark:border-amber-800/40 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>You can retrieve & restore this file for up to <strong className="text-amber-600 dark:text-amber-400">90 days</strong>.</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Easily recover it at any time from the <strong>Recycle Bin</strong> tab back to its original folder.</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground/80 italic">
              * After 90 days of inactivity, the item will be automatically and permanently removed.
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex flex-col-reverse sm:flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto text-xs"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel (Keep Document)
          </Button>

          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="w-full sm:w-auto text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {loading ? 'Moving...' : 'Move to Bin (Retrievable for 90 Days)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
