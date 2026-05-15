import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { IMPORT_FORMATS } from '@/lib/coopFuelParser';
import { Settings2 } from 'lucide-react';

interface BranchRow { id: string; name: string; import_format: string | null; organization?: { name: string } | null; }

export default function BranchFormats() {
  const [rows, setRows] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, import_format, organization:organizations(name)')
      .order('name');
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = async (id: string, value: string) => {
    const next = value === '__none__' ? null : value;
    const { error } = await supabase.from('branches').update({ import_format: next } as any).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Format updated');
    setRows(prev => prev.map(r => r.id === id ? { ...r, import_format: next } : r));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Settings2 className="h-6 w-6 text-primary" /> Branch Import Formats
      </h1>
      <p className="text-sm text-muted-foreground mb-4">
        Assign a till-report format to each store. Stores will only see and upload files in the format you configure here.
      </p>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead>Organisation</TableHead>
              <TableHead className="w-[260px]">Import Format</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-6">Loading...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No branches</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.organization?.name || '—'}</TableCell>
                <TableCell>
                  <Select value={r.import_format || '__none__'} onValueChange={(v) => update(r.id, v)}>
                    <SelectTrigger><SelectValue placeholder="Not configured" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not configured</SelectItem>
                      {IMPORT_FORMATS.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
