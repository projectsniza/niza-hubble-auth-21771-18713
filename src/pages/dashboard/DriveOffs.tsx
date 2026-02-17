import { useState } from 'react';
import { format, subMonths, addMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Download, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Fuel,
  PoundSterling,
  Car,
  AlertTriangle,
  Building2,
  MapPin
} from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { useOrgBranch } from '@/contexts/OrgBranchContext';
import { useDriveOffs, DriveOff, DriveOffFormData } from '@/hooks/useDriveOffs';
import { DriveOffFormDialog } from '@/components/drive-offs/DriveOffFormDialog';
import { DriveOffCard } from '@/components/drive-offs/DriveOffCard';
import { exportDriveOffsToCSV } from '@/components/drive-offs/DriveOffExport';
import { useAuth } from '@/contexts/AuthContext';

export default function DriveOffs() {
  const { user } = useAuth();
  const { organizations, branches } = useOrgBranch();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingDriveOff, setEditingDriveOff] = useState<DriveOff | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const { driveOffs, isLoading, createDriveOff, updateDriveOff, deleteDriveOff } = useDriveOffs(
    selectedMonth, 
    selectedOrg, 
    selectedBranch
  );
  
  const filteredBranchOptions = selectedOrg 
    ? branches.filter(b => b.organization_id === selectedOrg)
    : branches;

  // Filter by search query
  const filteredDriveOffs = driveOffs.filter(d => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      d.vehicle_registration.toLowerCase().includes(query) ||
      d.cashier_name.toLowerCase().includes(query) ||
      d.fuel_type.toLowerCase().includes(query) ||
      d.branches?.name?.toLowerCase().includes(query) ||
      d.remarks?.toLowerCase().includes(query)
    );
  });

  // Calculate statistics
  const stats = {
    total: filteredDriveOffs.length,
    totalAmount: filteredDriveOffs.reduce((sum, d) => sum + d.amount_drive_off, 0),
    totalLiters: filteredDriveOffs.reduce((sum, d) => sum + d.total_liters, 0),
    unpaid: filteredDriveOffs.filter(d => 
      d.amount_drive_off > (d.total_amount_received || 0)
    ).length,
    unpaidAmount: filteredDriveOffs.reduce((sum, d) => {
      const unpaid = d.amount_drive_off - (d.total_amount_received || 0);
      return sum + (unpaid > 0 ? unpaid : 0);
    }, 0),
  };

  const handleSubmit = async (data: DriveOffFormData) => {
    if (editingDriveOff) {
      await updateDriveOff.mutateAsync({ id: editingDriveOff.id, ...data });
    } else {
      await createDriveOff.mutateAsync(data);
    }
    setFormOpen(false);
    setEditingDriveOff(null);
  };

  const handleEdit = (driveOff: DriveOff) => {
    setEditingDriveOff(driveOff);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteDriveOff.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleExport = () => {
    exportDriveOffsToCSV(filteredDriveOffs, selectedMonth);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Drive-Offs</h1>
          <p className="text-muted-foreground">
            Track and manage fuel drive-off incidents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setEditingDriveOff(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Record Drive-Off
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={filteredDriveOffs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Monthly
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 flex-wrap">
        {(user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full')) && (
          <>
            <Select 
              value={selectedOrg || 'all'} 
              onValueChange={(v) => {
                setSelectedOrg(v === 'all' ? '' : v);
                setSelectedBranch('');
              }}
            >
              <SelectTrigger className="w-48">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={selectedBranch || 'all'} 
              onValueChange={(v) => setSelectedBranch(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-48">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {filteredBranchOptions.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        
        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-card border rounded-lg p-1">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center font-medium">
            {format(selectedMonth, 'MMMM yyyy')}
          </span>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by plate, cashier, fuel type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Incidents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <PoundSterling className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">£{stats.totalAmount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Amount</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Fuel className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalLiters.toFixed(1)}L</p>
                <p className="text-xs text-muted-foreground">Total Liters</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.unpaid}</p>
                <p className="text-xs text-muted-foreground">Unpaid Cases</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <PoundSterling className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">£{stats.unpaidAmount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drive-Off Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <NizaLoaderInline />
        </div>
      ) : filteredDriveOffs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Drive-Offs Found</h3>
            <p className="text-muted-foreground">
              {searchQuery 
                ? 'No records match your search criteria' 
                : `No drive-off incidents recorded for ${format(selectedMonth, 'MMMM yyyy')}`
              }
            </p>
            <Button 
              className="mt-4" 
              onClick={() => { setEditingDriveOff(null); setFormOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Record First Drive-Off
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDriveOffs.map((driveOff) => (
            <DriveOffCard
              key={driveOff.id}
              driveOff={driveOff}
              onEdit={handleEdit}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <DriveOffFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingDriveOff(null); }}
        onSubmit={handleSubmit}
        editingDriveOff={editingDriveOff}
        isLoading={createDriveOff.isPending || updateDriveOff.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Drive-Off Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The drive-off record will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
