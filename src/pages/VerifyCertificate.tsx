import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { format } from 'date-fns';
import nizaLogo from '@/assets/niza-group-logo.png';

export default function VerifyCertificate() {
  const { token } = useParams<{ token: string }>();
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    verify();
  }, [token]);

  const verify = async () => {
    setLoading(true);
    try {
      // Try by verification_token first, then by id
      let { data } = await supabase
        .from('elearning_certificates')
        .select('*, courses(title, description)')
        .eq('verification_token', token!)
        .maybeSingle();

      if (!data) {
        const res = await supabase
          .from('elearning_certificates')
          .select('*, courses(title, description)')
          .eq('id', token!)
          .maybeSingle();
        data = res.data;
      }

      if (data) {
        setCertificate(data);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-primary/20 shadow-xl">
        <CardContent className="p-8 text-center space-y-6">
          <img src={nizaLogo} alt="Niza Group" className="h-12 mx-auto" />

          {notFound ? (
            <>
              <XCircle className="h-16 w-16 text-destructive mx-auto" />
              <h1 className="text-2xl font-bold text-destructive">Certificate Not Found</h1>
              <p className="text-muted-foreground">
                This certificate could not be verified. It may be invalid or has been revoked.
              </p>
            </>
          ) : certificate ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <Shield className="h-6 w-6 text-green-600" />
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-sm px-3 py-1">
                  Verified Certificate
                </Badge>
              </div>

              <Award className="h-20 w-20 text-amber-500 mx-auto" />

              <div>
                <h1 className="text-2xl font-bold text-foreground">Certificate of Completion</h1>
                <p className="text-muted-foreground mt-2">This is to certify that</p>
              </div>

              <h2 className="text-3xl font-bold text-primary">
                {certificate.employee_name || 'Employee'}
              </h2>

              <div>
                <p className="text-muted-foreground">has successfully completed</p>
                <h3 className="text-xl font-semibold text-foreground mt-1">
                  {certificate.course_title || certificate.courses?.title}
                </h3>
              </div>

              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">Date Issued</p>
                  <p>{certificate.issued_at ? format(new Date(certificate.issued_at), 'dd/MM/yyyy') : 'N/A'}</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                  <p className="font-medium text-foreground">Certificate ID</p>
                  <p className="font-mono text-xs">{certificate.certificate_number}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">This certificate is authentic and verified by Niza Group</span>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
