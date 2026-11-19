import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, RotateCcw, Upload, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { diffContract, CONTRACT_FIELD_LABELS, formatLogValue } from '@/lib/contractDiff';

interface EditContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A contract_approvals row, with its `employee` (first_name, last_name, address, job_title, join_date, organization_id, branch_id). */
  contract: any;
  onSaved: () => void;
}

interface LogRow {
  id: string;
  action: string;
  field: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  changed_by_name: string | null;
  changed_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending: 'Waiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

/**
 * Super Admin only: edit a contract at ANY stage (draft, pending, rejected, approved, signed).
 * Saves through the update_contract_details database function, which
 *  - writes every changed field to the contract history,
 *  - keeps the employee record (job title, start date, branch) in line with the contract,
 * so every download (including the store login) uses the corrected contract.
 * Works as "Edit Contract" for any status; the file keeps its old name for existing imports.
 */
export default function EditApprovedContractDialog({ open, onOpenChange, contract, onSaved }: EditContractDialogProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [signedDate, setSignedDate] = useState('');
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<LogRow[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [branchId, setBranchId] = useState('');
  const [signedFile, setSignedFile] = useState<File | null>(null);

  const status: string = contract?.status || 'approved';
  const isApproved = status === 'approved';

  const loadHistory = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('contract_change_log')
      .select('id, action, field, old_value, new_value, reason, changed_by_name, changed_at')
      .eq('contract_id', id)
      .order('changed_at', { ascending: false })
      .limit(100);
    if (error) {
      toast.error('Could not load the contract history: ' + error.message);
      return;
    }
    setHistory((data || []) as LogRow[]);
  }, []);

