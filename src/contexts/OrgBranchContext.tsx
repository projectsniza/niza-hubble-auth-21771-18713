import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Organization {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
  organization_id: string;
}

interface OrgBranchContextType {
  organizations: Organization[];
  branches: Branch[];
  isLoading: boolean;
  getBranchesByOrg: (orgId: string) => Branch[];
  refetch: () => Promise<void>;
}

const OrgBranchContext = createContext<OrgBranchContextType | undefined>(undefined);

export function OrgBranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const [orgsRes, branchesRes] = await Promise.all([
        supabase.from('organizations').select('id, name').order('name'),
        supabase.from('branches').select('id, name, organization_id').order('name')
      ]);
      
      // Scope the org/branch pickers to what the user may see:
      //  - specific branches (custom role)            -> only those branches
      //  - organisation-level (custom role or profile) -> that organisation's branches
      const scopedBranches = user.branchIds && user.branchIds.length > 0 ? user.branchIds : null;
      const scopedOrg = !scopedBranches && user.role !== 'super_admin' && user.hrAccessLevel === 'organization' && user.organizationId
        ? user.organizationId
        : null;
      const allBranches = branchesRes.data || [];
      const visibleBranches = scopedBranches
        ? allBranches.filter(b => scopedBranches.includes(b.id))
        : scopedOrg
          ? allBranches.filter(b => b.organization_id === scopedOrg)
          : allBranches;
      const allowedOrgIds = new Set(visibleBranches.map(b => b.organization_id));
      if (scopedOrg) allowedOrgIds.add(scopedOrg);

      setOrganizations(scopedBranches || scopedOrg ? (orgsRes.data || []).filter(o => allowedOrgIds.has(o.id)) : (orgsRes.data || []));
      setBranches(visibleBranches);
    } catch (error) {
      console.error('Error fetching org/branch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchData();
    }
  }, [user, fetchData]);

  // Reset on logout
  useEffect(() => {
    if (!user) {
      fetchedRef.current = false;
      setOrganizations([]);
      setBranches([]);
    }
  }, [user]);

  const getBranchesByOrg = useCallback((orgId: string) => {
    return branches.filter(b => b.organization_id === orgId);
  }, [branches]);

  const contextValue = useMemo(() => ({
    organizations,
    branches,
    isLoading,
    getBranchesByOrg,
    refetch: fetchData
  }), [organizations, branches, isLoading, getBranchesByOrg, fetchData]);

  return (
    <OrgBranchContext.Provider value={contextValue}>
      {children}
    </OrgBranchContext.Provider>
  );
}

export function useOrgBranch() {
  const context = useContext(OrgBranchContext);
  if (!context) {
    throw new Error('useOrgBranch must be used within OrgBranchProvider');
  }
  return context;
}
