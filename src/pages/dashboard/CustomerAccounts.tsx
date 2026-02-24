import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Search, Building2, MapPin, Users2, Phone, Mail,
  MapPinIcon, PoundSterling, CheckCircle2, Clock, AlertCircle,
  ChevronRight, Edit, Trash2, Eye
} from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { useOrgBranch } from '@/contexts/OrgBranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerAccounts, CustomerAccount, CreateCustomerData, CustomerPendingSummary } from '@/hooks/useCustomerAccounts';
import { isAdminOrHR, isSuperAdmin } from '@/lib/roles';
import CustomerAccountDetail from '@/components/customer-accounts/CustomerAccountDetail';

export default function CustomerAccounts() {
  const { user } = useAuth();
  const { organizations, branches } = useOrgBranch();
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerAccount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAccount | null>(null);

  const { customers, isLoading, createCustomer, updateCustomer, deleteCustomer, pendingSummaries } = useCustomerAccounts(selectedOrg, selectedBranch);

  const canEdit = isAdminOrHR(user);
  const isManager = user?.role === 'manager';

  const filteredBranchOptions = selectedOrg
    ? branches.filter(b => b.organization_id === selectedOrg)
    : branches;

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q)
    );
  });

  // Stats
  const stats = {
    total: filteredCustomers.length,
    active: filteredCustomers.filter(c => c.status === 'active').length,
    inactive: filteredCustomers.filter(c => c.status === 'inactive').length,
  };

  const handleCreate = () => {
    setEditCustomer(null);
    setFormOpen(true);
  };

  const handleEdit = (customer: CustomerAccount) => {
    if (!canEdit) return;
    setEditCustomer(customer);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCustomer.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  if (selectedCustomer) {
    return (
      <CustomerAccountDetail
        customer={selectedCustomer}
        onBack={() => setSelectedCustomer(null)}
        canEdit={canEdit}
        isSuperAdmin={isSuperAdmin(user)}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customer Accounts</h1>
          <p className="text-muted-foreground">Manage customer accounts and monthly payments</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Customer
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 flex-wrap">
        {isAdminOrHR(user) && (
          <>
            <Select value={selectedOrg || 'all'} onValueChange={v => { setSelectedOrg(v === 'all' ? '' : v); setSelectedBranch(''); }}>
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
            <Select value={selectedBranch || 'all'} onValueChange={v => setSelectedBranch(v === 'all' ? '' : v)}>
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
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search customers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Users2 className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10"><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><AlertCircle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.inactive}</p>
                <p className="text-xs text-muted-foreground">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><NizaLoaderInline /></div>
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Customers Found</h3>
            <p className="text-muted-foreground">{searchQuery ? 'No records match your search' : 'Create your first customer account'}</p>
            <Button className="mt-4" onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCustomers.map(customer => {
            const pending = pendingSummaries.find(p => p.customer_id === customer.id);
            return (
              <CustomerCard
                key={customer.id}
                customer={customer}
                pendingSummary={pending || null}
                onView={() => setSelectedCustomer(customer)}
                onEdit={() => handleEdit(customer)}
                onDelete={() => setDeleteId(customer.id)}
                canEdit={canEdit}
              />
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <CustomerFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditCustomer(null); }}
        onSubmit={async (data) => {
          if (editCustomer) {
            await updateCustomer.mutateAsync({ id: editCustomer.id, ...data });
          } else {
            await createCustomer.mutateAsync(data as CreateCustomerData);
          }
          setFormOpen(false);
          setEditCustomer(null);
        }}
        editCustomer={editCustomer}
        isLoading={createCustomer.isPending || updateCustomer.isPending}
        isManager={isManager}
      />

      {/* Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the customer and all their account records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Customer Card Component ---
function CustomerCard({ customer, pendingSummary, onView, onEdit, onDelete, canEdit }: {
  customer: CustomerAccount;
  pendingSummary: CustomerPendingSummary | null;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  const hasPending = pendingSummary && pendingSummary.pending_months > 0;
  const statusColor = customer.status === 'active'
    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
    : 'bg-destructive/10 text-destructive border-destructive/30';

  return (
    <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-primary/20 overflow-hidden">
      {/* Top color bar */}
      <div className={`h-1.5 w-full ${hasPending ? 'bg-gradient-to-r from-destructive to-amber-500' : customer.status === 'active' ? 'bg-gradient-to-r from-primary to-accent' : 'bg-gradient-to-r from-destructive to-orange-400'}`} />
      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-lg shadow-md">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base leading-tight">{customer.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{customer.branches?.name || 'Unknown Branch'}</p>
            </div>
          </div>
          <Badge variant="outline" className={`text-[10px] px-2 ${statusColor}`}>
            {customer.status}
          </Badge>
        </div>

        {/* Contact info - compact */}
        <div className="space-y-1.5 mb-4">
          {customer.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5 flex-shrink-0" /><span>{customer.phone}</span>
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{customer.address}</span>
            </div>
          )}
        </div>

        {/* Pending dues highlight */}
        {hasPending ? (
          <div className="mb-4 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  {pendingSummary.pending_months} month{pendingSummary.pending_months > 1 ? 's' : ''} pending
                </span>
              </div>
              <span className="text-sm font-bold text-destructive">
                £{pendingSummary.total_pending.toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-600">All cleared</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" className="flex-1" onClick={onView}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />View Account
          </Button>
          {canEdit && (
            <>
              <Button size="sm" variant="outline" onClick={onEdit}><Edit className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Form Dialog ---
function CustomerFormDialog({ open, onClose, onSubmit, editCustomer, isLoading, isManager }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  editCustomer: CustomerAccount | null;
  isLoading: boolean;
  isManager: boolean;
}) {
  const { user } = useAuth();
  const { organizations, branches } = useOrgBranch();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [orgId, setOrgId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [notes, setNotes] = useState('');

  const filteredBranches = orgId ? branches.filter(b => b.organization_id === orgId) : branches;

  // Populate on edit
  const resetForm = () => {
    if (editCustomer) {
      setName(editCustomer.name);
      setEmail(editCustomer.email || '');
      setPhone(editCustomer.phone || '');
      setAddress(editCustomer.address || '');
      setOrgId(editCustomer.organization_id || '');
      setBranchId(editCustomer.branch_id);
      setNotes(editCustomer.notes || '');
    } else {
      setName(''); setEmail(''); setPhone(''); setAddress(''); setNotes('');
      if (isManager && user?.branchId) {
        setBranchId(user.branchId);
        setOrgId(user.organizationId || '');
      } else {
        setOrgId(''); setBranchId('');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); else resetForm(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" onOpenAutoFocus={() => resetForm()}>
        <DialogHeader>
          <DialogTitle>{editCustomer ? 'Edit Customer' : 'New Customer'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Customer Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Contact number" />
          </div>
          <div>
            <Label>Address</Label>
            <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" rows={2} />
          </div>
          {!isManager && (
            <>
              <div>
                <Label>Organization</Label>
                <Select value={orgId || 'none'} onValueChange={v => { setOrgId(v === 'none' ? '' : v); setBranchId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select...</SelectItem>
                    {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Branch *</Label>
                <Select value={branchId || 'none'} onValueChange={v => setBranchId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select...</SelectItem>
                    {filteredBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={async () => {
              if (!name.trim() || !branchId) return;
              await onSubmit({
                name: name.trim(),
                email: email || undefined,
                phone: phone || undefined,
                address: address || undefined,
                organization_id: orgId || undefined,
                branch_id: branchId,
                notes: notes || undefined,
              });
            }}
            disabled={isLoading || !name.trim() || !branchId}
          >
            {isLoading ? 'Saving...' : editCustomer ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
