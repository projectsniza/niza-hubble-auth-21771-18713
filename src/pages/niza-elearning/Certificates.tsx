import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Award, Download, Calendar, Settings, Eye, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { format } from 'date-fns';
import { toast } from 'sonner';
import CertificatePreview from '@/components/elearning/CertificatePreview';
import CertificateDesigner from '@/components/elearning/CertificateDesigner';
import jsPDF from 'jspdf';

export default function Certificates() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [designs, setDesigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('certificates');
  const [previewCert, setPreviewCert] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr';

  useEffect(() => { fetchData(); }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let certsPromise;
      if (isAdmin) {
        certsPromise = supabase
          .from('elearning_certificates')
          .select('*')
          .order('issued_at', { ascending: false })
          .limit(200)
          .then(r => r);
      } else {
        const { data: emp } = await supabase.from('employees').select('id').eq('user_id', user.id).single();
        if (!emp) { setLoading(false); return; }
        certsPromise = supabase
          .from('elearning_certificates')
          .select('*')
          .eq('employee_id', emp.id)
          .order('issued_at', { ascending: false })
          .then(r => r);
      }

      const designsPromise = supabase.from('certificate_designs').select('*').order('created_at').then(r => r);
      const results = await Promise.all([certsPromise, designsPromise]);

      setCertificates(results[0].data || []);
      setDesigns(results[1].data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (cert: any) => {
    const design = designs.find(d => d.id === cert.design_id) || designs.find(d => d.is_default) || designs[0];
    setPreviewCert({ ...cert, design });
    setShowPreview(true);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Certificates</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'Manage certificate designs and view all issued certificates' : 'View your earned certifications'}
          </p>
        </div>
      </div>

      {isAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="certificates" className="gap-2">
              <Award className="h-4 w-4" /> Certificates ({certificates.length})
            </TabsTrigger>
            <TabsTrigger value="designer" className="gap-2">
              <Palette className="h-4 w-4" /> Certificate Designer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="certificates">
            <CertificateGrid
              certificates={certificates}
              onPreview={handleDownloadPDF}
            />
          </TabsContent>

          <TabsContent value="designer">
            <CertificateDesigner
              designs={designs}
              onRefresh={fetchData}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <CertificateGrid
          certificates={certificates}
          onPreview={handleDownloadPDF}
        />
      )}

      {/* Certificate Preview / Download Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Certificate Preview</DialogTitle>
          </DialogHeader>
          {previewCert && (
            <CertificatePreview
              certificate={previewCert}
              design={previewCert.design}
              onClose={() => setShowPreview(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CertificateGrid({ certificates, onPreview }: { certificates: any[]; onPreview: (cert: any) => void }) {
  if (certificates.length === 0) {
    return (
      <div className="text-center py-16">
        <Award className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">No certificates yet</h3>
        <p className="text-sm text-muted-foreground">Complete courses to earn certificates</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {certificates.map(cert => (
        <Card key={cert.id} className="border-primary/20 hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="w-full h-32 rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/20 flex items-center justify-center mb-4 relative">
              <Award className="h-14 w-14 text-amber-500/60" />
              <div className="absolute top-2 right-2">
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Certificate</Badge>
              </div>
            </div>
            <h3 className="font-bold text-foreground">{cert.course_title || 'Untitled Course'}</h3>
            {cert.employee_name && (
              <p className="text-sm text-muted-foreground mt-1">{cert.employee_name}</p>
            )}
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Issued: {cert.issued_at ? format(new Date(cert.issued_at), 'dd/MM/yyyy') : 'N/A'}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">ID: {cert.certificate_number}</p>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => onPreview(cert)}>
                <Eye className="h-3 w-3" /> View & Download
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
