import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Building2, MapPin } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
  organization_id: string;
}

interface OrgBranchFilterProps {
  organizations: Organization[];
  branches: Branch[];
  viewMode: 'all' | 'organization' | 'branch';
  selectedOrg: string;
  selectedBranch: string;
  onViewModeChange: (mode: 'all' | 'organization' | 'branch') => void;
  onOrgChange: (orgId: string) => void;
  onBranchChange: (branchId: string) => void;
  className?: string;
}

export function OrgBranchFilter({
  organizations,
  branches,
  viewMode,
  selectedOrg,
  selectedBranch,
  onViewModeChange,
  onOrgChange,
  onBranchChange,
  className = ''
}: OrgBranchFilterProps) {
  const filteredBranches = selectedOrg 
    ? branches.filter(b => b.organization_id === selectedOrg)
    : branches;

  return (
    <div className={`flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg border ${className}`}>
      <Label className="font-medium text-sm">View By:</Label>
      <div className="flex gap-2">
        <Button 
          variant={viewMode === 'all' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => {
            onViewModeChange('all');
            onOrgChange('');
            onBranchChange('');
          }}
        >
          All Company
        </Button>
        <Button 
          variant={viewMode === 'organization' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => onViewModeChange('organization')}
        >
          <Building2 className="h-4 w-4 mr-1" />
          By Organization
        </Button>
        <Button 
          variant={viewMode === 'branch' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => onViewModeChange('branch')}
        >
          <MapPin className="h-4 w-4 mr-1" />
          By Branch
        </Button>
      </div>

      {(viewMode === 'organization' || viewMode === 'branch') && (
        <Select 
          value={selectedOrg || 'all'} 
          onValueChange={(v) => {
            onOrgChange(v === 'all' ? '' : v);
            onBranchChange('');
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select Organization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organizations</SelectItem>
            {organizations.map(org => (
              <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {viewMode === 'branch' && (
        <Select 
          value={selectedBranch || 'all'} 
          onValueChange={(v) => onBranchChange(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select Branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {filteredBranches.map(branch => (
              <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