  useEffect(() => {
    if (!contract || !open) return;
    const c = (contract.contract_content as any) || {};
    const emp = contract.employee || {};
    setForm({
      contract_date: c.contract_date || '',
      organization_id: c.organization_id || emp.organization_id || '',
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
      vat_number: c.vat_number || '',
      employer_name: c.employer_name || '',
    });
    setSignedDate(contract.employer_signed_date || '');
    setBranchId(emp.branch_id || '');
    setReason('');
    setSignedFile(null);
    loadHistory(contract.id);
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrganizations(data || []));
    supabase.from('branches').select('id, name, organization_id').order('name').then(({ data }) => setBranches(data || []));
  }, [contract?.id, open, loadHistory]);

  const set = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }));

  const original = (contract?.contract_content as any) || {};
  const changes = contract ? diffContract(original, form) : [];
  const signedDateChanged = (signedDate || '') !== (contract?.employer_signed_date || '');
  const branchChanged = !!branchId && branchId !== (contract?.employee?.branch_id || '');
  const nothingChanged = changes.length === 0 && !signedDateChanged && !branchChanged;
  const reasonMissing = isApproved && !nothingChanged && !reason.trim();

  const handleSave = async () => {
    if (!contract) return;
    if (!isSuperAdmin) {
      toast.error('Only a Super Admin can edit contracts');
      return;
    }
    if (nothingChanged) {
      toast.info('No changes to save');
      return;
    }
    if (reasonMissing) {
      toast.error('Please give a reason for changing an approved contract');
      return;
    }
    setSaving(true);
    try {
      const content: Record<string, unknown> = {};
      for (const ch of changes) content[ch.field] = ch.newValue;
      const { error } = await supabase.rpc('update_contract_details', {
        p_approval_id: contract.id,
        p_content: content as any,
        p_employee: {
          job_title: form.job_title || null,
          join_date: form.commencement_date || null,
          branch_id: branchChanged ? branchId : null,
        } as any,
        p_reason: reason.trim() || null,
        p_signed_date: signedDateChanged ? signedDate || null : null,
      });
      if (error) throw error;

      toast.success('Contract updated');
      await loadHistory(contract.id);
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update contract');
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!contract) return;
    if (!reason.trim()) {
      toast.error('Please give a reason for reopening this contract');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('reopen_contract', { p_approval_id: contract.id, p_reason: reason.trim() });
      if (error) throw error;
      toast.success('Contract reopened — it is waiting for approval again');
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to reopen contract');
    } finally {
      setSaving(false);
    }
  };

  const handleReplaceSigned = async () => {
    if (!contract || !signedFile) return;
    setSaving(true);
    try {
      const ext = signedFile.name.split('.').pop();
      const path = `employees/${contract.employee_id}/contracts/signed_contract_${contract.employee_id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, signedFile);
      if (upErr) throw upErr;
      const { error } = await supabase.rpc('log_contract_signed_copy', {
        p_approval_id: contract.id,
        p_path: path,
        p_reason: reason.trim() || null,
      });
      if (error) throw error;
      toast.success('Signed copy replaced');
      setSignedFile(null);
      await loadHistory(contract.id);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Failed to replace the signed copy');
    } finally {
      setSaving(false);
    }
  };

  if (!contract) return null;
  const visibleBranches = branches.filter((b) => !form.organization_id || b.organization_id === form.organization_id || b.id === branchId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Contract
            <Badge variant="outline">{STATUS_LABEL[status] || status}</Badge>
          </DialogTitle>
        </DialogHeader>

        {!isSuperAdmin && (
          <p className="text-xs bg-destructive/10 border border-destructive/30 rounded p-2">
            Only a Super Admin can edit contracts.
          </p>
        )}
        {isApproved && (
          <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-2">
            This contract is approved. Changes are applied in place and recorded in the history below. Everyone who downloads it,
            including the store login, gets the corrected version.
          </p>
        )}

        <fieldset disabled={!isSuperAdmin} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <Label>Contract Date (date shown on the contract)</Label>
            <Input type="date" value={form.contract_date || ''} onChange={(e) => set('contract_date', e.target.value)} />
          </div>
          {isApproved && (
            <div className="space-y-2">
              <Label>Employer Signature Date</Label>
              <Input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} />
            </div>
          )}
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
            <Label>Employer (Organisation)</Label>
            <Select value={form.organization_id || ''} onValueChange={(v) => set('organization_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select organisation" /></SelectTrigger>
              <SelectContent>
                {organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Branch (employee's place of work)</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                {visibleBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {branchChanged && (
              <p className="text-xs text-amber-600">Saving moves the employee to this branch (their folder and documents move with them).</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Hours Per Week</Label>
            <Input value={form.hours_per_week ?? ''} onChange={(e) => set('hours_per_week', e.target.value)} placeholder="e.g. 40 or Zero" />
          </div>
          <div className="space-y-2">
            <Label>Pay</Label>
            <div className="flex gap-2">
              <Input value={form.salary_rate ?? ''} onChange={(e) => set('salary_rate', e.target.value)} placeholder="e.g. 12.50" />
              <Select value={form.salary_type || 'hourly'} onValueChange={(v) => set('salary_type', v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">per hour</SelectItem>
                  <SelectItem value="annual">per year</SelectItem>
                </SelectContent>
              </Select>
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
          <div className="space-y-2">
            <Label>VAT Number</Label>
            <Input value={form.vat_number || ''} onChange={(e) => set('vat_number', e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Place of Work (as printed on the contract)</Label>
            <Input value={form.place_of_work || ''} onChange={(e) => set('place_of_work', e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Registered Office</Label>
            <Textarea value={form.registered_office || ''} onChange={(e) => set('registered_office', e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Reason for the change{isApproved ? ' (required)' : ' (optional)'}</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Pay rate corrected after review" />
          </div>
        </fieldset>

        {isSuperAdmin && isApproved && (
          <div className="rounded-md border p-3 space-y-2">
            <Label className="flex items-center gap-2"><Upload className="h-4 w-4" /> Replace the signed copy</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg" className="max-w-xs" onChange={(e) => setSignedFile(e.target.files?.[0] || null)} />
              <Button variant="outline" size="sm" disabled={!signedFile || saving} onClick={handleReplaceSigned}>
                Upload replacement
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">The old file stays in storage and the replacement is logged in the history.</p>
          </div>
        )}

        <div className="rounded-md border p-3 space-y-2">
          <Label className="flex items-center gap-2"><History className="h-4 w-4" /> Change history</Label>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No changes recorded yet.</p>
          ) : (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
              {history.map((h) => (
                <li key={h.id} className="border-b last:border-0 pb-1.5">
                  <span className="font-medium">{h.changed_by_name || 'Someone'}</span>{' '}
                  <span className="text-muted-foreground">{new Date(h.changed_at).toLocaleString('en-GB')}</span>
                  <div>
                    {h.action === 'edit' && (
                      <>Changed <b>{CONTRACT_FIELD_LABELS[h.field || ''] || h.field}</b>: {formatLogValue(h.old_value)} → {formatLogValue(h.new_value)}</>
                    )}
                    {h.action === 'approve' && <>Approved the contract</>}
                    {h.action === 'reject' && <>Rejected the contract</>}
                    {h.action === 'reopen' && <>Reopened the contract for approval</>}
                    {h.action === 'signed_copy' && <>Replaced the signed copy</>}
                    {h.reason ? <span className="text-muted-foreground"> — {h.reason}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          {isSuperAdmin && isApproved && (
            <Button variant="outline" onClick={handleReopen} disabled={saving} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Reopen for approval
            </Button>
          )}
          {isSuperAdmin && (
            <Button onClick={handleSave} disabled={saving || nothingChanged} className="gap-2">
              <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
