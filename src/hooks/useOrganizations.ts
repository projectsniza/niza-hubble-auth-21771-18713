import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Organization, Branch } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useOrganizations() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching organizations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createOrganization = async (name: string, autoCreateFolder: boolean = true) => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name,
          auto_create_folder: autoCreateFolder,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;
      
      setOrganizations(prev => [...prev, data]);
      toast.success('Organization created successfully');
      return { data, error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err.message };
    }
  };

  const deleteOrganization = async (id: string) => {
    try {
      const { error } = await (supabase as any).rpc('delete_organization_cascade', {
        p_organization_id: id,
      });

      if (error) throw error;

      setOrganizations(prev => prev.filter(org => org.id !== id));
      toast.success('Organization deleted');
      return { error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { error: err.message };
    }
  };

  useEffect(() => {
    if (user) {
      fetchOrganizations();
    }
  }, [user]);

  return {
    organizations,
    isLoading,
    error,
    fetchOrganizations,
    createOrganization,
    deleteOrganization
  };
}

export function useBranches(organizationId?: string) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = async () => {
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
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching branches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createBranch = async (
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
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err.message };
    }
  };

  const deleteBranch = async (id: string) => {
    try {
      const { error } = await (supabase as any).rpc('delete_branch_cascade', {
        p_branch_id: id,
      });

      if (error) throw error;

      setBranches(prev => prev.filter(branch => branch.id !== id));
      toast.success('Branch deleted');
      return { error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { error: err.message };
    }
  };

  useEffect(() => {
    if (user) {
      fetchBranches();
    }
  }, [user, organizationId]);

  return {
    branches,
    isLoading,
    error,
    fetchBranches,
    createBranch,
    deleteBranch
  };
}
