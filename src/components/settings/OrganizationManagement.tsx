import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Building2, MapPin, Edit, Trash2, FolderOpen } from 'lucide-react';
import CreateOrganizationDialog from './CreateOrganizationDialog';
import CreateBranchDialog from './CreateBranchDialog';
import { toast } from 'sonner';

interface Branch {
  id: string;
  name: string;
  location: string;
  managerId?: string;
  hasDocumentFolder: boolean;
}

interface Organization {
  id: string;
  name: string;
  description: string;
  branches: Branch[];
  hasDocumentFolder: boolean;
}

export default function OrganizationManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [createBranchOpen, setCreateBranchOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('niza_organizations');
    if (stored) {
      setOrganizations(JSON.parse(stored));
    }
  }, []);

  const saveOrganizations = (orgs: Organization[]) => {
    setOrganizations(orgs);
    localStorage.setItem('niza_organizations', JSON.stringify(orgs));
  };

  const handleCreateOrganization = (org: Omit<Organization, 'id' | 'branches'>) => {
    const newOrg: Organization = {
      ...org,
      id: Date.now().toString(),
      branches: [],
    };
    saveOrganizations([...organizations, newOrg]);
    toast.success('Organization created successfully');
  };

  const handleCreateBranch = (branch: Omit<Branch, 'id'>) => {
    if (!selectedOrg) return;
    
    const updatedOrgs = organizations.map(org => {
      if (org.id === selectedOrg) {
        return {
          ...org,
          branches: [...org.branches, { ...branch, id: Date.now().toString() }]
        };
      }
      return org;
    });
    saveOrganizations(updatedOrgs);
    toast.success('Branch created successfully');
  };

  const handleDeleteOrganization = (orgId: string) => {
    saveOrganizations(organizations.filter(org => org.id !== orgId));
    toast.success('Organization deleted');
  };

  const handleDeleteBranch = (orgId: string, branchId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.id === orgId) {
        return {
          ...org,
          branches: org.branches.filter(b => b.id !== branchId)
        };
      }
      return org;
    });
    saveOrganizations(updatedOrgs);
    toast.success('Branch deleted');
  };

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
                    <p className="text-sm text-muted-foreground">{org.description}</p>
                  </div>
                  {org.hasDocumentFolder && (
                    <div className="ml-2 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      Document Folder
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedOrg(org.id);
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
                  onClick={() => handleDeleteOrganization(org.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {org.branches.length > 0 && (
              <div className="ml-14 space-y-3 mt-4 border-l-2 border-primary/20 pl-6">
                {org.branches.map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between p-4 rounded-lg bg-card/50 border">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-primary" />
                      <div>
                        <h4 className="font-semibold">{branch.name}</h4>
                        <p className="text-sm text-muted-foreground">{branch.location}</p>
                      </div>
                      {branch.hasDocumentFolder && (
                        <div className="ml-2 px-2 py-1 rounded-md bg-accent/10 text-accent text-xs flex items-center gap-1">
                          <FolderOpen className="h-3 w-3" />
                          Docs
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBranch(org.id, branch.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
    </div>
  );
}
