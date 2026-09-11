import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditApprovedContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: any;
  onSaved: () => void;
}

/**
 * Super Admin only: correct the details of an already approved contract.
 * Saves into contract_approvals.contract_content so every download
 * (including store / HR downloads) picks up the corrected version.
 */
export default function EditApprovedContractDialog({
  open,
  onOpenChange,
  contract,
  onSaved,
}: EditApprovedContractDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [signedDate, setSignedDate] = useState('');

  useEffect(() => {
    if (!contract) return;
    const c = (contract.contract_content as any) || {};
    const emp = contract.employee || {};
    setForm({
      contract_date: c.contract_date || '',
      employee_name: c.employee_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
      employee_address: c.employee_address || emp.address || '',
      job_title: c.job_title || emp.job_title || '',
      commencement_date: c.commencement_date || emp.join_date || '',
      hours_per_week: c.hours_per_week ?? '',
      salary_rate: c.salary_rate ?? '',
      salary_type: c.salary_type || 'hourly',
      place_of_work: c.place_of_work || '',
      holiday_days: c.holiday_days ?? '',
      registered_number: c.registered_number || '',
      registered_office: c.registered_office || '',
      employer_name: c.employer_name || '',
    });
    setSignedDate(contract.employer_signed_date || '');
  }, [contract?.id]);

  const set = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      const merged = { ...((contract.contract_content as any) || {}), ...form };
      const { error } = await supabase
        .from('contract_approvals')
        .update({
          contract_content: merged,
          employer_signed_date: signedDate || null,
        })
        .eq('id', contract.id);
      if (error) throw error;

      toast.success('Contract updated');
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update contract');
    } finally {
      setSaving(false);
    }
  };

  if (!contract) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Approved Contract</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-2">
          Changes here update the contract that everyone downloads, including the store login.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <Label>Contract Date (date shown on the contract)</Label>
            <Input type="date" value={form.contract_date || ''} onChange={(e) => set('contract_date', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Employer Signature Date</Label>
            <Input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Employee Name</Label>
            <Input value={form.employee_name || ''} onChange={(e) => set('employee_name', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Employee Address</Label>
            <Input value={form.employee_address || ''} onChange={(e) => set('employee_address', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Job Title</Label>
            <Input value={form.job_title || ''} onChange={(e) => set('job_title', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Commencement Date</Label>
            <Input type="date" value={form.commencement_date || ''} onChange={(e) => set('commencement_date', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Hours Per Week</Label>
            <Input value={form.hours_per_week ?? ''} onChange={(e) => set('hours_per_week', e.target.value)} placeholder="e.g. 40 or Zero" />
          </div>
          <div className="space-y-2">
            <Label>Salary Rate</Label>
            <div className="flex gap-2">
              <Input value={form.salary_rate ?? ''} onChange={(e) => set('salary_rate', e.target.value)} placeholder="e.g. 12.50 or Basic per hour" />
              <select
                className="border rounded-md px-2 text-sm bg-background"
                value={form.salary_type || 'hourly'}
                onChange={(e) => set('salary_type', e.target.value)}
              >
                <option value="hourly">/hour</option>
                <option value="annual">/annum</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Holiday Entitlement (days/year)</Label>
            <Input value={form.holiday_days ?? ''} onChange={(e) => set('holiday_days', e.target.value)} placeholder="e.g. 28 or Pro rata" />
          </div>
          <div className="space-y-2">
            <Label>Employer Representative Name</Label>
            <Input value={form.employer_name || ''} onChange={(e) => set('employer_name', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Registered Number</Label>
            <Input value={form.registered_number || ''} onChange={(e) => set('registered_number', e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Place of Work</Label>
            <Input value={form.place_of_work || ''} onChange={(e) => set('place_of_work', e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Registered Office</Label>
            <Textarea value={form.registered_office || ''} onChange={(e) => set('registered_office', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
