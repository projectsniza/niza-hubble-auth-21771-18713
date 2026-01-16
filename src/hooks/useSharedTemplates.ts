import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SharedTemplate {
  id: string;
  title: string;
  description: string | null;
  template_type: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  content: any;
  organization_id: string | null;
  branch_id: string | null;
  shared_by: string;
  is_global: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoreTemplate {
  id: string;
  title: string;
  description: string | null;
  template_type: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  content: any;
  organization_id: string;
  branch_id: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useSharedTemplates() {
  const [templates, setTemplates] = useState<SharedTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('shared_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data || []) as SharedTemplate[]);
    } catch (error: any) {
      console.error('Error fetching shared templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createSharedTemplate = async (template: Partial<SharedTemplate>, file?: File) => {
    if (!user) return null;

    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const path = `shared-templates/${uniqueName}`;

        const { error: uploadError } = await supabase.storage
          .from('template-assets')
          .upload(path, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('template-assets')
          .getPublicUrl(path);

        filePath = urlData.publicUrl;
        fileName = file.name;
        fileSize = file.size;
      }

      const insertData = {
        title: template.title || 'Untitled',
        description: template.description,
        template_type: template.template_type || 'general',
        is_global: template.is_global ?? true,
        organization_id: template.organization_id,
        branch_id: template.branch_id,
        shared_by: user.id,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
      };

      const { data, error } = await supabase
        .from('shared_templates')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      toast.success('Template shared successfully');
      fetchTemplates();
      return data;
    } catch (error: any) {
      console.error('Error creating shared template:', error);
      toast.error('Failed to share template');
      return null;
    }
  };

  const deleteSharedTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shared_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast.success('Template removed');
      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting shared template:', error);
      toast.error('Failed to remove template');
    }
  };

  return {
    templates,
    isLoading,
    createSharedTemplate,
    deleteSharedTemplate,
    refetch: fetchTemplates,
  };
}

export function useStoreTemplates() {
  const [templates, setTemplates] = useState<StoreTemplate[]>([]);
  const [sharedTemplates, setSharedTemplates] = useState<SharedTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch store's own templates
      const { data: storeData, error: storeError } = await supabase
        .from('store_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (storeError) throw storeError;

      // Fetch shared templates from admin
      const { data: sharedData, error: sharedError } = await supabase
        .from('shared_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (sharedError) throw sharedError;

      setTemplates((storeData || []) as StoreTemplate[]);
      setSharedTemplates((sharedData || []) as SharedTemplate[]);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createStoreTemplate = async (template: Partial<StoreTemplate>, file?: File) => {
    if (!user || !user.organizationId || !user.branchId) {
      toast.error('Organization and branch required');
      return null;
    }

    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const path = `store-templates/${user.branchId}/${uniqueName}`;

        const { error: uploadError } = await supabase.storage
          .from('template-assets')
          .upload(path, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('template-assets')
          .getPublicUrl(path);

        filePath = urlData.publicUrl;
        fileName = file.name;
        fileSize = file.size;
      }

      const insertData = {
        title: template.title || 'Untitled',
        description: template.description,
        template_type: template.template_type || 'general',
        organization_id: user.organizationId,
        branch_id: user.branchId,
        created_by: user.id,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
      };

      const { data, error } = await supabase
        .from('store_templates')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      toast.success('Template created successfully');
      fetchTemplates();
      return data;
    } catch (error: any) {
      console.error('Error creating store template:', error);
      toast.error('Failed to create template');
      return null;
    }
  };

  const deleteStoreTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('store_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast.success('Template removed');
      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error('Failed to remove template');
    }
  };

  return {
    templates,
    sharedTemplates,
    isLoading,
    createStoreTemplate,
    deleteStoreTemplate,
    refetch: fetchTemplates,
  };
}
