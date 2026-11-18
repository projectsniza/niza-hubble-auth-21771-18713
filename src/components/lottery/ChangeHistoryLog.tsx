import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronDown, History, MoveHorizontal, PoundSterling, Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PlanogramChange } from '@/hooks/useLotteryPlanogram';

const gbp = (n: number | null) => (n == null ? '—' : `£${Number(n).toFixed(2)}`);
const gameLabel = (num: string | null, name: string | null) => (num ? `Game ${num}` : name || 'Unnamed game');

const TYPE_META: Record<PlanogramChange['change_type'], { label: string; icon: typeof Repeat; cls: string }> = {
  replace: { label: 'New game', icon: Repeat, cls: 'bg-emerald-100 text-emerald-800' },
  replace_move: { label: 'New game + slot move', icon: Repeat, cls: 'bg-emerald-100 text-emerald-800' },
  move: { label: 'Slot move', icon: MoveHorizontal, cls: 'bg-sky-100 text-sky-800' },
  price: { label: 'Price change', icon: PoundSterling, cls: 'bg-amber-100 text-amber-800' },
};

/** "Change History" badge + expandable log for one dispenser slot. */
export function ChangeHistoryLog({ changes }: { changes: PlanogramChange[] }) {
  const [open, setOpen] = useState(false);
  const count = changes.length;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={count === 0}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary disabled:cursor-default disabled:opacity-60 disabled:hover:bg-card"
        title={count ? 'Show change history' : 'No planogram changes yet'}
      >
        <History className="h-3.5 w-3.5 text-primary" />
        {count === 0 ? 'No changes' : `${count} change${count === 1 ? '' : 's'}`}
        {count > 0 && <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && count > 0 && (
        <ol className="mt-3 space-y-2 border-l-2 border-primary/20 pl-4">
          {changes.map((c) => {
            const meta = TYPE_META[c.change_type];
            const Icon = meta.icon;
            return (
              <li key={c.id} className="relative rounded-xl border border-border/70 bg-card p-3 text-sm shadow-sm">
                <span className="absolute -left-[23px] top-4 h-3 w-3 rounded-full border-2 border-white bg-primary" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{format(parseISO(c.change_date), 'EEE dd MMM yyyy')}</span>
                  <Badge className={`border-0 ${meta.cls}`}>
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                </div>
                <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-muted-foreground sm:grid-cols-2">
                  {(c.change_type === 'replace' || c.change_type === 'replace_move') && (
                    <div>
                      <dt className="inline">Game: </dt>
                      <dd className="inline text-foreground">
                        {gameLabel(c.old_game_number, c.old_game_name)} → {gameLabel(c.new_game_number, c.new_game_name)}
                      </dd>
                    </div>
                  )}
                  {c.change_type !== 'move' && (
                    <div>
                      <dt className="inline">Price: </dt>
                      <dd className="inline text-foreground">
                        {gbp(c.old_price)} → {gbp(c.new_price)}
                      </dd>
                    </div>
                  )}
                  {c.from_slot !== c.to_slot && (
                    <div>
                      <dt className="inline">Slot: </dt>
                      <dd className="inline text-foreground">
                        {c.from_slot} → {c.to_slot}
                      </dd>
                    </div>
                  )}
                  {c.change_type === 'move' && (
                    <div>
                      <dt className="inline">Game: </dt>
                      <dd className="inline text-foreground">{gameLabel(c.old_game_number, c.old_game_name)}</dd>
                    </div>
                  )}
                  {c.old_final_closing != null && (
                    <div>
                      <dt className="inline">Final closing: </dt>
                      <dd className="inline text-foreground">{c.old_final_closing}</dd>
                    </div>
                  )}
                  {c.old_returned != null && (
                    <div>
                      <dt className="inline">Returned / removed: </dt>
                      <dd className="inline text-foreground">{c.old_returned}</dd>
                    </div>
                  )}
                  {c.new_opening_activated != null && (
                    <div>
                      <dt className="inline">New pack activated: </dt>
                      <dd className="inline text-foreground">{c.new_opening_activated}</dd>
                    </div>
                  )}
                </dl>
                {c.notes && <p className="mt-2 text-xs italic text-muted-foreground">“{c.notes}”</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
