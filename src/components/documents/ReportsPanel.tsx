import { useState } from 'react';
import { X, FileSpreadsheet, FileText, Filter, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';

interface ReportsPanelProps {
  onClose: () => void;
}

export default function ReportsPanel({ onClose }: ReportsPanelProps) {
  const [selectedFields, setSelectedFields] = useState<string[]>(['name', 'type', 'dateCreated']);
  const [reportName, setReportName] = useState('');

  const availableFields = [
    { id: 'name', label: 'Document Name' },
    { id: 'type', label: 'File Type' },
    { id: 'size', label: 'File Size' },
    { id: 'dateCreated', label: 'Date Created' },
    { id: 'uploadedBy', label: 'Uploaded By' },
    { id: 'tags', label: 'Tags' },
    { id: 'folder', label: 'Folder' },
    { id: 'version', label: 'Version' },
    { id: 'readReceipts', label: 'Read Receipts Count' },
    { id: 'followUpDate', label: 'Follow-up Date' },
  ];

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]
    );
  };

  const savedTemplates = [
    { id: '1', name: 'Monthly Summary', fields: 5 },
    { id: '2', name: 'Compliance Report', fields: 7 },
    { id: '3', name: 'Upload Activity', fields: 4 },
  ];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-2xl">Generate Report</CardTitle>
            <CardDescription>Create custom reports from your documents</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <ScrollArea className="flex-1">
          <CardContent className="space-y-6">
            {/* Saved Templates */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">Saved Templates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {savedTemplates.map(template => (
                  <Card key={template.id} className="cursor-pointer hover:border-primary transition-colors">
                    <CardContent className="p-4">
                      <p className="font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.fields} fields</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Separator />

            {/* Custom Report */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground">Custom Report</h3>
              
              <div className="space-y-2">
                <Label>Report Name</Label>
                <Input
                  placeholder="Enter report name..."
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label>Select Fields to Include</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border rounded-lg">
                  {availableFields.map(field => (
                    <div key={field.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={field.id}
                        checked={selectedFields.includes(field.id)}
                        onCheckedChange={() => toggleField(field.id)}
                      />
                      <Label
                        htmlFor={field.id}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {field.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters (Optional)
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Date Range</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">File Type</Label>
                    <Input placeholder="e.g., PDF, DOCX" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </ScrollArea>

        <Separator />

        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                Save Template
              </Button>
              <Button className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Export to Excel
              </Button>
              <Button className="gap-2">
                <Download className="h-4 w-4" />
                Export to PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
