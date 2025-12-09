import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, FileText, Settings, Upload, Trash2, Edit, GripVertical, 
  FileCheck, ChevronUp, ChevronDown, Eye, Layers, Loader2, Save,
  ClipboardList, Wallet
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Field types for form builder
const fieldTypes = [
  { value: 'text', label: 'Text Input' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'file', label: 'File Upload' },
  { value: 'textarea', label: 'Text Area' },
];

interface FormSetting {
  id: string;
  form_type: string;
  enabled: boolean;
  form_order: number;
}

interface CustomPage {
  id: string;
  name: string;
  description: string | null;
  page_order: number;
  enabled: boolean;
  fields?: PageField[];
}

interface PageField {
  id: string;
  page_id: string;
  field_label: string;
  field_type: string;
  field_options: any;
  is_required: boolean;
  field_order: number;
  placeholder: string | null;
}

interface ContractTemplate {
  id: string;
  name: string;
  contract_type: string;
  template_file_path: string | null;
  is_default: boolean;
}

interface DocumentRequirement {
  id: string;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  is_locked: boolean;
  enabled: boolean;
  doc_order: number;
}

export default function OnboardingSettings() {
  const [activeTab, setActiveTab] = useState('forms');
  const [isLoading, setIsLoading] = useState(true);
  
  // Data states
  const [formSettings, setFormSettings] = useState<FormSetting[]>([]);
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>([]);
  const [documentRequirements, setDocumentRequirements] = useState<DocumentRequirement[]>([]);
  
  // Dialog states
  const [isPageDialogOpen, setIsPageDialogOpen] = useState(false);
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<CustomPage | null>(null);
  const [editingField, setEditingField] = useState<PageField | null>(null);
  const [editingDocument, setEditingDocument] = useState<DocumentRequirement | null>(null);
  const [selectedPageForFields, setSelectedPageForFields] = useState<CustomPage | null>(null);
  
  // Form states
  const [pageName, setPageName] = useState('');
  const [pageDescription, setPageDescription] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldPlaceholder, setFieldPlaceholder] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState('full_time');
  const [docName, setDocName] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [docMandatory, setDocMandatory] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // Fetch all data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch form settings
      const { data: settings } = await supabase
        .from('onboarding_form_settings')
        .select('*')
        .order('form_order');
      
      // Create default settings if none exist
      if (!settings || settings.length === 0) {
        const defaultSettings = [
          { form_type: 'application', enabled: true, form_order: 1 },
          { form_type: 'checklist', enabled: true, form_order: 2 },
          { form_type: 'bank_details', enabled: true, form_order: 3 }
        ];
        
        for (const setting of defaultSettings) {
          await supabase.from('onboarding_form_settings').insert(setting);
        }
        
        const { data: newSettings } = await supabase
          .from('onboarding_form_settings')
          .select('*')
          .order('form_order');
        setFormSettings(newSettings || []);
      } else {
        setFormSettings(settings);
      }

      // Fetch custom pages with fields
      const { data: pages, error: pagesError } = await supabase
        .from('onboarding_custom_pages')
        .select('*')
        .order('page_order');
      
      if (pagesError) throw pagesError;
      
      // Fetch fields for each page
      const pagesWithFields = await Promise.all((pages || []).map(async (page) => {
        const { data: fields } = await supabase
          .from('onboarding_page_fields')
          .select('*')
          .eq('page_id', page.id)
          .order('field_order');
        return { ...page, fields: fields || [] };
      }));
      
      setCustomPages(pagesWithFields);

      // Fetch contract templates
      const { data: templates, error: templatesError } = await supabase
        .from('contract_templates')
        .select('*')
        .order('created_at');
      
      if (templatesError) throw templatesError;
      setContractTemplates(templates || []);

      // Fetch document requirements
      const { data: docs, error: docsError } = await supabase
        .from('document_requirements')
        .select('*')
        .order('doc_order');
      
      if (docsError) throw docsError;
      setDocumentRequirements(docs || []);
    } catch (error: any) {
      toast.error('Failed to load settings: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle form setting
  const handleToggleFormSetting = async (formType: string, enabled: boolean) => {
    try {
      const existing = formSettings.find(s => s.form_type === formType);
      if (existing) {
        await supabase
          .from('onboarding_form_settings')
          .update({ enabled })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('onboarding_form_settings')
          .insert({ form_type: formType, enabled, form_order: formSettings.length + 1 });
      }
      setFormSettings(prev => prev.map(s => s.form_type === formType ? { ...s, enabled } : s));
      toast.success(`${formType.replace('_', ' ')} form ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Custom Page CRUD
  const handleSavePage = async () => {
    if (!pageName.trim()) {
      toast.error('Page name is required');
      return;
    }
    
    setIsSaving(true);
    try {
      if (editingPage) {
        const { error } = await supabase
          .from('onboarding_custom_pages')
          .update({ name: pageName, description: pageDescription })
          .eq('id', editingPage.id);
        
        if (error) throw error;
        toast.success('Page updated');
      } else {
        const maxOrder = Math.max(0, ...customPages.map(p => p.page_order));
        const { error } = await supabase
          .from('onboarding_custom_pages')
          .insert({ name: pageName, description: pageDescription, page_order: maxOrder + 1 });
        
        if (error) throw error;
        toast.success('Page created');
      }
      
      setIsPageDialogOpen(false);
      setPageName('');
      setPageDescription('');
      setEditingPage(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('onboarding_custom_pages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Page deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleTogglePage = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('onboarding_custom_pages')
        .update({ enabled })
        .eq('id', id);
      
      if (error) throw error;
      setCustomPages(pages => pages.map(p => p.id === id ? { ...p, enabled } : p));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleMovePageUp = async (page: CustomPage, index: number) => {
    if (index === 0) return;
    const prevPage = customPages[index - 1];
    try {
      await supabase
        .from('onboarding_custom_pages')
        .update({ page_order: prevPage.page_order })
        .eq('id', page.id);
      
      await supabase
        .from('onboarding_custom_pages')
        .update({ page_order: page.page_order })
        .eq('id', prevPage.id);
      
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleMovePageDown = async (page: CustomPage, index: number) => {
    if (index === customPages.length - 1) return;
    const nextPage = customPages[index + 1];
    try {
      await supabase
        .from('onboarding_custom_pages')
        .update({ page_order: nextPage.page_order })
        .eq('id', page.id);
      
      await supabase
        .from('onboarding_custom_pages')
        .update({ page_order: page.page_order })
        .eq('id', nextPage.id);
      
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Field CRUD
  const handleSaveField = async () => {
    if (!fieldLabel.trim() || !selectedPageForFields) {
      toast.error('Field label is required');
      return;
    }
    
    setIsSaving(true);
    try {
      if (editingField) {
        const { error } = await supabase
          .from('onboarding_page_fields')
          .update({ 
            field_label: fieldLabel, 
            field_type: fieldType,
            is_required: fieldRequired,
            placeholder: fieldPlaceholder 
          })
          .eq('id', editingField.id);
        
        if (error) throw error;
        toast.success('Field updated');
      } else {
        const pageFields = selectedPageForFields.fields || [];
        const maxOrder = Math.max(0, ...pageFields.map(f => f.field_order));
        const { error } = await supabase
          .from('onboarding_page_fields')
          .insert({ 
            page_id: selectedPageForFields.id,
            field_label: fieldLabel, 
            field_type: fieldType,
            is_required: fieldRequired,
            placeholder: fieldPlaceholder,
            field_order: maxOrder + 1
          });
        
        if (error) throw error;
        toast.success('Field added');
      }
      
      setIsFieldDialogOpen(false);
      resetFieldForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteField = async (id: string) => {
    try {
      const { error } = await supabase
        .from('onboarding_page_fields')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Field deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resetFieldForm = () => {
    setFieldLabel('');
    setFieldType('text');
    setFieldRequired(false);
    setFieldPlaceholder('');
    setEditingField(null);
  };

  // Contract Template CRUD
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Template name is required');
      return;
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('contract_templates')
        .insert({ 
          name: templateName, 
          contract_type: templateType,
          is_default: contractTemplates.length === 0
        });
      
      if (error) throw error;
      toast.success('Template created');
      
      setIsTemplateDialogOpen(false);
      setTemplateName('');
      setTemplateType('full_time');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contract_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Template deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Document Requirement CRUD
  const handleSaveDocument = async () => {
    if (!docName.trim()) {
      toast.error('Document name is required');
      return;
    }
    
    setIsSaving(true);
    try {
      if (editingDocument) {
        const { error } = await supabase
          .from('document_requirements')
          .update({ name: docName, description: docDescription, is_mandatory: docMandatory })
          .eq('id', editingDocument.id);
        
        if (error) throw error;
        toast.success('Document requirement updated');
      } else {
        const maxOrder = Math.max(0, ...documentRequirements.map(d => d.doc_order));
        const { error } = await supabase
          .from('document_requirements')
          .insert({ 
            name: docName, 
            description: docDescription, 
            is_mandatory: docMandatory,
            doc_order: maxOrder + 1
          });
        
        if (error) throw error;
        toast.success('Document requirement added');
      }
      
      setIsDocumentDialogOpen(false);
      setDocName('');
      setDocDescription('');
      setDocMandatory(false);
      setEditingDocument(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      const { error } = await supabase
        .from('document_requirements')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Document requirement removed');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleToggleDocument = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('document_requirements')
        .update({ enabled })
        .eq('id', id);
      
      if (error) throw error;
      setDocumentRequirements(docs => docs.map(d => d.id === id ? { ...d, enabled } : d));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getFormSettingEnabled = (formType: string) => {
    const setting = formSettings.find(s => s.form_type === formType);
    return setting?.enabled ?? true;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Standard Forms Tab
  const StandardFormsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Standard Onboarding Forms</h3>
        <p className="text-sm text-muted-foreground">
          Enable or disable standard forms in the onboarding workflow
        </p>
      </div>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800">
          These forms appear between Basic Details and Contract Creation steps. 
          Disabled forms will be skipped in the onboarding workflow.
        </p>
      </Card>

      <div className="space-y-3">
        {/* Application Form */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Application Form</p>
                <p className="text-sm text-muted-foreground">Employee application with personal details</p>
              </div>
            </div>
            <Switch
              checked={getFormSettingEnabled('application')}
              onCheckedChange={(checked) => handleToggleFormSetting('application', checked)}
            />
          </div>
        </Card>

        {/* Starter Checklist */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">HMRC Starter Checklist</p>
                <p className="text-sm text-muted-foreground">Tax information and employee statement</p>
              </div>
            </div>
            <Switch
              checked={getFormSettingEnabled('checklist')}
              onCheckedChange={(checked) => handleToggleFormSetting('checklist', checked)}
            />
          </div>
        </Card>

        {/* Bank Details */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Bank Account Details</p>
                <p className="text-sm text-muted-foreground">Bank information for salary payments</p>
              </div>
            </div>
            <Switch
              checked={getFormSettingEnabled('bank_details')}
              onCheckedChange={(checked) => handleToggleFormSetting('bank_details', checked)}
            />
          </div>
        </Card>
      </div>
    </div>
  );

  // Custom Pages Tab
  const CustomPagesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Custom Onboarding Pages</h3>
          <p className="text-sm text-muted-foreground">
            Create custom pages with form fields for additional data collection
          </p>
        </div>
        <Button onClick={() => { setEditingPage(null); setPageName(''); setPageDescription(''); setIsPageDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Custom Page
        </Button>
      </div>

      <div className="space-y-3">
        {customPages.sort((a, b) => a.page_order - b.page_order).map((page, index) => (
          <Card key={page.id} className={`p-4 ${!page.enabled ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-4">
              <div className="cursor-grab text-muted-foreground hover:text-foreground">
                <GripVertical className="h-5 w-5" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="font-medium">{page.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {(page.fields?.length || 0)} fields
                  </Badge>
                  {!page.enabled && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Disabled
                    </Badge>
                  )}
                </div>
                {page.description && (
                  <p className="text-xs text-muted-foreground mt-1">{page.description}</p>
                )}
                
                {/* Fields list */}
                {page.fields && page.fields.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {page.fields.map(field => (
                      <div key={field.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                        <span className="capitalize">{field.field_type}</span>
                        <span>-</span>
                        <span>{field.field_label}</span>
                        {field.is_required && <Badge variant="destructive" className="text-[10px] h-4">Required</Badge>}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 ml-auto"
                          onClick={() => {
                            setEditingField(field);
                            setFieldLabel(field.field_label);
                            setFieldType(field.field_type);
                            setFieldRequired(field.is_required);
                            setFieldPlaceholder(field.placeholder || '');
                            setSelectedPageForFields(page);
                            setIsFieldDialogOpen(true);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-destructive"
                          onClick={() => handleDeleteField(field.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1 text-xs"
                  onClick={() => {
                    setSelectedPageForFields(page);
                    resetFieldForm();
                    setIsFieldDialogOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3" />
                  Add Field
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => handleMovePageUp(page, index)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={index === customPages.length - 1}
                  onClick={() => handleMovePageDown(page, index)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                
                <Switch
                  checked={page.enabled}
                  onCheckedChange={(checked) => handleTogglePage(page.id, checked)}
                />
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { 
                    setEditingPage(page); 
                    setPageName(page.name);
                    setPageDescription(page.description || '');
                    setIsPageDialogOpen(true); 
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeletePage(page.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {customPages.length === 0 && (
          <Card className="p-8 text-center">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No custom pages created yet</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => { setEditingPage(null); setPageName(''); setPageDescription(''); setIsPageDialogOpen(true); }}
            >
              Create your first page
            </Button>
          </Card>
        )}
      </div>
    </div>
  );

  // Contract Settings Tab
  const ContractSettingsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Contract Templates</h3>
          <p className="text-sm text-muted-foreground">
            Manage contract templates with merge fields for auto-population
          </p>
        </div>
        <Button onClick={() => { setTemplateName(''); setTemplateType('full_time'); setIsTemplateDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Template
        </Button>
      </div>

      <Card className="p-4 bg-amber-50 border-amber-200">
        <p className="text-sm text-amber-800">
          <strong>Merge Fields:</strong> Use placeholders like {'{{employee_name}}'}, {'{{job_title}}'}, {'{{branch}}'}, {'{{salary}}'}, {'{{start_date}}'} in your templates. 
          These will be automatically replaced with employee data.
        </p>
      </Card>

      <div className="space-y-3">
        {contractTemplates.map((template) => (
          <Card key={template.id} className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{template.name}</span>
                  {template.is_default && (
                    <Badge className="text-xs">Default</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground capitalize">{template.contract_type.replace('_', ' ')}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </Button>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                {!template.is_default && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}

        {contractTemplates.length === 0 && (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No contract templates yet</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => { setTemplateName(''); setTemplateType('full_time'); setIsTemplateDialogOpen(true); }}
            >
              Add your first template
            </Button>
          </Card>
        )}
      </div>
    </div>
  );

  // Document Requirements Tab
  const DocumentRequirementsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Document Requirements</h3>
          <p className="text-sm text-muted-foreground">
            Configure required documents for employee onboarding
          </p>
        </div>
        <Button onClick={() => { setDocName(''); setDocDescription(''); setDocMandatory(false); setEditingDocument(null); setIsDocumentDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Document
        </Button>
      </div>

      <div className="space-y-3">
        {documentRequirements.sort((a, b) => a.doc_order - b.doc_order).map((doc) => (
          <Card key={doc.id} className={`p-4 ${!doc.enabled ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-4">
              <div className="cursor-grab text-muted-foreground hover:text-foreground">
                <GripVertical className="h-5 w-5" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" />
                  <span className="font-medium">{doc.name}</span>
                  {doc.is_mandatory && (
                    <Badge variant="destructive" className="text-xs">Required</Badge>
                  )}
                  {doc.is_locked && (
                    <Badge variant="secondary" className="text-xs">Locked</Badge>
                  )}
                  {!doc.enabled && (
                    <Badge variant="outline" className="text-xs">Disabled</Badge>
                  )}
                </div>
                {doc.description && (
                  <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={doc.enabled}
                  onCheckedChange={(checked) => handleToggleDocument(doc.id, checked)}
                  disabled={doc.is_locked}
                />
                
                {!doc.is_locked && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { 
                        setEditingDocument(doc);
                        setDocName(doc.name);
                        setDocDescription(doc.description || '');
                        setDocMandatory(doc.is_mandatory);
                        setIsDocumentDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteDocument(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}

        {documentRequirements.length === 0 && (
          <Card className="p-8 text-center">
            <FileCheck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No document requirements configured</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => { setDocName(''); setDocDescription(''); setDocMandatory(false); setEditingDocument(null); setIsDocumentDialogOpen(true); }}
            >
              Add your first document requirement
            </Button>
          </Card>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Onboarding Settings</h2>
        <p className="text-muted-foreground">Configure the employee onboarding workflow</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="forms" className="gap-2">
            <Settings className="h-4 w-4" />
            Standard Forms
          </TabsTrigger>
          <TabsTrigger value="custom-pages" className="gap-2">
            <Layers className="h-4 w-4" />
            Custom Pages
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-2">
            <FileText className="h-4 w-4" />
            Contracts
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileCheck className="h-4 w-4" />
            Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="forms" className="mt-6">
          <StandardFormsTab />
        </TabsContent>

        <TabsContent value="custom-pages" className="mt-6">
          <CustomPagesTab />
        </TabsContent>

        <TabsContent value="contracts" className="mt-6">
          <ContractSettingsTab />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <DocumentRequirementsTab />
        </TabsContent>
      </Tabs>

      {/* Page Dialog */}
      <Dialog open={isPageDialogOpen} onOpenChange={setIsPageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPage ? 'Edit' : 'Add'} Custom Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Page Name</Label>
              <Input
                placeholder="e.g., Emergency Contact"
                value={pageName}
                onChange={(e) => setPageName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Describe what this page collects..."
                value={pageDescription}
                onChange={(e) => setPageDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPageDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePage} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingPage ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Dialog */}
      <Dialog open={isFieldDialogOpen} onOpenChange={setIsFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit' : 'Add'} Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Field Label</Label>
              <Input
                placeholder="e.g., Phone Number"
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select value={fieldType} onValueChange={setFieldType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Placeholder (optional)</Label>
              <Input
                placeholder="e.g., Enter phone number..."
                value={fieldPlaceholder}
                onChange={(e) => setFieldPlaceholder(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="field-required"
                checked={fieldRequired}
                onCheckedChange={(checked) => setFieldRequired(checked as boolean)}
              />
              <Label htmlFor="field-required">Required field</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsFieldDialogOpen(false); resetFieldForm(); }}>Cancel</Button>
            <Button onClick={handleSaveField} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingField ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contract Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g., Full Time Contract"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Contract Type</Label>
              <Select value={templateType} onValueChange={setTemplateType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="temporary">Temporary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Dialog */}
      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDocument ? 'Edit' : 'Add'} Document Requirement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input
                placeholder="e.g., Passport Copy"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Describe the document..."
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="doc-mandatory"
                checked={docMandatory}
                onCheckedChange={(checked) => setDocMandatory(checked as boolean)}
              />
              <Label htmlFor="doc-mandatory">Mandatory document</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDocumentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDocument} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingDocument ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
