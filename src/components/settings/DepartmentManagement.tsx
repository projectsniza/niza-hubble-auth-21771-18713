import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit2, Check, X, Loader2, Building } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Department {
  id: string;
  name: string;
  organization_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function DepartmentManagement() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDepartment, setNewDepartment] = useState('');

  const ALL_ORGS_VALUE = '__all_orgs__';
  const [selectedOrg, setSelectedOrg] = useState<string>(ALL_ORGS_VALUE);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOrg, setFilterOrg] = useState<string>(ALL_ORGS_VALUE);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [deptRes, orgRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('organizations').select('id, name').order('name')
      ]);

      if (deptRes.data) setDepartments(deptRes.data);
      if (orgRes.data) setOrganizations(orgRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDepartment.trim()) {
      toast.error('Please enter a department name');
      return;
    }

    if (!user?.id) {
      toast.error('You must be logged in to add departments');
      return;
    }

    setSaving(true);
    try {
      const organizationIdToSave = selectedOrg === ALL_ORGS_VALUE ? null : selectedOrg;

      const { data, error } = await supabase.from('departments').insert({
        name: newDepartment.trim(),
        organization_id: organizationIdToSave,
        created_by: user.id,
        is_active: true
      }).select();

      if (error) {
        console.error('Department insert error:', error);
        throw error;
      }

      console.log('Department created:', data);
      toast.success('Department added successfully');
      setNewDepartment('');
      setSelectedOrg(ALL_ORGS_VALUE);
      fetchData();
    } catch (error: any) {
      console.error('Failed to add department:', error);
      toast.error(error.message || 'Failed to add department. Are you a Super Admin?');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDepartment = async (id: string) => {
    if (!editingName.trim()) {
      toast.error('Department name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('departments')
        .update({ name: editingName.trim() })
        .eq('id', id);

      if (error) throw error;

      toast.success('Department updated');
      setEditingId(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update department');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('departments')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Department ${!isActive ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update department');
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;

    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);

      if (error) throw error;

      toast.success('Department deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete department');
    }
  };

  const getOrgName = (orgId: string | null) => {
    if (!orgId) return 'All Organizations';
    return organizations.find(o => o.id === orgId)?.name || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Department Management
        </CardTitle>
        <CardDescription>
          Configure departments that will be available in employee onboarding forms
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Department */}
        <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1 space-y-2">
            <Label>Department Name</Label>
            <Input
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              placeholder="e.g., Retail, Management, Finance"
              onKeyDown={(e) => e.key === 'Enter' && handleAddDepartment()}
            />
          </div>
          <div className="w-full sm:w-48 space-y-2">
            <Label>Organization (Optional)</Label>
            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger>
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ORGS_VALUE}>All Organizations</SelectItem>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleAddDepartment} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search departments..."
            />
          </div>
          <div className="w-full sm:w-48">
            <Select value={filterOrg} onValueChange={setFilterOrg}>
              <SelectTrigger>
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ORGS_VALUE}>All Organizations</SelectItem>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Departments Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department Name</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead className="w-24 text-center">Active</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const filtered = departments.filter(dept => {
                  if (searchQuery && !dept.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                  if (filterOrg !== ALL_ORGS_VALUE && dept.organization_id !== filterOrg && dept.organization_id !== null) return false;
                  return true;
                });
                if (filtered.length === 0) return (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No departments found.
                    </TableCell>
                  </TableRow>
                );
                return filtered.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell>
                      {editingId === dept.id ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateDepartment(dept.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                      ) : (
                        <span className={!dept.is_active ? 'text-muted-foreground' : ''}>
                          {dept.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getOrgName(dept.organization_id)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={dept.is_active}
                        onCheckedChange={() => handleToggleActive(dept.id, dept.is_active)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === dept.id ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleUpdateDepartment(dept.id)}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingId(dept.id);
                              setEditingName(dept.name);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteDepartment(dept.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
