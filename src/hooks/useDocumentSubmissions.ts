import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logActivity } from './useActivityLogs';

export interface DocumentSubmission {
  id: string;
  organization_id: string;
  branch_id: string;
  employee_id: string;
  submitted_by: string;
  submitted_by_name: string;
  document_name: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  expiry_date: string | null;
  notes: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  organization?: {
    id: string;
    name: string;
  };
}

export const useDocumentSubmissions = (status?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: submissions = [], isLoading, refetch } = useQuery({
    queryKey: ['document-submissions', status],
    queryFn: async () => {
      let query = supabase
        .from('document_submissions')
        .select(`
          *,
          employee:employees(id, first_name, last_name, email),
          branch:branches(id, name),
          organization:organizations(id, name)
        `)
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DocumentSubmission[];
    },
    enabled: !!user,
  });

  const submitDocument = useMutation({
    mutationFn: async (params: {
      employeeId: string;
      documentName: string;
      filePath: string;
      fileName: string;
      fileSize?: number;
      fileType?: string;
      expiryDate?: string;
      notes?: string;
      organizationId: string;
      branchId: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('document_submissions')
        .insert({
          employee_id: params.employeeId,
          document_name: params.documentName,
          file_path: params.filePath,
          file_name: params.fileName,
          file_size: params.fileSize,
          file_type: params.fileType,
          expiry_date: params.expiryDate,
          notes: params.notes,
          organization_id: params.organizationId,
          branch_id: params.branchId,
          submitted_by: user.id,
          submitted_by_name: user.name,
          status: 'pending',
        })
        .select()
        .single();
      
      if (error) throw error;

      // Log activity for super admin notification
      await logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        activityType: 'document_submission',
        activityCategory: 'documents',
        title: 'New Document Submitted',
        description: `${user.name} submitted "${params.documentName}" for approval`,
        organizationId: params.organizationId,
        branchId: params.branchId,
        metadata: {
          document_name: params.documentName,
          employee_id: params.employeeId,
          submission_id: data.id,
        },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-submissions'] });
      toast.success('Document submitted for approval');
    },
    onError: (error) => {
      console.error('Submit error:', error);
      toast.error('Failed to submit document');
    },
  });

  const approveSubmission = useMutation({
    mutationFn: async (submissionId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Get the submission details first
      const { data: submission, error: fetchError } = await supabase
        .from('document_submissions')
        .select(`
          *,
          employee:employees(id, first_name, last_name, organization_id, branch_id)
        `)
        .eq('id', submissionId)
        .single();
      
      if (fetchError) throw fetchError;

      // Find the employee's folder
      const { data: employeeFolder, error: folderError } = await supabase
        .from('folders')
        .select('id')
        .eq('employee_id', submission.employee_id)
        .eq('folder_type', 'employee')
        .single();
      
      if (folderError) {
        console.error('Folder error:', folderError);
        throw new Error('Employee folder not found');
      }

      // Create the document in the documents table
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          title: submission.document_name,
          file_path: submission.file_path,
          file_name: submission.file_name,
          file_size: submission.file_size,
          file_type: submission.file_type,
          expiry_date: submission.expiry_date,
          folder_id: employeeFolder.id,
          employee_id: submission.employee_id,
          uploaded_by: user.id,
        });
      
      if (docError) throw docError;

      // Update the submission status
      const { error: updateError } = await supabase
        .from('document_submissions')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submissionId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document approved and added to employee folder');
    },
    onError: (error) => {
      console.error('Approve error:', error);
      toast.error('Failed to approve document');
    },
  });

  const rejectSubmission = useMutation({
    mutationFn: async ({ submissionId, reason }: { submissionId: string; reason: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('document_submissions')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', submissionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-submissions'] });
      toast.success('Document submission rejected');
    },
    onError: (error) => {
      console.error('Reject error:', error);
      toast.error('Failed to reject submission');
    },
  });

  return {
    submissions,
    isLoading,
    submitDocument: submitDocument.mutate,
    approveSubmission: approveSubmission.mutate,
    rejectSubmission: rejectSubmission.mutate,
    refetch,
    pendingCount: submissions.filter(s => s.status === 'pending').length,
  };
};
