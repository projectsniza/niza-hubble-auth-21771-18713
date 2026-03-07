import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import nizaLogo from '@/assets/niza-group-logo.png';
import { format } from 'date-fns';

interface CertificatePreviewProps {
  certificate: any;
  design: any;
  onClose: () => void;
}

export default function CertificatePreview({ certificate, design, onClose }: CertificatePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);

  const verificationUrl = `${window.location.origin}/verify-certificate/${certificate.verification_token || certificate.id}`;
  const courseName = certificate.course_title || certificate.courses?.title || 'Course';
  const employeeName = certificate.employee_name || 'Employee';
  const issueDate = certificate.issued_at ? format(new Date(certificate.issued_at), 'dd MMMM yyyy') : 'N/A';
  const certNumber = certificate.certificate_number || 'N/A';

  const d = design || {
    border_style: 'classic',
    border_color: '#0066B3',
    accent_color: '#00A3E0',
    background_color: '#FFFFFF',
    text_color: '#1a1a1a',
    font_family: 'serif',
    show_logo: true,
    show_signature: true,
    signature_name: 'Training Director',
    signature_title: 'Niza Group',
    custom_footer_text: 'This certificate verifies the successful completion of the above-mentioned course.',
  };

  useEffect(() => {
    QRCode.toDataURL(verificationUrl, { width: 120, margin: 1, color: { dark: d.border_color } })
      .then(setQrDataUrl);

    if (d.show_logo) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setLogoImg(img);
      img.src = nizaLogo;
    }
  }, [verificationUrl, d]);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (d.show_logo && !logoImg) return;
    drawCertificate();
  }, [qrDataUrl, logoImg, d]);

  const drawCertificate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = 1120;
    const H = 790;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = d.background_color;
    ctx.fillRect(0, 0, W, H);

    // Border
    drawBorder(ctx, W, H, d.border_style, d.border_color, d.accent_color);

    // Logo
    let yPos = 80;
    if (d.show_logo && logoImg) {
      const lh = 60;
      const lw = (logoImg.width / logoImg.height) * lh;
      ctx.drawImage(logoImg, (W - lw) / 2, yPos, lw, lh);
      yPos += lh + 25;
    } else {
      yPos += 20;
    }

    // "Certificate of Completion" heading
    ctx.fillStyle = d.border_color;
    ctx.font = `bold 14px ${d.font_family === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.letterSpacing = '6px';
    ctx.fillText('CERTIFICATE OF COMPLETION', W / 2, yPos);
    ctx.letterSpacing = '0px';
    yPos += 40;

    // Decorative line
    ctx.strokeStyle = d.accent_color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 180, yPos);
    ctx.lineTo(W / 2 + 180, yPos);
    ctx.stroke();
    yPos += 35;

    // "This is to certify that"
    ctx.fillStyle = d.text_color + '99';
    ctx.font = `italic 16px ${d.font_family === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'}`;
    ctx.fillText('This is to certify that', W / 2, yPos);
    yPos += 45;

    // Employee Name
    ctx.fillStyle = d.border_color;
    ctx.font = `bold 36px ${d.font_family === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'}`;
    ctx.fillText(employeeName, W / 2, yPos);
    yPos += 15;

    // Underline for name
    const nameWidth = ctx.measureText(employeeName).width;
    ctx.strokeStyle = d.accent_color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo((W - nameWidth) / 2 - 20, yPos);
    ctx.lineTo((W + nameWidth) / 2 + 20, yPos);
    ctx.stroke();
    yPos += 40;

    // "has successfully completed"
    ctx.fillStyle = d.text_color + '99';
    ctx.font = `italic 16px ${d.font_family === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'}`;
    ctx.fillText('has successfully completed the course', W / 2, yPos);
    yPos += 45;

    // Course Name
    ctx.fillStyle = d.text_color;
    ctx.font = `bold 26px ${d.font_family === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'}`;
    // Wrap if too long
    const maxW = W - 200;
    if (ctx.measureText(courseName).width > maxW) {
      ctx.font = `bold 22px ${d.font_family === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'}`;
    }
    ctx.fillText(courseName, W / 2, yPos, maxW);
    yPos += 50;

    // Date
    ctx.fillStyle = d.text_color + 'AA';
    ctx.font = `15px ${d.font_family === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'}`;
    ctx.fillText(`Completed on ${issueDate}`, W / 2, yPos);
    yPos += 25;

    // Certificate Number
    ctx.fillStyle = d.text_color + '77';
    ctx.font = `12px ${d.font_family === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'}`;
    ctx.fillText(`Certificate ID: ${certNumber}`, W / 2, yPos);
    yPos += 45;

    // Signature area
    if (d.show_signature) {
      const sigY = H - 140;
      // Left: signature
      ctx.strokeStyle = d.text_color + '44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(180, sigY);
      ctx.lineTo(420, sigY);
      ctx.stroke();

      ctx.fillStyle = d.text_color;
      ctx.font = `bold 14px ${d.font_family === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'}`;
      ctx.fillText(d.signature_name, 300, sigY + 20);
      ctx.fillStyle = d.text_color + '88';
      ctx.font = `12px ${d.font_family === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'}`;
      ctx.fillText(d.signature_title, 300, sigY + 38);
    }

    // QR Code (bottom right)
    if (qrDataUrl) {
      const qrImg = new Image();
      qrImg.onload = () => {
        ctx.drawImage(qrImg, W - 190, H - 170, 110, 110);
        ctx.fillStyle = d.text_color + '77';
        ctx.font = `10px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Scan to verify', W - 135, H - 52);
        ctx.textAlign = 'center'; // reset
      };
      qrImg.src = qrDataUrl;
    }

    // Footer
    if (d.custom_footer_text) {
      ctx.fillStyle = d.text_color + '66';
      ctx.font = `11px ${d.font_family === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.fillText(d.custom_footer_text, W / 2, H - 35);
    }
  };

  const drawBorder = (ctx: CanvasRenderingContext2D, W: number, H: number, style: string, color: string, accent: string) => {
    const m = 20; // margin
    ctx.strokeStyle = color;

    if (style === 'classic') {
      // Double border
      ctx.lineWidth = 3;
      ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
      ctx.lineWidth = 1;
      ctx.strokeRect(m + 8, m + 8, W - 2 * (m + 8), H - 2 * (m + 8));

      // Corner ornaments
      const cs = 30;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      [[m + 4, m + 4], [W - m - 4, m + 4], [m + 4, H - m - 4], [W - m - 4, H - m - 4]].forEach(([x, y], i) => {
        ctx.beginPath();
        const dx = i % 2 === 0 ? 1 : -1;
        const dy = i < 2 ? 1 : -1;
        ctx.moveTo(x, y + dy * cs);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * cs, y);
        ctx.stroke();
      });
    } else if (style === 'modern') {
      // Thick top/bottom bars
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, 12);
      ctx.fillRect(0, H - 12, W, 12);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 12, W, 4);
      ctx.fillRect(0, H - 16, W, 4);
    } else if (style === 'elegant') {
      // Gradient border effect
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, color);
      grad.addColorStop(0.5, accent);
      grad.addColorStop(1, color);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4;
      ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
      // Inner dotted
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = accent + '66';
      ctx.strokeRect(m + 10, m + 10, W - 2 * (m + 10), H - 2 * (m + 10));
      ctx.setLineDash([]);
    } else if (style === 'gold') {
      // Gold shimmer border
      ctx.fillStyle = '#D4AF37';
      ctx.fillRect(m, m, W - 2 * m, 6);
      ctx.fillRect(m, H - m - 6, W - 2 * m, 6);
      ctx.fillRect(m, m, 6, H - 2 * m);
      ctx.fillRect(W - m - 6, m, 6, H - 2 * m);
      ctx.fillStyle = '#F0D060';
      ctx.fillRect(m + 10, m + 10, W - 2 * (m + 10), 3);
      ctx.fillRect(m + 10, H - m - 13, W - 2 * (m + 10), 3);
      ctx.fillRect(m + 10, m + 10, 3, H - 2 * (m + 10));
      ctx.fillRect(W - m - 13, m + 10, 3, H - 2 * (m + 10));
    } else {
      // minimal
      ctx.lineWidth = 2;
      ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
    }
  };

  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `certificate-${certNumber}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Certificate downloaded as PNG');
  };

  const handleDownloadPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`certificate-${certNumber}.pdf`);
    toast.success('Certificate downloaded as PDF');
  };

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-auto"
          style={{ maxHeight: '500px', objectFit: 'contain' }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Verification URL: <span className="font-mono text-primary">{verificationUrl}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPNG} className="gap-2">
            <Download className="h-4 w-4" /> PNG
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} className="gap-2">
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
