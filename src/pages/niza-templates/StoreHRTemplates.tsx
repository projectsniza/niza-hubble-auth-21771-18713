import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Download, Building, MapPin, Eye, FileText, List, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';
import { useTemplateTypes } from '@/hooks/useTemplateTypes';
import TemplateTypeManager from '@/components/templates/TemplateTypeManager';
import { format } from 'date-fns';

export default function StoreHRTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [filterOrg, setFilterOrg] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [layout, setLayout] = useState<'list' | 'folder'>('list');
  const [openedType, setOpenedType] = useState<string | null>(null);
  const { labelFor } = useTemplateTypes();

  useEffect(() => {
    fetchOrganizations();
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [viewMode, filterOrg, filterBranch, user]);

  useEffect(() => {
    if (filterOrg) fetchBranches(filterOrg);
  }, [filterOrg]);

  const fetchOrganizations = async () => {
    if (user?.role === 'hr' && user.organizationId) {
      const { data } = await supabase.from('organizations').select('id, name').eq('id', user.organizationId);
      setOrganizations(data || []);
    } else {
      const { data } = await supabase.from('organizations').select('id, name').order('name');
      setOrganizations(data || []);
    }
  };

  const fetchBranches = async (orgId: string) => {
    const { data } = await supabase.from('branches').select('id, name, organization_id').eq('organization_id', orgId).order('name');
    setBranches(data || []);
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('store_templates')
        .select('*, organization:organizations(name), branch:branches(name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (viewMode === 'branch' && filterBranch) {
        query = query.eq('branch_id', filterBranch);
      } else if (viewMode === 'organization' && filterOrg) {
        query = query.eq('organization_id', filterOrg);
      } else if (user?.role === 'hr' && user.organizationId) {
        query = query.eq('organization_id', user.organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching store templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Store & HR Templates
        </h1>
        <p className="text-muted-foreground mt-2">
          View and manage templates created by store and HR accounts
        </p>
      </div>

      <OrgBranchFilter
        organizations={organizations}
        branches={branches}
        viewMode={viewMode}
        selectedOrg={filterOrg}
        selectedBranch={filterBranch}
        onViewModeChange={setViewMode}
        onOrgChange={setFilterOrg}
        onBranchChange={setFilterBranch}
      />

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Templates ({templates.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No Store Templates</h3>
              <p className="text-sm text-muted-foreground">
                Templates created by store and HR accounts will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 transition-colors">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FolderOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium truncate">{template.title}</h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="capitalize">{template.template_type.replace('_', ' ')}</span>
                      <span>•</span>
                      {template.organization && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {template.organization.name}
                        </span>
                      )}
                      {template.branch && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {template.branch.name}
                        </span>
                      )}
                      <span>•</span>
                      <span>{format(new Date(template.created_at), 'MMM d, yyyy')}</span>
                    </div>
                    {template.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{template.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {template.file_path && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => setPreviewTemplate(template)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => window.open(template.file_path, '_blank')} title="Download">
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.title}</DialogTitle>
          </DialogHeader>
          {previewTemplate?.file_path && (
            <div className="flex-1 overflow-hidden">
              {previewTemplate.file_path.match(/\.(png|jpg|jpeg|gif|webp|svg)/i) ? (
                <img src={previewTemplate.file_path} alt={previewTemplate.title} className="w-full max-h-[60vh] object-contain rounded-lg" />
              ) : previewTemplate.file_path.match(/\.pdf/i) ? (
                <iframe src={previewTemplate.file_path} className="w-full h-[60vh] rounded-lg border" />
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Preview not available for this file type</p>
                  <Button className="mt-4" onClick={() => window.open(previewTemplate.file_path, '_blank')}>
                    <Download className="h-4 w-4 mr-2" /> Download File
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
