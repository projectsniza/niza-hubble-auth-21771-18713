import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile, UserRoleRecord, UserRole, HRAccessLevel } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UserWithRole extends Profile {
  role: UserRole;
}

export function useUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles = profiles?.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: (userRole?.role as UserRole) || 'employee'
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    try {
      // Check if role exists
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role })
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });

        if (error) throw error;
      }
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      toast.success('User role updated');
      return { error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { error: err.message };
    }
  };

  const updateUserProfile = async (
    userId: string, 
    updates: {
      name?: string;
      organization_id?: string | null;
      branch_id?: string | null;
      hr_access_level?: HRAccessLevel | null;
    }
  ) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u));
      toast.success('User profile updated');
      return { data, error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err.message };
    }
  };

  const getManagersAndHR = () => {
    return users.filter(u => u.role === 'manager' || u.role === 'hr' || u.role === 'super_admin');
  };

  const getManagersByBranch = (branchId: string) => {
    return users.filter(u => u.role === 'manager' && u.branch_id === branchId);
  };

  const getHRByOrganization = (organizationId: string) => {
    return users.filter(u => 
      u.role === 'hr' && 
      (u.hr_access_level === 'full' || u.organization_id === organizationId)
    );
  };

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user]);

  return {
    users,
    isLoading,
    error,
    fetchUsers,
    updateUserRole,
    updateUserProfile,
    getManagersAndHR,
    getManagersByBranch,
    getHRByOrganization
  };
}
