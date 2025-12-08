import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Use any for database types to avoid strict type conflicts with Supabase
type Folder = any;
type Document = any;
type DocumentType = any;

export function useFolders() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .order('path');

      if (error) throw error;
      setFolders(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching folders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createFolder = async (
    name: string,
    parentId: string | null,
    organizationId: string | null,
    branchId: string | null,
    accessLevel: 'admin' | 'hr' | 'staff' | 'public' = 'admin'
  ) => {
    try {
      // Calculate path
      let path = name;
      if (parentId) {
        const parent = folders.find(f => f.id === parentId);
        if (parent) {
          path = `${parent.path}/${name}`;
        }
      }

      const { data, error } = await supabase
        .from('folders')
        .insert({
          name,
          parent_id: parentId,
          organization_id: organizationId,
          branch_id: branchId,
          folder_type: 'general',
          path,
          access_level: accessLevel,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;
      
      setFolders(prev => [...prev, data]);
      toast.success('Folder created');
      return { data, error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err.message };
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setFolders(prev => prev.filter(f => f.id !== id));
      toast.success('Folder deleted');
      return { error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { error: err.message };
    }
  };

  const buildFolderTree = useCallback(() => {
    const folderMap = new Map<string, Folder & { children: Folder[] }>();
    const roots: (Folder & { children: Folder[] })[] = [];

    // Create map with children arrays
    folders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Build tree
    folders.forEach(folder => {
      const node = folderMap.get(folder.id)!;
      if (folder.parent_id) {
        const parent = folderMap.get(folder.parent_id);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [folders]);

  useEffect(() => {
    if (user) {
      fetchFolders();
    }
  }, [user]);

  return {
    folders,
    folderTree: buildFolderTree(),
    isLoading,
    error,
    fetchFolders,
    createFolder,
    deleteFolder
  };
}

export function useDocuments(folderId?: string, employeeId?: string) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('documents')
        .select(`
          *,
          employee:employees(first_name, last_name, organization:organizations(name), branch:branches(name))
        `)
        .order('created_at', { ascending: false });

      if (folderId) {
        query = query.eq('folder_id', folderId);
      }
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [folderId, employeeId]);

  const uploadDocument = async (
    file: File,
    title: string,
    folderId: string | null,
    employeeId: string | null,
    expiryDate?: string,
    followUpDate?: string
  ) => {
    try {
      // Upload file to storage
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = employeeId 
        ? `employees/${employeeId}/${fileName}`
        : `general/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data, error } = await supabase
        .from('documents')
        .insert({
          title,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          folder_id: folderId,
          employee_id: employeeId,
          expiry_date: expiryDate || null,
          follow_up_date: followUpDate || null,
          uploaded_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;
      
      setDocuments(prev => [data, ...prev]);
      toast.success('Document uploaded successfully');
      return { data, error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err.message };
    }
  };

  const deleteDocument = async (id: string, filePath: string) => {
    try {
      // Delete from storage
      await supabase.storage
        .from('documents')
        .remove([filePath]);

      // Delete record
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success('Document deleted');
      return { error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { error: err.message };
    }
  };

  const getDocumentUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    return data?.signedUrl || null;
  };

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user, fetchDocuments]);

  return {
    documents,
    isLoading,
    error,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    getDocumentUrl
  };
}

export function useDocumentFollowUps() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFollowUps = async () => {
    try {
      setIsLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          employee:employees(
            first_name, 
            last_name, 
            organization:organizations(name), 
            branch:branches(name)
          )
        `)
        .not('follow_up_date', 'is', null)
        .lte('follow_up_date', thirtyDaysFromNow)
        .order('follow_up_date');

      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      console.error('Error fetching follow-ups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getOverdueCount = () => {
    const today = new Date().toISOString().split('T')[0];
    return documents.filter(d => d.follow_up_date && d.follow_up_date < today).length;
  };

  const getUpcomingCount = () => {
    const today = new Date().toISOString().split('T')[0];
    return documents.filter(d => d.follow_up_date && d.follow_up_date >= today).length;
  };

  const getOverdueDocuments = () => {
    const today = new Date().toISOString().split('T')[0];
    return documents.filter(d => d.follow_up_date && d.follow_up_date < today);
  };

  const getUpcomingDocuments = () => {
    const today = new Date().toISOString().split('T')[0];
    return documents.filter(d => d.follow_up_date && d.follow_up_date >= today);
  };

  useEffect(() => {
    if (user) {
      fetchFollowUps();
    }
  }, [user]);

  return {
    documents,
    isLoading,
    fetchFollowUps,
    getOverdueCount,
    getUpcomingCount,
    getOverdueDocuments,
    getUpcomingDocuments
  };
}

export function useDocumentTypes() {
  const { user } = useAuth();
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocumentTypes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setDocumentTypes(data || []);
    } catch (err: any) {
      console.error('Error fetching document types:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createDocumentType = async (name: string, description?: string, requiredFor: 'all' | 'organization' | 'branch' = 'all') => {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .insert({
          name,
          description,
          required_for: requiredFor,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;
      
      setDocumentTypes(prev => [...prev, data]);
      toast.success('Document type created');
      return { data, error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err.message };
    }
  };

  const deleteDocumentType = async (id: string) => {
    try {
      const { error } = await supabase
        .from('document_types')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      setDocumentTypes(prev => prev.filter(dt => dt.id !== id));
      toast.success('Document type removed');
      return { error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { error: err.message };
    }
  };

  useEffect(() => {
    if (user) {
      fetchDocumentTypes();
    }
  }, [user]);

  return {
    documentTypes,
    isLoading,
    fetchDocumentTypes,
    createDocumentType,
    deleteDocumentType
  };
}
