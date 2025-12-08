import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download } from 'lucide-react';
import { Document } from '@/types/documents';
import { format } from 'date-fns';
import sampleDocument from '@/assets/sample-document.png';

interface DocumentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document | null;
}

export default function DocumentDetailsDialog({ 
  open, 
  onOpenChange,
  document 
}: DocumentDetailsDialogProps) {
  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Document title */}
        <div className="pb-2">
          <h2 className="text-xl font-semibold">{document.name}</h2>
        </div>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="receipts">Read receipts & acceptance</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-0">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
              {/* Left Column - Preview */}
              <div className="space-y-4">
                <div className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden border-2">
                  <img 
                    src={sampleDocument}
                    alt="Document preview"
                    className="w-full h-full object-contain"
                  />
                  {document.isVerified && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-primary/95 text-primary-foreground px-8 py-6 rounded-lg shadow-2xl border-2 border-primary-foreground/20">
                        <div className="text-center">
                          <div className="font-bold text-lg">This document is verified and approved</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <Button className="w-full" size="lg">
                  <Download className="h-4 w-4 mr-2" />
                  Download document
                </Button>
              </div>

              {/* Right Column - Information */}
              <div className="space-y-1">
                <h3 className="text-lg font-semibold mb-6">Information</h3>
                
                <div className="space-y-1">
                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Filename</span>
                    <span className="text-sm font-medium text-right max-w-[60%] break-words text-primary hover:underline cursor-pointer">
                      {document.name}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">File Type</span>
                    <span className="text-sm font-medium">{document.type}</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Size</span>
                    <span className="text-sm font-medium">{document.size}</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Date created</span>
                    <span className="text-sm font-medium">{document.dateCreated}</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Uploaded by</span>
                    <span className="text-sm font-medium">{document.uploadedBy}</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Follow up date</span>
                    <span className="text-sm font-medium text-primary hover:underline cursor-pointer">
                      {document.followUpDate ? format(new Date(document.followUpDate), 'dd MMM yy') : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <p className="text-muted-foreground">Document settings will be displayed here.</p>
          </TabsContent>

          <TabsContent value="receipts" className="space-y-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Read receipts: {document.readReceipts.length} people</p>
              {document.readReceipts.length > 0 ? (
                <div className="space-y-2">
                  {document.readReceipts.map((receipt, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded-md text-sm">
                      <span>{receipt}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No read receipts yet</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
