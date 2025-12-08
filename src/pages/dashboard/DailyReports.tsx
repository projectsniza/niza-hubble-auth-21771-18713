import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, FileText, Calendar, User, Upload, Paperclip } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function DailyReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportType, setReportType] = useState('report');
  const [files, setFiles] = useState<File[]>([]);
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...uploadedFiles]);
  };

  const handleSubmitReport = () => {
    if (!reportTitle || files.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please provide a title and attach at least one file",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Report Submitted",
      description: `Your ${reportType} has been sent to the admin`,
    });

    setReportTitle('');
    setReportType('report');
    setFiles([]);
    setShowUploadDialog(false);
  };

  const reports = [
    { id: 1, date: '2024-11-03', author: 'John Smith', department: 'Operations', status: 'completed', summary: 'Daily operations report - all systems running smoothly' },
    { id: 2, date: '2024-11-02', author: 'Sarah Johnson', department: 'Sales', status: 'completed', summary: 'Sales meeting notes and customer feedback' },
    { id: 3, date: '2024-11-02', author: 'Mike Wilson', department: 'HR', status: 'pending', summary: 'Employee onboarding progress update' },
    { id: 4, date: '2024-11-01', author: 'Emma Brown', department: 'Finance', status: 'completed', summary: 'Weekly financial summary and forecasts' },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Daily Reports</h2>
          <p className="text-muted-foreground mt-1">
            {user?.role === 'manager' 
              ? 'Upload and submit reports and invoices to admin' 
              : 'Submit and track daily activity reports'}
          </p>
        </div>
        
        {user?.role === 'manager' ? (
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Report/Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload Report or Invoice</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reportTitle">Title *</Label>
                  <Input 
                    id="reportTitle" 
                    placeholder="Report/Invoice title..." 
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="invoice">Invoice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="files">Attach Files *</Label>
                  <div className="flex items-center gap-4">
                    <label htmlFor="files" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors">
                        <Paperclip className="h-4 w-4" />
                        <span className="text-sm">Choose Files</span>
                      </div>
                      <input
                        id="files"
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {files.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {files.length} file(s) selected
                      </span>
                    )}
                  </div>
                  {files.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {files.map((file, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                          <FileText className="h-3 w-3" />
                          {file.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={handleSubmitReport} className="w-full">
                  Submit to Admin
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Report
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Daily Report</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Report Date</label>
                  <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="text-sm font-medium">Department</label>
                  <Input placeholder="Enter department" />
                </div>
                <div>
                  <label className="text-sm font-medium">Summary</label>
                  <Input placeholder="Brief summary of the report" />
                </div>
                <div>
                  <label className="text-sm font-medium">Details</label>
                  <Textarea 
                    placeholder="Enter detailed report information..." 
                    rows={6}
                  />
                </div>
                <Button className="w-full">Submit Report</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search reports..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex gap-4 flex-1">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-foreground">{report.summary}</h3>
                    <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                      {report.status}
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {report.date}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {report.author}
                    </div>
                    <div>
                      {report.department}
                    </div>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm">View Details</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
