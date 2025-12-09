import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, FileText, Settings, Upload, Trash2, Edit, GripVertical, 
  FileCheck, ChevronUp, ChevronDown, Eye, EyeOff, Layers
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// Mock data for custom pages
const mockCustomPages = [
  { id: '1', name: 'Health Declaration', order: 1, enabled: true, fieldsCount: 5 },
  { id: '2', name: 'Bank Details', order: 2, enabled: true, fieldsCount: 3 },
  { id: '3', name: 'Emergency Contacts', order: 3, enabled: false, fieldsCount: 4 },
];

// Mock data for contract templates
const mockContractTemplates = [
  { id: '1', name: 'Full-Time Employment Contract', type: 'full_time', isDefault: true },
  { id: '2', name: 'Part-Time Employment Contract', type: 'part_time', isDefault: false },
  { id: '3', name: 'Internship Agreement', type: 'intern', isDefault: false },
];

// Mock data for document requirements
const mockDocumentRequirements = [
  { id: '1', name: 'Right to Work', mandatory: true, locked: true, enabled: true, order: 1 },
  { id: '2', name: 'ID Proof (Passport/Driving License)', mandatory: true, locked: false, enabled: true, order: 2 },
  { id: '3', name: 'Address Proof', mandatory: false, locked: false, enabled: true, order: 3 },
  { id: '4', name: 'Bank Details Form', mandatory: true, locked: false, enabled: true, order: 4 },
  { id: '5', name: 'DBS Check Certificate', mandatory: false, locked: false, enabled: false, order: 5 },
];

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

