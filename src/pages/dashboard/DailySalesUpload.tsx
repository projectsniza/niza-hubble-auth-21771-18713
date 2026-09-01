import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Trash2, AlertCircle, CheckCircle2, XCircle, FileText, Receipt, Wallet, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { parseDailySales } from '@/lib/dailySalesParser';
import {
  parseCoopFuelDetailed, parseCharfieldShiftReportDetailed,
  spreadsheetBufferToCsvText, IMPORT_FORMATS, applyVendingSplit, parseCashRec, isSouthwaterBranch,
  parseFisCardStatement,
  type ImportFormatId, type UnknownDepartment, type VendingSplitMode,
} from '@/lib/coopFuelParser';


type BranchProfile = {
  branch_id: string | null;
  organization_id: string | null;
  import_format: ImportFormatId | null;
  vending_split_mode: VendingSplitMode | null;
  branch_name: string | null;
};

const mondayOf = (iso: string) => format(startOfWeek(new Date(iso), { weekStartsOn: 1 }), 'yyyy-MM-dd');
const sundayOf = (iso: string) => format(endOfWeek(new Date(iso), { weekStartsOn: 1 }), 'yyyy-MM-dd');

export default function DailySalesUpload() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BranchProfile | null>(null);
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [xreadFile, setXreadFile] = useState<File | null>(null);
  const [deptFile, setDeptFile] = useState<File | null>(null);
  const [cashRecFile, setCashRecFile] = useState<File | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyCash, setBusyCash] = useState(false);
  const [busyCard, setBusyCard] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [weekStatus, setWeekStatus] = useState<Record<string, { xread: boolean; deptvat: boolean }>>({});
  const [cashRecUploaded, setCashRecUploaded] = useState<boolean>(false);
  const [cardUploaded, setCardUploaded] = useState<boolean>(false);
  // Weekly Card Report can be uploaded for any past week, not just the current one.
  const [cardWeek, setCardWeek] = useState<string>('');


  const formatMeta = IMPORT_FORMATS.find(f => f.id === profile?.import_format) || null;
  const isCoop = profile?.import_format === 'coop_fuel';
  const isCharfield = profile?.import_format === 'charfield_shift';

  const weekMonday = useMemo(() => mondayOf(date), [date]);
  const weekSunday = useMemo(() => sundayOf(date), [date]);
  const cardWeekMonday = cardWeek || mondayOf(date);
  const cardWeekOptions = useMemo(() => {
    const base = mondayOf(format(new Date(), 'yyyy-MM-dd'));
    return Array.from({ length: 16 }, (_, i) => format(addDays(new Date(base), -7 * i), 'yyyy-MM-dd'));
  }, []);

  const loadRows = async (branchId: string | null) => {
    if (!branchId) return;
    const { data } = await supabase
      .from('daily_sales_uploads')
      .select('id, sale_date, source_filename, source_format, parsed_totals, created_at')
      .eq('branch_id', branchId)
      .order('sale_date', { ascending: false })
      .limit(80);
    setRows(data || []);

    // Build per-day slot status for the current week
    const status: Record<string, { xread: boolean; deptvat: boolean }> = {};
    const monday = mondayOf(date);
    for (let i = 0; i < 7; i++) {
      const d = format(addDays(new Date(monday), i), 'yyyy-MM-dd');
      status[d] = { xread: false, deptvat: false };
    }
    let cash = false;
    let card = false;
    for (const r of data || []) {
      const f = (r.source_format || '').toLowerCase();
      if (f === 'cashrec' && r.sale_date === monday) cash = true;
      if (f === 'fiscard' && r.sale_date === monday) card = true;
      if (status[r.sale_date]) {
        if (f === 'xread' || f === 'coop_fuel' || f === 'charfield_shift') status[r.sale_date].xread = true;
        if (f === 'deptvat' || f === 'coop_fuel') status[r.sale_date].deptvat = true;
      }
    }
    setWeekStatus(status);
    setCashRecUploaded(cash);
    setCardUploaded(card);
  };


  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: prof } = await supabase
        .from('profiles').select('branch_id, organization_id').eq('id', user.id).maybeSingle();
      let import_format: ImportFormatId | null = null;
      let vending_split_mode: VendingSplitMode | null = null;
      let branch_name: string | null = null;
      if (prof?.branch_id) {
        const { data: br } = await supabase
          .from('branches').select('name, import_format, vending_split_mode').eq('id', prof.branch_id).maybeSingle();
        import_format = (br as any)?.import_format || null;
        branch_name = (br as any)?.name || null;
        const raw = (br as any)?.vending_split_mode;
        vending_split_mode = raw === 'houndsmills' ? 'houndsmills' : 'culverstone';
      }
      const p = {
        branch_id: prof?.branch_id || null,
        organization_id: prof?.organization_id || null,
        import_format,
        vending_split_mode,
        branch_name,
      };
      setProfile(p);
      loadRows(p.branch_id);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (profile?.branch_id) loadRows(profile.branch_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, profile?.branch_id]);

  const reportUnknowns = async (unknowns: UnknownDepartment[], filename: string) => {
    if (!profile?.branch_id || unknowns.length === 0) return;
    const rows = unknowns.map(u => ({
      organization_id: profile.organization_id,
      branch_id: profile.branch_id,
      raw_label: u.label,
      sample_amount: u.amount,
      source_filename: filename,
      sale_date: date,
      status: 'open',
      created_by: user!.id,
    }));
    const { error } = await supabase.from('niza_category_alerts' as any).insert(rows);
    if (error) console.error('category alert insert failed', error);
    else toast.warning(`New till category(ies) detected: ${unknowns.map(u => u.label).join(', ')}`);
  };

  const recordKnownCategories = async (breakdown: any) => {
    if (!profile?.branch_id) return;
    const codes = ['FU','TO','DR','GS','GZ','DO','AL','NP','VM','CW'];
    const rows = codes
      .filter(c => Number(breakdown?.[c] || 0) !== 0)
      .map(code => ({ branch_id: profile.branch_id, category_code: code, last_seen_at: new Date().toISOString() }));
    if (rows.length) {
      await supabase.from('niza_branch_categories' as any).upsert(rows, { onConflict: 'branch_id,category_code' });
    }
  };

  const readFileText = async (file: File) => {
    if (/\.(xlsx|xls)$/i.test(file.name)) return spreadsheetBufferToCsvText(await file.arrayBuffer());
    return file.text();
  };

  const uploadStorage = async (file: File, folder: string) => {
    const path = `${profile!.branch_id}/${folder}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('daily-sales').upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  };

  const handleDailyUpload = async () => {
    if (!profile?.branch_id) return toast.error('Your account is not linked to a branch');
    if (isCoop) {
      if (!xreadFile || !deptFile) return toast.error('Both X-Read and Department VAT are required daily');
    } else if (isCharfield) {
      if (!xreadFile) return toast.error('Please select the daily Shift & Period Report');
    } else if (!xreadFile) return toast.error('Please select the daily till export');

    setBusy(true);
    try {
      if (isCoop) {
        const [txtText, deptText] = await Promise.all([
          readFileText(xreadFile!),
          readFileText(deptFile!),
        ]);
        const detailed = parseCoopFuelDetailed(
          { txt1: txtText, deptVat: deptText },
          { southwater: isSouthwaterBranch(profile.branch_name) },
        );
        const breakdown = applyVendingSplit(detailed.totals, profile.vending_split_mode || 'culverstone');
        await reportUnknowns(detailed.unknownDepartments, deptFile!.name);
        await recordKnownCategories(breakdown);
        const legacy = parseDailySales(txtText);
        const combinedTotals = {
          ...legacy,
          shop: +(breakdown.TO + breakdown.DR + breakdown.GS + breakdown.GZ +
                  breakdown.DO + breakdown.AL + breakdown.NP + breakdown.NP20 + breakdown.VM).toFixed(2),
          fuel: breakdown.FU,
          lottery: breakdown.national_lottery,
          breakdown,
          vending_split_mode: profile.vending_split_mode || 'culverstone',
          format: 'coop_fuel' as const,
        };

        // Store both files under date folder
        await uploadStorage(xreadFile!, date);
        await uploadStorage(deptFile!, date);

        // Remove existing daily row for this date to replace
        await supabase.from('daily_sales_uploads')
          .delete()
          .eq('branch_id', profile.branch_id)
          .eq('sale_date', date)
          .in('source_format', ['coop_fuel', 'xread', 'deptvat']);

        const { error } = await supabase.from('daily_sales_uploads').insert({
          organization_id: profile.organization_id,
          branch_id: profile.branch_id,
          sale_date: date,
          source_filename: `${xreadFile!.name} + ${deptFile!.name}`,
          source_format: 'coop_fuel',
          storage_path: `${profile.branch_id}/${date}/`,
          raw_text: [txtText, deptText].join('\n---DEPT---\n').slice(0, 200000),
          parsed_totals: combinedTotals as any,
          uploaded_by: user!.id,
        });
        if (error) throw error;
      } else if (isCharfield) {
        const buf = await xreadFile!.arrayBuffer();
        const detailed = await parseCharfieldShiftReportDetailed(buf);
        const breakdown = detailed.totals;
        await reportUnknowns(detailed.unknownDepartments, xreadFile!.name);
        await recordKnownCategories(breakdown);
        const combinedTotals = {
          shop: +(breakdown.TO + breakdown.DR + breakdown.GS + breakdown.GZ +
                  breakdown.DO + breakdown.AL + breakdown.NP + breakdown.NP20 + breakdown.VM).toFixed(2),
          fuel: breakdown.FU,
          lottery: breakdown.national_lottery,
          breakdown,
          format: 'charfield_shift' as const,
        };
        await uploadStorage(xreadFile!, date);
        const { error } = await supabase.from('daily_sales_uploads').insert({
          organization_id: profile.organization_id,
          branch_id: profile.branch_id,
          sale_date: date,
          source_filename: xreadFile!.name,
          source_format: 'charfield_shift',
          storage_path: `${profile.branch_id}/${date}/`,
          raw_text: null,
          parsed_totals: combinedTotals as any,
          uploaded_by: user!.id,
        });
        if (error) throw error;
      } else {
        // Generic fallback
        const text = await readFileText(xreadFile!);
        const totals = parseDailySales(text);
        await uploadStorage(xreadFile!, date);
        const { error } = await supabase.from('daily_sales_uploads').insert({
          organization_id: profile.organization_id,
          branch_id: profile.branch_id,
          sale_date: date,
          source_filename: xreadFile!.name,
          source_format: xreadFile!.name.split('.').pop()?.toLowerCase() || 'csv',
          storage_path: `${profile.branch_id}/${date}/`,
          raw_text: text.slice(0, 200000),
          parsed_totals: totals as any,
          uploaded_by: user!.id,
        });
        if (error) throw error;
      }
      toast.success('Daily upload complete');
      setXreadFile(null);
      setDeptFile(null);
      (document.getElementById('xread-file') as HTMLInputElement | null)?.setAttribute('value', '');
      (document.getElementById('dept-file') as HTMLInputElement | null)?.setAttribute('value', '');
      loadRows(profile.branch_id);
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCashRecUpload = async () => {
    if (!profile?.branch_id) return toast.error('Your account is not linked to a branch');
    if (!cashRecFile) return toast.error('Please select the weekly Cash Reconciliation file');
    setBusyCash(true);
    try {
      const path = await uploadStorage(cashRecFile, `cashrec/${weekMonday}`);
      // Try to parse cash rec so the summary can reflect banked figures.
      let cashRecParsed: any = { week_start: weekMonday, week_end: weekSunday };
      try {
        const text = await readFileText(cashRecFile);
        const p = parseCashRec(text);
        cashRecParsed = { ...cashRecParsed, ...p, raw_size: text.length };
      } catch (parseErr) {
        console.warn('Cash Rec parse failed (kept file only):', parseErr);
      }

      // Remove existing cash-rec row for this week
      await supabase.from('daily_sales_uploads')
        .delete()
        .eq('branch_id', profile.branch_id)
        .eq('sale_date', weekMonday)
        .eq('source_format', 'cashrec');

      const { error } = await supabase.from('daily_sales_uploads').insert({
        organization_id: profile.organization_id,
        branch_id: profile.branch_id,
        sale_date: weekMonday,
        source_filename: cashRecFile.name,
        source_format: 'cashrec',
        storage_path: path,
        raw_text: null,
        parsed_totals: cashRecParsed as any,
        uploaded_by: user!.id,
      });
      if (error) throw error;
      toast.success('Cash Reconciliation uploaded for week');
      setCashRecFile(null);
      (document.getElementById('cashrec-file') as HTMLInputElement | null)?.setAttribute('value', '');
      loadRows(profile.branch_id);
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setBusyCash(false);
    }
  };

  const handleCardUpload = async () => {
    if (!profile?.branch_id) return toast.error('Your account is not linked to a branch');
    if (!cardFile) return toast.error('Please select the weekly FIS credit-card statement');
    setBusyCard(true);
    try {
      const path = await uploadStorage(cardFile, `fiscard/${cardWeekMonday}`);
      const text = await readFileText(cardFile);
      const parsed = parseFisCardStatement(text);
      if (parsed.matchedLines === 0) {
        toast.warning('No dated card lines were recognised — the file is stored, but no card values will appear on C.CARD for that week.');
      }

      await supabase.from('daily_sales_uploads')
        .delete()
        .eq('branch_id', profile.branch_id)
        .eq('sale_date', cardWeekMonday)
        .eq('source_format', 'fiscard');

      const { error } = await supabase.from('daily_sales_uploads').insert({
        organization_id: profile.organization_id,
        branch_id: profile.branch_id,
        sale_date: cardWeekMonday,
        source_filename: cardFile.name,
        source_format: 'fiscard',
        storage_path: path,
        raw_text: text.slice(0, 200000),
        parsed_totals: {
          format: 'fiscard',
          week_start: cardWeekMonday,
          week_end: sundayOf(cardWeekMonday),
          by_date: parsed.byDate,
          week_totals: parsed.weekTotals,
          matched_lines: parsed.matchedLines,
        } as any,
        uploaded_by: user!.id,
      });
      if (error) throw error;
      toast.success(`Card statement uploaded (${Object.keys(parsed.byDate).length} day(s) mapped)`);
      setCardFile(null);
      loadRows(profile.branch_id);
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setBusyCard(false);
    }
  };



  const remove = async (id: string) => {
    if (!confirm('Delete this upload?')) return;
    const { error } = await supabase.from('daily_sales_uploads').delete().eq('id', id);
    if (error) return toast.error(error.message);
    loadRows(profile?.branch_id || null);
  };

  const todayXread = weekStatus[date]?.xread;
  const todayDept = weekStatus[date]?.deptvat;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Upload className="h-6 w-6 text-primary" /> Daily Sales Upload
      </h1>

      {formatMeta ? (
        <Card className="p-3 mb-4 bg-primary/5 border-primary/20">
          <p className="text-sm"><span className="font-semibold">Format:</span> {formatMeta.label}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatMeta.description}</p>
        </Card>
      ) : (
        <Card className="p-3 mb-4 bg-amber-500/10 border-amber-500/30 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
          <p className="text-sm">No import format has been configured. Please ask head office to set one in Niza Analysis → Branch Formats.</p>
        </Card>
      )}

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-4">
          <div>
            <Label>Sale date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="md:col-span-2 text-xs text-muted-foreground self-end">
            Week: {format(new Date(weekMonday), 'dd MMM')} – {format(new Date(weekSunday), 'dd MMM yyyy')}
          </div>
        </div>

        {/* Daily slots */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Slot 1: X-Read */}
          <Card className={`p-3 border-2 ${todayXread ? 'border-green-500/40 bg-green-500/5' : 'border-dashed'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">1. X-Read (Till)</span>
              </div>
              {todayXread ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground mb-2">Daily till report (CSV/TXT/XLSX)</p>
            <Input id="xread-file" type="file" accept="*/*" onChange={(e) => setXreadFile(e.target.files?.[0] || null)} />
            {xreadFile && <p className="text-xs text-primary mt-1 truncate">{xreadFile.name}</p>}
          </Card>

          {/* Slot 2: Department VAT */}
          <Card className={`p-3 border-2 ${!isCoop ? 'opacity-50 border-dashed' : todayDept ? 'border-green-500/40 bg-green-500/5' : 'border-dashed'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">2. Department VAT</span>
              </div>
              {isCoop && (todayDept ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />)}
            </div>
            <p className="text-xs text-muted-foreground mb-2">{isCoop ? 'Daily VAT report (CSV/XLSX)' : 'Not required for this format'}</p>
            <Input id="dept-file" type="file" accept="*/*" disabled={!isCoop}
              onChange={(e) => setDeptFile(e.target.files?.[0] || null)} />
            {deptFile && <p className="text-xs text-primary mt-1 truncate">{deptFile.name}</p>}
          </Card>

          {/* Slot 3: Cash Rec (weekly) */}
          <Card className={`p-3 border-2 ${cashRecUploaded ? 'border-green-500/40 bg-green-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">3. Cash Reconciliation</span>
              </div>
              {cashRecUploaded
                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase">Weekly</span>}
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Week {format(new Date(weekMonday), 'dd MMM')} – {format(new Date(weekSunday), 'dd MMM')}. Upload anytime during the week.
            </p>
            <Input id="cashrec-file" type="file" accept="*/*" onChange={(e) => setCashRecFile(e.target.files?.[0] || null)} />
            {cashRecFile && <p className="text-xs text-primary mt-1 truncate">{cashRecFile.name}</p>}
            <Button size="sm" className="w-full mt-2" onClick={handleCashRecUpload} disabled={busyCash || !cashRecFile}>
              {busyCash ? 'Uploading…' : cashRecUploaded ? 'Replace Cash Rec' : 'Upload Cash Rec'}
            </Button>
          </Card>

          {/* Slot 4: FIS weekly credit-card statement */}
          <Card className={`p-3 border-2 ${cardUploaded ? 'border-green-500/40 bg-green-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">4. Weekly Card Report</span>
              </div>
              {cardUploaded
                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase">Weekly</span>}
            </div>
            <div className="mb-2">
              <Label className="text-xs">Report week</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                value={cardWeekMonday}
                onChange={(e) => setCardWeek(e.target.value)}
              >
                {cardWeekOptions.map(w => (
                  <option key={w} value={w}>
                    {format(new Date(w), 'dd MMM')} – {format(new Date(sundayOf(w)), 'dd MMM yyyy')}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Weekly card report (CSV/XLSX) — the only source of C.CARD values. Each card type gets its own column
              (Visa/Master, All Star, Amex, UK Fuel, Texaco/Fast Fuel, BP, Euroshell, Shell/Routex, plus any new card).
              Upload after the week ends.
            </p>
            <Input id="fiscard-file" type="file" accept="*/*" onChange={(e) => setCardFile(e.target.files?.[0] || null)} />
            {cardFile && <p className="text-xs text-primary mt-1 truncate">{cardFile.name}</p>}
            <Button size="sm" className="w-full mt-2" onClick={handleCardUpload} disabled={busyCard || !cardFile}>
              {busyCard ? 'Uploading…' : 'Upload Weekly Card Report'}
            </Button>
          </Card>
        </div>


        <div className="mt-4">
          <Button onClick={handleDailyUpload}
            disabled={busy || !xreadFile || (isCoop && !deptFile)}>
            {busy ? 'Uploading…' : 'Upload Daily Files'}
          </Button>
          {isCoop && (!xreadFile || !deptFile) && (
            <p className="text-xs text-muted-foreground mt-2">
              Both X-Read and Department VAT are required each day so category totals match the client paperwork exactly.
            </p>
          )}
        </div>
      </Card>

      {/* Week completion status */}
      <Card className="p-3 mb-4">
        <h3 className="font-semibold text-sm mb-2">This week's status</h3>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = format(addDays(new Date(weekMonday), i), 'yyyy-MM-dd');
            const s = weekStatus[d] || { xread: false, deptvat: false };
            const complete = isCoop ? (s.xread && s.deptvat) : s.xread;
            return (
              <div key={d} className={`rounded p-2 text-center border ${complete ? 'border-green-500/40 bg-green-500/10' : 'border-muted bg-muted/30'}`}>
                <div className="font-semibold">{format(new Date(d), 'EEE dd')}</div>
                <div className="mt-1 flex justify-center gap-1">
                  {s.xread ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
                  {isCoop && (s.deptvat ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-muted-foreground" />)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> uploaded</span>
          <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> missing</span>
          {!cashRecUploaded && <span className="text-amber-600">• Cash Rec for this week not uploaded yet</span>}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Shop</TableHead>
              <TableHead className="text-right">Fuel</TableHead>
              <TableHead className="text-right">Lottery</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No uploads yet</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.sale_date), 'dd MMM yyyy')}</TableCell>
                <TableCell className="text-xs uppercase">{r.source_format || '—'}</TableCell>
                <TableCell className="max-w-[220px] truncate" title={r.source_filename}>{r.source_filename}</TableCell>
                <TableCell className="text-right">{r.source_format === 'cashrec' ? '—' : `£${Number(r.parsed_totals?.shop || 0).toFixed(2)}`}</TableCell>
                <TableCell className="text-right">{r.source_format === 'cashrec' ? '—' : `£${Number(r.parsed_totals?.fuel || 0).toFixed(2)}`}</TableCell>
                <TableCell className="text-right">{r.source_format === 'cashrec' ? '—' : `£${Number(r.parsed_totals?.lottery || 0).toFixed(2)}`}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
