import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowRight, Loader2, MoveHorizontal, PoundSterling, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type PlanogramChangeType = 'replace' | 'move' | 'price';

export interface PlanogramGameInfo {
  id: string;
  game_name: string;
  game_number: string | null;
  branch_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  slot: number;
  game: PlanogramGameInfo;
  /** price in force today for the old game */
  currentPrice: number;
  /** earliest allowed change date (yyyy-MM-dd), e.g. day after the game went into the slot */
  minDate: string;
  /** slots that are currently occupied in this branch (for the move / relocate check) */
  occupiedSlots: number[];
  /** running stock for the old game on a given date, used to pre-fill the final count */
  suggestClosing: (dateStr: string) => number | null;
}

const todayStr = () => format(new Date(), 'yyyy-MM-dd');
const nice = (d: string) => format(parseISO(d), 'dd MMM yyyy');
const gbp = (n: number) => `£${n.toFixed(2)}`;
const label = (g: PlanogramGameInfo) => (g.game_number ? `Game ${g.game_number}` : g.game_name);

export function PlanogramChangeDialog({ open, onOpenChange, branchId, slot, game, currentPrice, minDate, occupiedSlots, suggestClosing }: Props) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<PlanogramChangeType>('replace');
  const [changeDate, setChangeDate] = useState(todayStr());
  const [finalClosing, setFinalClosing] = useState('');
  const [returned, setReturned] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newActivated, setNewActivated] = useState('');
  const [newSlot, setNewSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // reset whenever the dialog opens for a slot
  useEffect(() => {
    if (!open) return;
    setType('replace');
    setChangeDate(todayStr());
    setFinalClosing('');
    setReturned('');
    setNewNumber('');
    setNewName('');
    setNewPrice('');
    setNewActivated('');
    setNewSlot(String(slot));
    setNotes('');
  }, [open, slot, minDate]);

  // pre-fill the old pack's remaining stock for the chosen date
  const suggested = useMemo(() => (type === 'replace' ? suggestClosing(changeDate) : null), [type, changeDate, suggestClosing]);

  const targetSlot = Number(newSlot) || slot;
  const slotTaken = targetSlot !== slot && occupiedSlots.includes(targetSlot);
  const dateInvalid = !changeDate || changeDate < minDate || changeDate > todayStr();
  const priceNum = Number(newPrice);

  const errors: string[] = [];
  if (dateInvalid) errors.push(`Choose a date between ${nice(minDate)} and today.`);
  if (type === 'replace') {
    if (!newNumber.trim()) errors.push('Enter the new National Lottery game number.');
    if (!(priceNum > 0)) errors.push('Enter the new ticket price.');
    if (slotTaken) errors.push(`Slot ${targetSlot} is occupied.`);
  }
  if (type === 'move') {
    if (!(Number(newSlot) > 0) || targetSlot === slot) errors.push('Choose a different slot number.');
    if (slotTaken) errors.push(`Slot ${targetSlot} is occupied.`);
  }
  if (type === 'price') {
    if (!(priceNum > 0)) errors.push('Enter the new ticket price.');
    else if (priceNum === currentPrice) errors.push('The new price is the same as the current price.');
  }

  const summary = (() => {
    if (dateInvalid) return null;
    const d = nice(changeDate);
    if (type === 'replace' && newNumber.trim() && priceNum > 0) {
      return `${label(game)} keeps its sales at ${gbp(currentPrice)} up to and including ${d}. Game ${newNumber.trim()} starts in slot ${targetSlot} on ${d} at ${gbp(priceNum)} with its own opening stock.`;
    }
    if (type === 'move' && targetSlot !== slot) {
      return `${label(game)} moves from slot ${slot} to slot ${targetSlot} on ${d}. Its price and stock carry over unchanged.`;
    }
    if (type === 'price' && priceNum > 0) {
      return `Sales before ${d} stay at ${gbp(currentPrice)}; from ${d} onward they are valued at ${gbp(priceNum)}.`;
    }
    return null;
  })();

  const submit = async () => {
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setSaving(true);
    try {
      const closing = finalClosing === '' ? suggested ?? 0 : Math.max(0, parseInt(finalClosing) || 0);
      const { error } = await supabase.rpc('apply_lottery_planogram_change', {
        p_branch_id: branchId,
        p_change_type: type,
        p_change_date: changeDate,
        p_slot_number: slot,
        p_old_game_id: game.id,
        p_old_final_closing: type === 'replace' ? closing : undefined,
        p_old_returned: type === 'replace' ? Math.max(0, parseInt(returned) || 0) : undefined,
        p_new_game_number: type === 'replace' ? newNumber.trim() : undefined,
        p_new_game_name: type === 'replace' && newName.trim() ? newName.trim() : undefined,
        p_new_ticket_price: type !== 'move' ? priceNum : undefined,
        p_new_opening_activated: type === 'replace' ? Math.max(0, parseInt(newActivated) || 0) : undefined,
        p_new_slot_number: type !== 'price' ? targetSlot : undefined,
        p_notes: notes.trim() || undefined,
      });
      if (error) throw error;
      ['lottery-games', 'lottery-daily-records', 'lottery-price-history', 'lottery-slot-assignments', 'lottery-planogram-changes'].forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      );
      toast.success('Planogram change saved. Earlier days keep their original game and price.');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the planogram change');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Planogram change · Slot {slot}</DialogTitle>
          <DialogDescription>
            Currently {label(game)}
            {game.game_number && game.game_name && game.game_name !== `Game ${game.game_number}` ? ` (${game.game_name})` : ''} at {gbp(currentPrice)}.
            History before the change date is never changed.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={type} onValueChange={(v) => setType(v as PlanogramChangeType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="replace"><Repeat className="h-4 w-4" />New game</TabsTrigger>
            <TabsTrigger value="move"><MoveHorizontal className="h-4 w-4" />Move slot</TabsTrigger>
            <TabsTrigger value="price"><PoundSterling className="h-4 w-4" />Price only</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="pg-date">Change date</Label>
            <Input id="pg-date" type="date" value={changeDate} min={minDate} max={todayStr()} onChange={(e) => setChangeDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {type === 'replace'
                ? 'Mid-day swap: the old game still sells on this date, and the new game starts the same day.'
                : 'The change applies from this date onward.'}
            </p>
          </div>

          {type === 'replace' && (
            <>
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4 space-y-3">
                <p className="text-sm font-semibold">Old game · {label(game)}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-closing">Final closing in dispenser</Label>
                    <Input id="pg-closing" type="number" min="0" value={finalClosing} placeholder={suggested != null ? String(suggested) : '0'} onChange={(e) => setFinalClosing(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-returned">Unsold tickets removed / returned</Label>
                    <Input id="pg-returned" type="number" min="0" value={returned} placeholder="0" onChange={(e) => setReturned(e.target.value)} />
                  </div>
                </div>
                {suggested != null && (
                  <p className="text-xs text-muted-foreground">Running stock for this date is {suggested}. Leave the closing blank to use it.</p>
                )}
              </div>

              <div className="rounded-xl border border-primary/25 bg-secondary/40 p-4 space-y-3">
                <p className="text-sm font-semibold">New game</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-number">National Lottery game number</Label>
                    <Input id="pg-number" value={newNumber} placeholder="e.g. 1612" onChange={(e) => setNewNumber(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-price">Ticket price (£)</Label>
                    <Input id="pg-price" type="number" min="0" step="0.5" value={newPrice} placeholder={currentPrice.toFixed(2)} onChange={(e) => setNewPrice(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-name">Game title (optional)</Label>
                    <Input id="pg-name" value={newName} placeholder="e.g. £10 Million Cash" onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-activated">New pack tickets activated</Label>
                    <Input id="pg-activated" type="number" min="0" value={newActivated} placeholder="0" onChange={(e) => setNewActivated(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-slot">Dispenser slot</Label>
                    <Input id="pg-slot" type="number" min="1" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          {type === 'move' && (
            <div className="space-y-1.5">
              <Label htmlFor="pg-move-slot">New slot number</Label>
              <Input id="pg-move-slot" type="number" min="1" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} />
              <p className="text-xs text-muted-foreground">Same game, same pack: stock carries over and the price is unchanged.</p>
            </div>
          )}

          {type === 'price' && (
            <div className="space-y-1.5">
              <Label htmlFor="pg-only-price">New ticket price (£)</Label>
              <Input id="pg-only-price" type="number" min="0" step="0.5" value={newPrice} placeholder={currentPrice.toFixed(2)} onChange={(e) => setNewPrice(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pg-notes">Notes (optional)</Label>
            <Textarea id="pg-notes" rows={2} value={notes} placeholder="e.g. Camelot planogram PG-2611" onChange={(e) => setNotes(e.target.value)} />
          </div>

          {summary && (
            <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{summary}</p>
            </div>
          )}
          {errors.length > 0 && <p className="text-sm text-destructive">{errors[0]}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || errors.length > 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save planogram change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
