import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Award, Download, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { format } from 'date-fns';

export default function Certificates() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCertificates(); }, [user]);

  const fetchCertificates = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: emp } = await supabase.from('employees').select('id').eq('user_id', user.id).single();
      if (!emp) { setLoading(false); return; }

      const { data } = await supabase
        .from('elearning_certificates')
        .select('*, courses(title, description)')
        .eq('employee_id', emp.id)
        .order('issued_at', { ascending: false });

      setCertificates(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Certificates</h1>
        <p className="text-muted-foreground mt-1">View your earned certifications</p>
      </div>

      {certificates.length === 0 ? (
        <div className="text-center py-16">
          <Award className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No certificates yet</h3>
          <p className="text-sm text-muted-foreground">Complete courses to earn certificates</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certificates.map(cert => (
            <Card key={cert.id} className="border-primary/20 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-full h-32 rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/20 flex items-center justify-center mb-4 relative">
                  <Award className="h-14 w-14 text-amber-500/60" />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-amber-500/10 text-amber-600">Certificate</Badge>
                  </div>
                </div>
                <h3 className="font-bold text-foreground">{cert.courses?.title}</h3>
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Issued: {cert.issued_at ? format(new Date(cert.issued_at), 'dd/MM/yyyy') : 'N/A'}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">ID: {cert.certificate_number}</p>
                <Button variant="outline" size="sm" className="mt-3 w-full gap-2">
                  <Download className="h-3 w-3" /> Download Certificate
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
