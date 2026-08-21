import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Users, RefreshCw, UserMinus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { chunkValues, fetchAllPages } from '@/lib/supabasePagination';

interface ActiveStaff {
  user_id: string;
  branch_id: string;
  clock_in_time: string;
  name: string;
  branch: string;
}

interface BranchGroup {
  branch_id: string;
  branch: string;
  staff: ActiveStaff[];
}

export function StaffListLive() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<BranchGroup[]>([]);
  const [separated, setSeparated] = useState<Record<string, { left_on: string; reason: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [markDialog, setMarkDialog] = useState<{ open: boolean; emp?: any }>({ open: false });
  const [reason, setReason] = useState('');

  const isPrivileged = user?.role === 'super_admin' || user?.role === 'hr';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Currently clocked-in
      const cis = await fetchAllPages<any>((from, to) => {
        let query = supabase
          .from('clock_ins')
          .select('user_id, branch_id, clock_in_time, branch:branches(name)')
          .is('clock_out_time', null)
          .order('id');
        if (user?.role === 'manager' && user?.branchId) query = query.eq('branch_id', user.branchId);
        return query.range(from, to);
      });

      // Resolve names from profiles
      const userIds = Array.from(new Set((cis || []).map(c => c.user_id)));
      let profilesByUser: Record<string, string> = {};
      if (userIds.length) {
        for (const ids of chunkValues(userIds)) {
          const profs = await fetchAllPages<any>((from, to) => supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', ids)
            .order('id')
            .range(from, to));
          profs.forEach((p: any) => { profilesByUser[p.id] = p.name || p.email; });
        }
      }

      const byBranch: Record<string, BranchGroup> = {};
      (cis || []).forEach((c: any) => {
        const bid = c.branch_id || 'unassigned';
        if (!byBranch[bid]) {
          byBranch[bid] = { branch_id: bid, branch: c.branch?.name || 'Unassigned', staff: [] };
        }
        byBranch[bid].staff.push({
          user_id: c.user_id,
          branch_id: bid,
          clock_in_time: c.clock_in_time,
          name: profilesByUser[c.user_id] || 'Unknown user',
          branch: c.branch?.name || 'Unassigned',
        });
      });
      setGroups(Object.values(byBranch).sort((a, b) => a.branch.localeCompare(b.branch)));

      // All employees + separations
      const emps = await fetchAllPages<any>((from, to) => {
        let query = supabase
          .from('employees')
          .select('id, first_name, last_name, branch_id, branch:branches(name), organization_id, status')
          .in('status', ['active', 'onboarding', 'on_leave'])
          .order('id');
        if (user?.role === 'manager' && user?.branchId) query = query.eq('branch_id', user.branchId);
        return query.range(from, to);
      });
      setAllEmployees(emps);

      const seps = await fetchAllPages<any>((from, to) => supabase
        .from('employee_separations')
        .select('id, employee_id, left_on, reason')
        .order('id')
        .range(from, to));
      const sepMap: Record<string, { left_on: string; reason: string | null }> = {};
      seps.forEach((s: any) => { sepMap[s.employee_id] = { left_on: s.left_on, reason: s.reason }; });
      setSeparated(sepMap);
    } finally {
      setLoading(false);
    }
  }, [user?.role, user?.branchId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const markAsLeft = async () => {
    if (!markDialog.emp) return;
    const emp = markDialog.emp;
    const { error } = await supabase.from('employee_separations').insert({
      employee_id: emp.id,
      branch_id: emp.branch_id,
      organization_id: emp.organization_id,
      reason: reason.trim() || null,
      recorded_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`${emp.first_name} ${emp.last_name} flagged as left the job`);
    setMarkDialog({ open: false });
    setReason('');
    load();
  };

  const filteredEmps = allEmployees.filter(e => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${e.first_name} ${e.last_name}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Live in-store */}
      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-emerald-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              Live Staff in Store
              <Badge variant="outline" className="text-[10px]">auto-refresh 30s</Badge>
            </CardTitle>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-24"><NizaLoaderInline /></div>
          ) : groups.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">No staff currently clocked in</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map(g => (
                <Card key={g.branch_id} className="border">
                  <CardHeader className="py-2 px-3 border-b">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{g.branch}</span>
                      <Badge>{g.staff.length} inside</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 space-y-1">
                    {g.staff.map(s => (
                      <div key={s.user_id} className="flex items-center justify-between text-xs">
                        <span>{s.name}</span>
                        <span className="text-muted-foreground">since {format(new Date(s.clock_in_time), 'HH:mm')}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roster + separations */}
      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <CardTitle className="text-sm font-semibold">Staff Roster & Separations</CardTitle>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8 max-w-xs text-xs" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmps.map(e => {
                const sep = separated[e.id];
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.first_name} {e.last_name}</TableCell>
                    <TableCell>{e.branch?.name || '—'}</TableCell>
                    <TableCell>
                      {sep ? (
                        <Badge variant="destructive" className="text-[10px]">
                          LEFT — {format(new Date(sep.left_on), 'dd MMM yyyy')}
                          {sep.reason ? ` · ${sep.reason}` : ''}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 border-emerald-300 text-emerald-800 text-[10px]">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!sep && (
                        <Button size="sm" variant="outline" onClick={() => setMarkDialog({ open: true, emp: e })}>
                          <UserMinus className="h-3.5 w-3.5 mr-1" /> Mark as Left
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={markDialog.open} onOpenChange={(o) => !o && setMarkDialog({ open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark staff as Left the Job</DialogTitle>
          </DialogHeader>
          {markDialog.emp && (
            <div className="space-y-3 py-2">
              <p className="text-sm">{markDialog.emp.first_name} {markDialog.emp.last_name} — {markDialog.emp.branch?.name}</p>
              <div>
                <Label className="text-xs">Reason (optional)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkDialog({ open: false })}>Cancel</Button>
            <Button variant="destructive" onClick={markAsLeft}>Flag as Left</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
