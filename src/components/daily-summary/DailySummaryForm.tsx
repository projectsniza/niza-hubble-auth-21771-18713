import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface DailySummary {
  id?: string;
  organization_id: string;
  branch_id: string;
  summary_date: string;
  shop_sale: number;
  net_sale: number;
  customer_count: number;
  fuel_volume: number;
  fuel_sale: number;
  cash_sale: number;
  atm_loaded: number;
  store_paid_outs: number;
  cash_deposit: number;
  notes: string | null;
}

interface Props {
  branchId: string;
  organizationId: string;
  onSaved?: () => void;
}

const FIELDS: Array<{ key: keyof DailySummary; label: string; prefix?: string; suffix?: string; integer?: boolean }> = [
  { key: 'shop_sale', label: 'Shop sale (Gross)', prefix: '£' },
  { key: 'net_sale', label: 'Shop sale (Net)', prefix: '£' },
  { key: 'customer_count', label: 'Customer Count', integer: true },
  { key: 'fuel_volume', label: 'Fuel volume (Liter)', suffix: 'L' },
  { key: 'fuel_sale', label: 'Fuel Sale', prefix: '£' },
  { key: 'cash_sale', label: 'Cash Sale', prefix: '£' },
  { key: 'atm_loaded', label: 'ATM (Loaded)', prefix: '£' },
  { key: 'store_paid_outs', label: 'Store Paid Outs', prefix: '£' },
  { key: 'cash_deposit', label: 'Cash Deposit', prefix: '£' },
];

const blankRecord = (orgId: string, branchId: string, date: string): DailySummary => ({
  organization_id: orgId,
  branch_id: branchId,
  summary_date: date,
  shop_sale: 0, net_sale: 0, customer_count: 0,
  fuel_volume: 0, fuel_sale: 0, cash_sale: 0,
  atm_loaded: 0, store_paid_outs: 0, cash_deposit: 0,
  notes: '',
});

export default function DailySummaryForm({ branchId, organizationId, onSaved }: Props) {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [record, setRecord] = useState<DailySummary>(() =>
    blankRecord(organizationId, branchId, format(new Date(), 'yyyy-MM-dd'))
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!branchId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('branch_id', branchId)
        .eq('summary_date', dateStr)
        .maybeSingle();
      if (cancelled) return;
      if (error && error.code !== 'PGRST116') {
        toast.error('Failed to load summary');
      }
      if (data) {
        setRecord({
          id: data.id,
          organization_id: data.organization_id,
          branch_id: data.branch_id,
          summary_date: data.summary_date,
          shop_sale: Number(data.shop_sale) || 0,
          net_sale: Number(data.net_sale) || 0,
          customer_count: Number(data.customer_count) || 0,
          fuel_volume: Number(data.fuel_volume) || 0,
          fuel_sale: Number(data.fuel_sale) || 0,
          cash_sale: Number(data.cash_sale) || 0,
          atm_loaded: Number(data.atm_loaded) || 0,
          store_paid_outs: Number(data.store_paid_outs) || 0,
          cash_deposit: Number(data.cash_deposit) || 0,
          notes: data.notes ?? '',
        });
      } else {
        setRecord(blankRecord(organizationId, branchId, dateStr));
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [branchId, organizationId, dateStr]);

  const updateField = (key: keyof DailySummary, value: string) => {
    const num = value === '' ? 0 : Number(value);
    setRecord(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      organization_id: organizationId,
      branch_id: branchId,
      summary_date: dateStr,
      shop_sale: record.shop_sale,
      net_sale: record.net_sale,
      customer_count: record.customer_count,
      fuel_volume: record.fuel_volume,
      fuel_sale: record.fuel_sale,
      cash_sale: record.cash_sale,
      atm_loaded: record.atm_loaded,
      store_paid_outs: record.store_paid_outs,
      cash_deposit: record.cash_deposit,
      notes: record.notes || null,
      updated_by: user.id,
      ...(record.id ? {} : { created_by: user.id }),
    };

    const { error } = await supabase
      .from('daily_summaries')
      .upsert(payload, { onConflict: 'branch_id,summary_date' });

    setSaving(false);
    if (error) {
      console.error(error);
      toast.error(error.message || 'Failed to save daily summary');
      return;
    }
    toast.success(`Daily summary saved for ${format(date, 'PPP')}`);
    onSaved?.();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>Enter Sales Analysis</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            One record per day. Editing the same date overwrites the existing values.
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('justify-start text-left font-normal', !date && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(date, 'PPP')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FIELDS.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <div className="relative">
                    {f.prefix && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{f.prefix}</span>
                    )}
                    <Input
                      id={f.key}
                      type="number"
                      step={f.integer ? '1' : '0.01'}
                      min="0"
                      value={(record as any)[f.key] === 0 ? '' : (record as any)[f.key]}
                      placeholder="0"
                      onChange={(e) => updateField(f.key, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className={cn(f.prefix && 'pl-7', f.suffix && 'pr-8')}
                    />
                    {f.suffix && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{f.suffix}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Summary Notes (optional)</Label>
              <Textarea
                id="notes"
                value={record.notes ?? ''}
                onChange={(e) => setRecord(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any observations, issues or context for the day..."
                rows={4}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {record.id ? 'Update Summary' : 'Save Summary'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
