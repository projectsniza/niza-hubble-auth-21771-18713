import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Organization, Branch } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errorUtils';

export function useOrganizations() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Error fetching organizations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createOrganization = useCallback(async (name: string, autoCreateFolder: boolean = true, vatNumber?: string) => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name,
          auto_create_folder: autoCreateFolder,
          vat_number: vatNumber,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;
      
      setOrganizations(prev => [...prev, data]);
      toast.success('Organization created successfully');
      return { data, error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return { data: null, error: message };
    }
  }, [user?.id]);

  const updateOrganization = useCallback(async (id: string, name: string, vatNumber?: string) => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .update({ name, vat_number: vatNumber })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setOrganizations(prev => prev.map(org => org.id === id ? { ...org, ...data } : org));
      toast.success('Organization updated successfully');
      return { data, error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return { data: null, error: message };
    }
  }, []);

  const deleteOrganization = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any).rpc('delete_organization_cascade', {
        p_organization_id: id,
      });

      if (error) throw error;

      setOrganizations(prev => prev.filter(org => org.id !== id));
      toast.success('Organization deleted');
      return { error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return { error: message };
    }
  }, []);

  useEffect(() => {
    if (user && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchOrganizations();
    }
  }, [user, fetchOrganizations]);

  return {
    organizations,
    isLoading,
    error,
    fetchOrganizations,
    createOrganization,
    updateOrganization,
    deleteOrganization
  };
}

export function useBranches(organizationId?: string) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastOrgIdRef = useRef<string | undefined>(undefined);

  const fetchBranches = useCallback(async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('branches')
        .select('*, organization:organizations(*)')
        .order('name');

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBranches(data || []);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Error fetching branches:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  const createBranch = useCallback(async (
    organizationId: string,
    name: string,
    address?: string,
    latitude?: number,
    longitude?: number,
    geofenceRadius?: number
  ) => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .insert({
          organization_id: organizationId,
          name,
          address,
          latitude,
          longitude,
          geofence_radius: geofenceRadius || 100,
          created_by: user?.id
        })
        .select('*, organization:organizations(*)')
        .single();

      if (error) throw error;
      
      setBranches(prev => [...prev, data]);
      toast.success('Branch created successfully');
      return { data, error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return { data: null, error: message };
    }
  }, [user?.id]);

  const updateBranch = useCallback(async (id: string, name: string, address?: string) => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .update({ name, address })
        .eq('id', id)
        .select('*, organization:organizations(*)')
        .single();

      if (error) throw error;
      
      setBranches(prev => prev.map(branch => branch.id === id ? { ...branch, ...data } : branch));
      toast.success('Branch updated successfully');
      return { data, error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return { data: null, error: message };
    }
  }, []);

  const deleteBranch = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any).rpc('delete_branch_cascade', {
        p_branch_id: id,
      });

      if (error) throw error;

      setBranches(prev => prev.filter(branch => branch.id !== id));
      toast.success('Branch deleted');
      return { error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return { error: message };
    }
  }, []);

  useEffect(() => {
    // Only fetch if user exists and organizationId changed
    if (user && lastOrgIdRef.current !== organizationId) {
      lastOrgIdRef.current = organizationId;
      fetchBranches();
    }
  }, [user, organizationId, fetchBranches]);

  return {
    branches,
    isLoading,
    error,
    fetchBranches,
    createBranch,
    updateBranch,
    deleteBranch
  };
}