export default function OnboardingSettings() {
  const [activeTab, setActiveTab] = useState('custom-pages');
  const [customPages, setCustomPages] = useState(mockCustomPages);
  const [contractTemplates, setContractTemplates] = useState(mockContractTemplates);
  const [documentRequirements, setDocumentRequirements] = useState(mockDocumentRequirements);
  
  // Dialog states
  const [isPageDialogOpen, setIsPageDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [editingDocument, setEditingDocument] = useState<any>(null);

  // Custom Pages Tab
  const CustomPagesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Custom Onboarding Pages</h3>
          <p className="text-sm text-muted-foreground">
            Create custom pages that appear between Basic Details and Contract Creation
          </p>
        </div>
        <Button onClick={() => { setEditingPage(null); setIsPageDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Custom Page
        </Button>
      </div>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800">
          Custom pages appear in the onboarding workflow in the order shown below. 
          Drag to reorder, or use the arrows to change sequence.
        </p>
      </Card>

      <div className="space-y-3">
        {customPages.sort((a, b) => a.order - b.order).map((page, index) => (
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
                    {page.fieldsCount} fields
                  </Badge>
                  {!page.enabled && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Disabled
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Order: Step {page.order + 1} (after Basic Details)</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => {
                    const newPages = [...customPages];
                    const currentIndex = newPages.findIndex(p => p.id === page.id);
                    if (currentIndex > 0) {
                      [newPages[currentIndex].order, newPages[currentIndex - 1].order] = 
                      [newPages[currentIndex - 1].order, newPages[currentIndex].order];
                      setCustomPages(newPages);
                    }
                  }}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={index === customPages.length - 1}
                  onClick={() => {
                    const newPages = [...customPages];
                    const currentIndex = newPages.findIndex(p => p.id === page.id);
                    if (currentIndex < newPages.length - 1) {
                      [newPages[currentIndex].order, newPages[currentIndex + 1].order] = 
                      [newPages[currentIndex + 1].order, newPages[currentIndex].order];
                      setCustomPages(newPages);
                    }
                  }}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                
                <Switch
                  checked={page.enabled}
                  onCheckedChange={(checked) => {
                    setCustomPages(pages => pages.map(p => 
                      p.id === page.id ? { ...p, enabled: checked } : p
                    ));
                  }}
                />
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditingPage(page); setIsPageDialogOpen(true); }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setCustomPages(pages => pages.filter(p => p.id !== page.id));
                    toast.success('Page deleted');
                  }}
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
              onClick={() => { setEditingPage(null); setIsPageDialogOpen(true); }}
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
        <Button onClick={() => setIsTemplateDialogOpen(true)} className="gap-2">
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
                  {template.isDefault && (
                    <Badge className="text-xs">Default</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground capitalize">{template.type.replace('_', ' ')}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                {!template.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Branding Section */}
      <div className="pt-6 border-t">
        <h4 className="font-semibold mb-4">Contract Branding</h4>
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Company Logo</Label>
              <p className="text-xs text-muted-foreground">Appears in contract header</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Logo
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Header Template</Label>
              <p className="text-xs text-muted-foreground">Custom header for all contracts</p>
            </div>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-1" />
              Edit Header
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Footer Template</Label>
              <p className="text-xs text-muted-foreground">Custom footer for all contracts</p>
            </div>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-1" />
              Edit Footer
            </Button>
          </div>
        </Card>
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
            Define mandatory and optional documents for employee onboarding
          </p>
        </div>
        <Button onClick={() => { setEditingDocument(null); setIsDocumentDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Document Type
        </Button>
      </div>

      <Card className="p-4 bg-green-50 border-green-200">
        <p className="text-sm text-green-800">
          <strong>Right to Work</strong> is locked as mandatory and cannot be removed or disabled. 
          All other documents can be configured as needed.
        </p>
      </Card>

      <div className="space-y-3">
        {documentRequirements.sort((a, b) => a.order - b.order).map((doc, index) => (
          <Card key={doc.id} className={`p-4 ${!doc.enabled ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-4">
              <div className="cursor-grab text-muted-foreground hover:text-foreground">
                <GripVertical className="h-5 w-5" />
              </div>
              
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-primary" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{doc.name}</span>
                  {doc.mandatory && (
                    <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                  )}
                  {doc.locked && (
                    <Badge variant="secondary" className="text-xs">Locked</Badge>
                  )}
                  {!doc.enabled && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Disabled</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Upload order: {doc.order}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={index === 0 || doc.locked}
                  onClick={() => {
                    const newDocs = [...documentRequirements];
                    const currentIndex = newDocs.findIndex(d => d.id === doc.id);
                    if (currentIndex > 0) {
                      [newDocs[currentIndex].order, newDocs[currentIndex - 1].order] = 
                      [newDocs[currentIndex - 1].order, newDocs[currentIndex].order];
                      setDocumentRequirements(newDocs);
                    }
                  }}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={index === documentRequirements.length - 1 || doc.locked}
                  onClick={() => {
                    const newDocs = [...documentRequirements];
                    const currentIndex = newDocs.findIndex(d => d.id === doc.id);
                    if (currentIndex < newDocs.length - 1) {
                      [newDocs[currentIndex].order, newDocs[currentIndex + 1].order] = 
                      [newDocs[currentIndex + 1].order, newDocs[currentIndex].order];
                      setDocumentRequirements(newDocs);
                    }
                  }}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                
                {!doc.locked && (
                  <>
                    <Switch
                      checked={doc.enabled}
                      onCheckedChange={(checked) => {
                        setDocumentRequirements(docs => docs.map(d => 
                          d.id === doc.id ? { ...d, enabled: checked } : d
                        ));
                      }}
                    />
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditingDocument(doc); setIsDocumentDialogOpen(true); }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setDocumentRequirements(docs => docs.filter(d => d.id !== doc.id));
                        toast.success('Document requirement removed');
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">Onboarding Configuration</p>
            <p className="text-sm text-muted-foreground">
              Configure custom pages, contract templates, and document requirements for the onboarding workflow
            </p>
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="custom-pages" className="gap-2">
            <Layers className="h-4 w-4" />
            Custom Pages
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-2">
            <FileText className="h-4 w-4" />
            Contract Settings
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileCheck className="h-4 w-4" />
            Document Requirements
          </TabsTrigger>
        </TabsList>

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

      {/* Add/Edit Custom Page Dialog */}
      <Dialog open={isPageDialogOpen} onOpenChange={setIsPageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPage ? 'Edit Custom Page' : 'Create Custom Page'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Page Name</Label>
              <Input placeholder="e.g., Health Declaration, Bank Details" defaultValue={editingPage?.name} />
            </div>
            <div className="space-y-2">
              <Label>Page Description (Optional)</Label>
              <Textarea placeholder="Instructions or description for this page" />
            </div>
            <div className="space-y-2">
              <Label>Add Form Fields</Label>
              <Card className="p-4 border-dashed">
                <div className="text-center text-muted-foreground">
                  <Plus className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Click to add fields to this page</p>
                  <p className="text-xs">Text, Number, Date, Dropdown, File Upload, etc.</p>
                </div>
              </Card>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPageDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              toast.success(editingPage ? 'Page updated' : 'Page created');
              setIsPageDialogOpen(false);
            }}>
              {editingPage ? 'Save Changes' : 'Create Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Document Dialog */}
      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDocument ? 'Edit Document Requirement' : 'Add Document Requirement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input placeholder="e.g., Driving License, Training Certificate" defaultValue={editingDocument?.name} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Mandatory</Label>
                <p className="text-xs text-muted-foreground">Employees must upload this document</p>
              </div>
              <Switch defaultChecked={editingDocument?.mandatory} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDocumentDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              toast.success(editingDocument ? 'Document updated' : 'Document added');
              setIsDocumentDialogOpen(false);
            }}>
              {editingDocument ? 'Save Changes' : 'Add Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contract Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input placeholder="e.g., Full-Time Employment Contract" />
            </div>
            <div className="space-y-2">
              <Label>Contract Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full-Time</SelectItem>
                  <SelectItem value="part_time">Part-Time</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Upload Template File</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Drop your template file here</p>
                <p className="text-xs text-muted-foreground">Supports .docx, .pdf</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              toast.success('Template added');
              setIsTemplateDialogOpen(false);
            }}>
              Add Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
