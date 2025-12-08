import { EmployeeFormData } from '@/pages/dashboard/AddEmployee';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ExternalLink, Upload, Plus, X } from 'lucide-react';

interface DocumentsUploadStepProps {
  formData: EmployeeFormData;
  updateFormData: (updates: Partial<EmployeeFormData>) => void;
}

export default function DocumentsUploadStep({ formData, updateFormData }: DocumentsUploadStepProps) {
  const handleDocumentChange = (index: number, field: 'title' | 'file', value: string | File) => {
    const newDocuments = [...formData.additionalDocuments];
    if (field === 'title') {
      newDocuments[index] = { ...newDocuments[index], title: value as string };
    } else {
      newDocuments[index] = { ...newDocuments[index], file: value as File };
    }
    updateFormData({ additionalDocuments: newDocuments });
  };

  const addNewDocument = () => {
    updateFormData({
      additionalDocuments: [...formData.additionalDocuments, { title: '', file: null }]
    });
  };

  const removeDocument = (index: number) => {
    const newDocuments = formData.additionalDocuments.filter((_, i) => i !== index);
    updateFormData({ additionalDocuments: newDocuments });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Documents Upload</h2>
        <p className="text-muted-foreground">Upload required documents for the new employee</p>
      </div>

      <Card className="p-6 bg-primary/5 border-primary/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Right to Work Check</h3>
              <p className="text-sm text-muted-foreground">
                Verify the employee's right to work in the UK using their share code
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => window.open('https://www.gov.uk/view-right-to-work', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Check Share Code
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shareCode">Share Code</Label>
            <Input
              id="shareCode"
              placeholder="Enter share code from gov.uk verification"
              value={formData.rightToWorkShareCode}
              onChange={(e) => updateFormData({ rightToWorkShareCode: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Visit the link above to verify the employee's right to work and obtain their share code
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Required Documents</h3>
        <p className="text-sm text-muted-foreground">
          Upload scanned copies of essential employment documents
        </p>

        <div className="grid gap-4">
          {formData.additionalDocuments.map((doc, index) => (
            <Card key={index} className="p-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`doc-title-${index}`}>
                      Document Title {index < 8 && '*'}
                    </Label>
                    <Input
                      id={`doc-title-${index}`}
                      placeholder={
                        index === 0 ? 'Right to Work Document' :
                        index === 1 ? 'Starter Checklist' :
                        index === 2 ? 'Signed Contract' :
                        'Document title'
                      }
                      value={doc.title}
                      onChange={(e) => handleDocumentChange(index, 'title', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`doc-file-${index}`}>
                      Upload File {index < 8 && '*'}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={`doc-file-${index}`}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleDocumentChange(index, 'file', file);
                          }
                        }}
                        className="cursor-pointer"
                      />
                      {doc.file && (
                        <div className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                          <Upload className="h-4 w-4 mr-1" />
                          {doc.file.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {index >= 8 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDocument(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Button variant="outline" onClick={addNewDocument} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add More Documents
        </Button>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg space-y-2">
        <h4 className="font-semibold">Typical Required Documents:</h4>
        <ul className="text-sm space-y-1 ml-4 list-disc">
          <li>Right to Work verification (passport, visa, share code)</li>
          <li>Completed and signed Starter Checklist</li>
          <li>Signed Employment Contract</li>
          <li>Proof of address (utility bill, bank statement)</li>
          <li>National Insurance number verification</li>
          <li>Bank account details form</li>
          <li>Qualification certificates (if required for role)</li>
          <li>DBS check (if required for role)</li>
        </ul>
      </div>

      <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
        <p className="text-sm">
          <strong>Note:</strong> After submission, these documents will be automatically filed under 
          the employee's folder within their assigned branch. The contract will be sent to the Super 
          Admin for review and signing before being returned to you for the employee's signature.
        </p>
      </div>
    </div>
  );
}
