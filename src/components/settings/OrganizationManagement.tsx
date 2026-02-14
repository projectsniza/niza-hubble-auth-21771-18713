import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Building2, MapPin, Trash2, FolderOpen, Pencil } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import CreateOrganizationDialog from './CreateOrganizationDialog';
import CreateBranchDialog from './CreateBranchDialog';
import EditOrganizationDialog from './EditOrganizationDialog';
import EditBranchDialog from './EditBranchDialog';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';
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

export default function OrganizationManagement() {
  const { organizations, isLoading: orgsLoading, createOrganization, updateOrganization, deleteOrganization } = useOrganizations();
  const { branches, isLoading: branchesLoading, createBranch, updateBranch, deleteBranch } = useBranches();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [deleteOrgId, setDeleteOrgId] = useState<string | null>(null);
  const [deleteBranchId, setDeleteBranchId] = useState<string | null>(null);
  const [editOrg, setEditOrg] = useState<{ id: string; name: string; vat_number?: string | null; registration_number?: string | null; address?: string | null } | null>(null);
  const [editBranch, setEditBranch] = useState<{ id: string; name: string; address?: string | null } | null>(null);

  const handleCreateOrganization = async (name: string, autoCreateFolder: boolean, vatNumber?: string, registrationNumber?: string, address?: string) => {
    await createOrganization(name, autoCreateFolder, vatNumber, registrationNumber, address);
    setCreateOrgOpen(false);
  };

  const handleCreateBranch = async (name: string, address: string) => {
    if (!selectedOrgId) return;
    await createBranch(selectedOrgId, name, address);
    setCreateBranchOpen(false);
  };

  const handleDeleteOrganization = async () => {
    if (deleteOrgId) {
      await deleteOrganization(deleteOrgId);
      setDeleteOrgId(null);
    }
  };

  const handleDeleteBranch = async () => {
    if (deleteBranchId) {
      await deleteBranch(deleteBranchId);
      setDeleteBranchId(null);
    }
  };

  const handleUpdateOrganization = async (id: string, name: string, vatNumber?: string, registrationNumber?: string, address?: string) => {
    await updateOrganization(id, name, vatNumber, registrationNumber, address);
    setEditOrg(null);
  };

  const handleUpdateBranch = async (id: string, name: string, address?: string) => {
    await updateBranch(id, name, address);
    setEditBranch(null);
  };

  const getBranchesForOrg = (orgId: string) => {
    return branches.filter(b => b.organization_id === orgId);
  };

  if (orgsLoading || branchesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Organizations & Branches</h2>
          <p className="text-muted-foreground">Manage your company structure</p>
        </div>
        <Button onClick={() => setCreateOrgOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Organization
        </Button>
      </div>

      <div className="grid gap-6">
        {organizations.map((org) => (
          <Card key={org.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{org.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {getBranchesForOrg(org.id).length} branches
                      {org.registration_number && <span className="ml-2">• Reg: {org.registration_number}</span>}
                      {org.vat_number && <span className="ml-2">• VAT: {org.vat_number}</span>}
                    </p>
                  </div>
                  {org.auto_create_folder && (
                    <div className="ml-2 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      Auto Folder
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOrg({ id: org.id, name: org.name, vat_number: org.vat_number, registration_number: org.registration_number, address: (org as any).address })}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedOrgId(org.id);
                    setCreateBranchOpen(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Branch
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteOrgId(org.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {getBranchesForOrg(org.id).length > 0 && (
              <div className="ml-14 space-y-3 mt-4 border-l-2 border-primary/20 pl-6">
                {getBranchesForOrg(org.id).map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between p-4 rounded-lg bg-card/50 border">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-primary" />
                      <div>
                        <h4 className="font-semibold">{branch.name}</h4>
                        {branch.address && (
                          <p className="text-sm text-muted-foreground">{branch.address}</p>
                        )}
                      </div>
                      {branch.qr_enabled && (
                        <div className="ml-2 px-2 py-1 rounded-md bg-accent/10 text-accent text-xs">
                          QR Enabled
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditBranch({ id: branch.id, name: branch.name, address: branch.address })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteBranchId(branch.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}

        {organizations.length === 0 && (
          <Card className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No organizations yet</h3>
            <p className="text-muted-foreground mb-4">Create your first organization to get started</p>
            <Button onClick={() => setCreateOrgOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Organization
            </Button>
          </Card>
        )}
      </div>

      <CreateOrganizationDialog
        open={createOrgOpen}
        onOpenChange={setCreateOrgOpen}
        onSubmit={handleCreateOrganization}
      />

      <CreateBranchDialog
        open={createBranchOpen}
        onOpenChange={setCreateBranchOpen}
        onSubmit={handleCreateBranch}
      />

      <EditOrganizationDialog
        open={!!editOrg}
        onOpenChange={(open) => !open && setEditOrg(null)}
        organization={editOrg}
        onSubmit={handleUpdateOrganization}
      />

      <EditBranchDialog
        open={!!editBranch}
        onOpenChange={(open) => !open && setEditBranch(null)}
        branch={editBranch}
        onSubmit={handleUpdateBranch}
      />

      <AlertDialog open={!!deleteOrgId} onOpenChange={() => setDeleteOrgId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this organization and all its branches, employees, and documents.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrganization} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteBranchId} onOpenChange={() => setDeleteBranchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this branch and all associated employees and documents.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBranch} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
