import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { parseDailySales } from '@/lib/dailySalesParser';
import { parseCoopFuel, IMPORT_FORMATS, type ImportFormatId } from '@/lib/coopFuelParser';

type BranchProfile = {
  branch_id: string | null;
  organization_id: string | null;
  import_format: ImportFormatId | null;
};

export default function DailySalesUpload() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BranchProfile | null>(null);
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const formatMeta = IMPORT_FORMATS.find(f => f.id === profile?.import_format) || null;

  const loadRows = async () => {
    const { data } = await supabase
      .from('daily_sales_uploads')
      .select('id, sale_date, source_filename, parsed_totals, created_at')
      .order('sale_date', { ascending: false })
      .limit(50);
    setRows(data || []);
  };

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: prof } = await supabase
        .from('profiles').select('branch_id, organization_id').eq('id', user.id).maybeSingle();
      let import_format: ImportFormatId | null = null;
      if (prof?.branch_id) {
        const { data: br } = await supabase
          .from('branches').select('import_format').eq('id', prof.branch_id).maybeSingle();
        import_format = (br as any)?.import_format || null;
      }
      setProfile({
        branch_id: prof?.branch_id || null,
        organization_id: prof?.organization_id || null,
        import_format,
      });
    })();
    loadRows();
  }, [user?.id]);

  const handleUpload = async () => {
    if (!files || files.length === 0) return toast.error('Select at least one file');
    if (!profile?.branch_id) return toast.error('Your account is not linked to a branch');
    setBusy(true);
    try {
      const fileArr = Array.from(files);

      // ----- Co-op Fuel: single TXT till export (robust to small misalignments) -----
      if (profile.import_format === 'coop_fuel') {
        // Prefer the TXT/CSV that looks like the till export; otherwise just the first file.
        const txtFile =
          fileArr.find(f => /^TXT/i.test(f.name)) ||
          fileArr.find(f => /\.(csv|txt)$/i.test(f.name)) ||
          fileArr[0];
        const deptFile = fileArr.find(f => /DEPARTMENT.*VAT/i.test(f.name)); // optional legacy
        if (!txtFile) throw new Error('Please select the daily till CSV/TXT file.');
        const txtText = await txtFile.text();
        const deptText = deptFile ? await deptFile.text() : undefined;
        const breakdown = parseCoopFuel({ txt1: txtText, deptVat: deptText });
        const legacy = parseDailySales(txtText);
        const combinedTotals = {
          ...legacy,
          shop: +(breakdown.TO + breakdown.DR + breakdown.GS + breakdown.GZ + breakdown.DO + breakdown.AL + breakdown.NP + breakdown.VM).toFixed(2),
          fuel: breakdown.FU,
          lottery: breakdown.national_lottery,
          breakdown,
          format: 'coop_fuel' as const,
        };
        const filesToStore = deptFile ? [txtFile, deptFile] : [txtFile];
        for (const f of filesToStore) {
          const path = `${profile.branch_id}/${date}/${Date.now()}_${f.name}`;
          const { error: upErr } = await supabase.storage.from('daily-sales').upload(path, f, { upsert: false });
          if (upErr) throw upErr;
        }
        const { error: insErr } = await supabase.from('daily_sales_uploads').insert({
          organization_id: profile.organization_id,
          branch_id: profile.branch_id,
          sale_date: date,
          source_filename: deptFile ? `${txtFile.name} + ${deptFile.name}` : txtFile.name,
          source_format: 'coop_fuel',
          storage_path: `${profile.branch_id}/${date}/`,
          raw_text: ((deptText ? txtText + '\n---DEPT---\n' + deptText : txtText)).slice(0, 200000),
          parsed_totals: combinedTotals as any,
          uploaded_by: user!.id,
        });
        if (insErr) throw insErr;
      } else {
        // Generic / unconfigured fallback (existing behaviour)
        for (const file of fileArr) {
          const text = await file.text();
          const totals = parseDailySales(text);
          const path = `${profile.branch_id}/${date}/${Date.now()}_${file.name}`;
          const { error: upErr } = await supabase.storage.from('daily-sales').upload(path, file, { upsert: false });
          if (upErr) throw upErr;
          const { error: insErr } = await supabase.from('daily_sales_uploads').insert({
            organization_id: profile.organization_id,
            branch_id: profile.branch_id,
            sale_date: date,
            source_filename: file.name,
            source_format: file.name.split('.').pop()?.toLowerCase() || 'csv',
            storage_path: path,
            raw_text: text.length > 200000 ? text.slice(0, 200000) : text,
            parsed_totals: totals as any,
            uploaded_by: user!.id,
          });
          if (insErr) throw insErr;
        }
      }
      toast.success('Upload complete');
      setFiles(null);
      const fi = document.getElementById('ds-file') as HTMLInputElement | null;
      if (fi) fi.value = '';
      loadRows();
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this upload?')) return;
    const { error } = await supabase.from('daily_sales_uploads').delete().eq('id', id);
    if (error) return toast.error(error.message);
    loadRows();
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Upload className="h-6 w-6 text-primary" /> Daily Sales Upload
      </h1>

      {formatMeta ? (
        <Card className="p-3 mb-4 bg-primary/5 border-primary/20">
          <p className="text-sm">
            <span className="font-semibold">Format:</span> {formatMeta.label}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{formatMeta.description}</p>
          {profile?.import_format === 'coop_fuel' && (
            <p className="text-xs text-muted-foreground mt-1">
              Select the single daily till CSV/TXT export (e.g. <code>TXT1 (1).CSV</code>). Minor formatting breaks or blank lines are tolerated.
            </p>
          )}
        </Card>
      ) : (
        <Card className="p-3 mb-4 bg-amber-500/10 border-amber-500/30 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200">
            No import format has been configured for your store yet. Please ask head office to set one in Niza Analysis → Branch Formats.
          </p>
        </Card>
      )}

      <Card className="p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <Label>Sale date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Files</Label>
          <Input id="ds-file" type="file" multiple accept="*/*" onChange={(e) => setFiles(e.target.files)} />
        </div>
        <div className="md:col-span-3">
          <Button onClick={handleUpload} disabled={busy}>
            {busy ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Shop</TableHead>
              <TableHead className="text-right">Fuel</TableHead>
              <TableHead className="text-right">Lottery</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No uploads yet</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.sale_date), 'dd MMM yyyy')}</TableCell>
                <TableCell className="max-w-[180px] truncate" title={r.source_filename}>{r.source_filename}</TableCell>
                <TableCell className="text-right">£{Number(r.parsed_totals?.shop || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">£{Number(r.parsed_totals?.fuel || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">£{Number(r.parsed_totals?.lottery || 0).toFixed(2)}</TableCell>
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
