import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { FileText, Upload, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDocumentSubmissions, DocumentSubmission } from '@/hooks/useDocumentSubmissions';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import DocumentSubmissionsSidebar from '@/components/documents/DocumentSubmissionsSidebar';

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="text-amber-600 border-amber-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case 'approved':
      return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
    case 'rejected':
      return <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function SubmitDocuments() {
  const { user } = useAuth();
  const { submissions, isLoading, pendingCount } = useDocumentSubmissions();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // Managers, HR, and super_admin can access this page
  if (!user || (user.role !== 'manager' && user.role !== 'hr' && user.role !== 'super_admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleViewDocument = async (submission: DocumentSubmission) => {
    try {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(submission.file_path, 3600);
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error('Failed to open document');
    }
  };

  // Filter to only show this user's submissions
  const mySubmissions = submissions.filter(s => s.submitted_by === user.id);

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Submit Documents</h1>
          <p className="text-muted-foreground">
            Upload employee documents for Super Admin approval
          </p>
        </div>
        <Button onClick={() => setShowSubmitDialog(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Submit Document
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mySubmissions.filter(s => s.status === 'pending').length}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mySubmissions.filter(s => s.status === 'approved').length}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mySubmissions.filter(s => s.status === 'rejected').length}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions List */}
      <Card>
        <CardHeader>
          <CardTitle>My Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <NizaLoaderInline />
            </div>
          ) : mySubmissions.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No submissions yet</p>
              <p className="text-sm mt-1">Click "Submit Document" to upload employee documents</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mySubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{submission.document_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>For: {submission.employee?.first_name} {submission.employee?.last_name}</span>
                        <span>•</span>
                        <span>{submission.branch?.name}</span>
                        <span>•</span>
                        <span>{format(new Date(submission.created_at), 'MMM d, yyyy')}</span>
                      </div>
                      {submission.status === 'rejected' && submission.rejection_reason && (
                        <p className="text-sm text-destructive mt-1">
                          Reason: {submission.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(submission.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewDocument(submission)}
                      title="View Document"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Dialog */}
      <DocumentSubmissionsSidebar
        open={showSubmitDialog}
        onClose={() => setShowSubmitDialog(false)}
      />
    </div>
  );
}
