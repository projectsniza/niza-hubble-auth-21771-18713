import { useState, useRef } from 'react';
import { Plus, Download, Upload, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBrandSettings } from '@/hooks/useTemplates';
import { captureElementToCanvas } from '@/lib/captureElementToCanvas';
import jsPDF from 'jspdf';
import nizaLogo from '@/assets/niza-group-logo.png';

interface CardData {
  name: string;
  designation: string;
  employeeId: string;
  department: string;
  bloodGroup: string;
  emergencyContact: string;
  photo: string | null;
  validFrom: string;
  validUntil: string;
  visitorCompany: string;
  visitPurpose: string;
  hostName: string;
  visitorName: string;
  badgeNumber: string;
  escortRequired: string;
}

const defaultCardData: CardData = {
  name: '', designation: '', employeeId: '', department: '',
  bloodGroup: '', emergencyContact: '', photo: null,
  validFrom: '', validUntil: '', visitorCompany: '',
  visitPurpose: '', hostName: '', visitorName: '',
  badgeNumber: '', escortRequired: 'No',
};

// Niza brand
const P = '#0066B3';
const S = '#00A3E0';
const A = '#004C8C';

const idCardTemplates = [
  { id: 1, name: 'Niza Premium' },
  { id: 2, name: 'Modern Gradient' },
  { id: 3, name: 'Executive Wave' },
  { id: 4, name: 'Corporate Edge' },
  { id: 5, name: 'Minimal Elite' },
];

const visitorPassTemplates = [
  { id: 1, name: 'Visitor Standard' },
  { id: 2, name: 'Temporary Badge' },
  { id: 3, name: 'Guest Pass' },
  { id: 4, name: 'Contractor Badge' },
  { id: 5, name: 'Event Visitor' },
];

export default function IDCards() {
  const [activeTab, setActiveTab] = useState('id-card');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cardType, setCardType] = useState<'id' | 'visitor'>('id');
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [cardData, setCardData] = useState<CardData>(defaultCardData);
  const { brandSettings } = useBrandSettings();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const logoUrl = brandSettings?.primary_logo_path || nizaLogo;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCardData({ ...cardData, photo: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = async (format: 'png' | 'jpg' | 'pdf') => {
    if (!cardRef.current) return;
    const canvas = await captureElementToCanvas(cardRef.current, { scale: 3, backgroundColor: '#ffffff' });
    if (format === 'pdf') {
      const pdf = new jsPDF({ orientation: orientation === 'vertical' ? 'portrait' : 'landscape', unit: 'mm', format: 'a6' });
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      pdf.save(`${cardType}-card-${cardData.name || 'template'}.pdf`);
    } else {
      const link = document.createElement('a');
      link.download = `${cardType}-card-${cardData.name || 'template'}.${format}`;
      link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`, 1.0);
      link.click();
    }
  };

  const PhotoCircle = ({ size, borderColor, rounded = 'full' }: { size: string; borderColor: string; rounded?: string }) => (
    <div className={`${size} rounded-${rounded} overflow-hidden border-[3px] shadow-lg bg-white flex items-center justify-center`} style={{ borderColor }}>
      {cardData.photo ? <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" /> : <User className="w-1/2 h-1/2 text-gray-300" />}
    </div>
  );

  const renderIDCardTemplate = (template: number, isPreview = false) => {
    const isV = orientation === 'vertical';
    const ref = isPreview ? cardRef : undefined;
    const base = isV ? 'w-[260px] h-[400px]' : 'w-[400px] h-[260px]';
    const align = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';

    // Template 1: Niza Premium — deep gradient header, gold accent line, frosted glass feel
    if (template === 1) {
      return (
        <div ref={ref} className={`${base} bg-white rounded-2xl overflow-hidden shadow-2xl relative`}>
          {/* Deep gradient header */}
          <div className="relative" style={{ background: `linear-gradient(135deg, ${A}, ${P}, ${S})`, height: isV ? '120px' : '100%', width: isV ? '100%' : '140px', position: isV ? 'relative' : 'absolute', left: 0, top: 0 }}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
            <div className={`relative z-10 ${isV ? 'p-4 flex items-center justify-between' : 'p-4 h-full flex flex-col items-center justify-start'}`}>
              <img src={logoUrl} alt="Logo" className={`${isV ? 'h-8' : 'h-7'} object-contain brightness-0 invert`} crossOrigin="anonymous" />
              <span className={`text-[10px] font-bold text-white/90 uppercase tracking-[0.2em] ${isV ? '' : 'mt-2 writing-mode-vertical'}`}>Employee ID</span>
            </div>
          </div>
          {/* Gold accent */}
          <div className={`${isV ? 'h-[2px] w-full' : 'w-[2px] h-full absolute top-0'}`} style={{ background: 'linear-gradient(90deg, #C9A84C, #E8D48B, #C9A84C)', left: isV ? undefined : '140px' }} />
          
          <div className={`${isV ? 'p-5 flex flex-col items-center' : 'pl-[150px] p-5 flex flex-col justify-center h-full'}`}>
            <div className={`${isV ? '-mt-12 relative z-20' : ''}`}>
              <PhotoCircle size={isV ? 'w-[88px] h-[88px]' : 'w-[72px] h-[72px]'} borderColor="#C9A84C" />
            </div>
            <div className={`${isV ? 'mt-3 w-full' : 'mt-0'} ${align}`}>
              <h3 className="font-bold text-lg text-gray-900 leading-tight">{cardData.name || 'Full Name'}</h3>
              <p className="text-sm font-semibold mt-0.5" style={{ color: P }}>{cardData.designation || 'Designation'}</p>
              <div className="mt-3 space-y-1.5 text-[11px] text-gray-600">
                <p><span className="font-bold text-gray-800">ID:</span> {cardData.employeeId || 'EMP-0000'}</p>
                <p><span className="font-bold text-gray-800">Dept:</span> {cardData.department || 'Department'}</p>
                {cardData.bloodGroup && <p><span className="font-bold text-gray-800">Blood:</span> {cardData.bloodGroup}</p>}
                {cardData.emergencyContact && <p><span className="font-bold text-gray-800">Emergency:</span> {cardData.emergencyContact}</p>}
              </div>
            </div>
          </div>
          {/* Bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 h-2" style={{ background: `linear-gradient(90deg, ${A}, ${P}, ${S})` }} />
        </div>
      );
    }

    // Template 2: Modern Gradient — full side gradient, clean layout
    if (template === 2) {
      return (
        <div ref={ref} className={`${base} bg-white rounded-2xl overflow-hidden shadow-2xl relative`}>
          <div className="absolute top-0 left-0 w-[6px] h-full" style={{ background: `linear-gradient(180deg, ${S}, ${P}, ${A})` }} />
          <div className="absolute top-0 right-0 w-[6px] h-full" style={{ background: `linear-gradient(180deg, ${A}, ${P}, ${S})` }} />
          <div className={`h-full ${isV ? 'flex flex-col' : 'flex'} px-6 py-5`}>
            <div className="flex items-center justify-between mb-3">
              <img src={logoUrl} alt="Logo" className="h-8 object-contain" crossOrigin="anonymous" />
              <div className="px-3 py-1 rounded-full text-[10px] font-bold text-white tracking-wider" style={{ background: `linear-gradient(135deg, ${P}, ${S})` }}>ID CARD</div>
            </div>
            <div className={`flex-1 ${isV ? 'flex flex-col items-center' : 'flex gap-4 items-center'}`}>
              <PhotoCircle size={isV ? 'w-[80px] h-[80px]' : 'w-[68px] h-[68px]'} borderColor={P} />
              <div className={`${isV ? 'mt-3 w-full' : 'flex-1'} ${align}`}>
                <h3 className="font-bold text-lg text-gray-900">{cardData.name || 'Full Name'}</h3>
                <p className="text-sm font-semibold" style={{ color: P }}>{cardData.designation || 'Designation'}</p>
              </div>
            </div>
            <div className="mt-auto pt-3 border-t" style={{ borderColor: `${P}20` }}>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                <p><span className="font-bold text-gray-800">ID:</span> {cardData.employeeId || 'EMP-0000'}</p>
                <p><span className="font-bold text-gray-800">Dept:</span> {cardData.department || 'Dept'}</p>
                {cardData.bloodGroup && <p><span className="font-bold text-gray-800">Blood:</span> {cardData.bloodGroup}</p>}
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, ${P}, ${S})` }} />
        </div>
      );
    }

    // Template 3: Executive Wave — large wave header
    if (template === 3) {
      return (
        <div ref={ref} className={`${base} bg-white rounded-2xl overflow-hidden shadow-2xl relative`}>
          <div className="absolute top-0 left-0 right-0" style={{ height: isV ? '110px' : '100%' }}>
            <svg viewBox="0 0 400 110" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: A }} />
                  <stop offset="50%" style={{ stopColor: P }} />
                  <stop offset="100%" style={{ stopColor: S }} />
                </linearGradient>
              </defs>
              <path d="M0,0 L400,0 L400,70 Q300,110 200,80 Q100,50 0,90 L0,0 Z" fill="url(#waveGrad)" />
              <path d="M0,0 L400,0 L400,60 Q300,95 200,70 Q100,40 0,80 L0,0 Z" fill="white" opacity="0.08" />
            </svg>
          </div>
          <div className={`relative h-full ${isV ? 'flex flex-col' : 'flex'} p-5`}>
            <div className="flex justify-between items-start mb-3 relative z-10">
              <img src={logoUrl} alt="Logo" className="h-7 object-contain brightness-0 invert" crossOrigin="anonymous" />
              <span className="text-[10px] font-bold text-white uppercase tracking-[0.15em]">Employee</span>
            </div>
            <div className={`flex-1 ${isV ? 'flex flex-col items-center mt-6' : 'flex gap-4 items-center'} relative z-10`}>
              <div className="ring-4 ring-white/50 rounded-full shadow-xl"><PhotoCircle size={isV ? 'w-[88px] h-[88px]' : 'w-[72px] h-[72px]'} borderColor="white" /></div>
              <div className={`${isV ? 'mt-4 w-full' : 'flex-1'} ${align}`}>
                <h3 className="font-bold text-xl text-gray-900">{cardData.name || 'Full Name'}</h3>
                <p className="text-sm font-semibold" style={{ color: P }}>{cardData.designation || 'Designation'}</p>
                <div className="mt-3 space-y-1 text-[11px] text-gray-600">
                  <p><span className="font-bold text-gray-800">ID:</span> {cardData.employeeId || 'EMP-0000'}</p>
                  <p><span className="font-bold text-gray-800">Department:</span> {cardData.department || 'Department'}</p>
                </div>
              </div>
            </div>
            {cardData.emergencyContact && <div className="mt-auto text-center text-[10px] text-gray-500 pt-2">Emergency: {cardData.emergencyContact}</div>}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, ${A}, ${P}, ${S})` }} />
        </div>
      );
    }

    // Template 4: Corporate Edge — sharp geometric
    if (template === 4) {
      return (
        <div ref={ref} className={`${base} bg-white rounded-2xl overflow-hidden shadow-2xl relative border border-gray-100`}>
          {/* Geometric corner */}
          <div className="absolute top-0 left-0 w-20 h-20">
            <svg viewBox="0 0 80 80" className="w-full h-full"><polygon points="0,0 80,0 0,80" fill={P} opacity="0.12" /></svg>
          </div>
          <div className="absolute bottom-0 right-0 w-20 h-20">
            <svg viewBox="0 0 80 80" className="w-full h-full"><polygon points="80,0 80,80 0,80" fill={S} opacity="0.12" /></svg>
          </div>
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${P}, ${S})` }} />
          <div className={`h-full ${isV ? 'flex flex-col' : 'flex'} p-5 relative z-10`}>
            <div className="flex items-center justify-between mb-4">
              <img src={logoUrl} alt="Logo" className="h-8 object-contain" crossOrigin="anonymous" />
              <div className="px-3 py-1 rounded text-[10px] font-bold text-white" style={{ backgroundColor: P }}>ID CARD</div>
            </div>
            <div className={`flex-1 ${isV ? '' : 'flex gap-4'}`}>
              <div className={`${isV ? 'flex gap-4 mb-4' : ''}`}>
                <PhotoCircle size={isV ? 'w-[72px] h-[72px]' : 'w-[80px] h-[80px]'} borderColor={`${P}40`} rounded="xl" />
                {isV && <div className={`flex-1 ${align}`}><h3 className="font-bold text-gray-900">{cardData.name || 'Full Name'}</h3><p className="text-sm" style={{ color: P }}>{cardData.designation || 'Designation'}</p></div>}
              </div>
              {!isV && <div className={`flex-1 ${align}`}><h3 className="font-bold text-lg text-gray-900">{cardData.name || 'Full Name'}</h3><p className="text-sm" style={{ color: P }}>{cardData.designation || 'Designation'}</p></div>}
            </div>
            <div className="mt-auto pt-3 border-t" style={{ borderColor: `${P}15` }}>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                <p><span className="font-bold text-gray-800">ID:</span> {cardData.employeeId || 'EMP-0000'}</p>
                <p><span className="font-bold text-gray-800">Dept:</span> {cardData.department || 'Dept'}</p>
                {cardData.bloodGroup && <p><span className="font-bold text-gray-800">Blood:</span> {cardData.bloodGroup}</p>}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Template 5: Minimal Elite
    return (
      <div ref={ref} className={`${base} bg-white rounded-2xl overflow-hidden shadow-2xl relative`}>
        <div className="h-1" style={{ backgroundColor: P }} />
        <div className={`h-full ${isV ? 'flex flex-col' : 'flex'} p-6`}>
          <div className="flex items-center gap-3 mb-5">
            <img src={logoUrl} alt="Logo" className="h-8 object-contain" crossOrigin="anonymous" />
            <div className="h-6 w-px" style={{ backgroundColor: `${P}25` }} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Employee</span>
          </div>
          <div className={`flex-1 ${isV ? 'flex flex-col items-center' : 'flex gap-6 items-center'}`}>
            <PhotoCircle size={isV ? 'w-[88px] h-[88px]' : 'w-[72px] h-[72px]'} borderColor={`${P}30`} />
            <div className={`${isV ? 'mt-4 w-full' : 'flex-1'} ${align}`}>
              <h3 className="font-semibold text-xl text-gray-900">{cardData.name || 'Full Name'}</h3>
              <p className="text-sm mt-1" style={{ color: P }}>{cardData.designation || 'Designation'}</p>
              <p className="text-[11px] text-gray-500 mt-2">{cardData.department || 'Department'}</p>
            </div>
          </div>
          <div className="mt-auto pt-4 flex items-center justify-between text-[11px] text-gray-500">
            <span className="font-medium">{cardData.employeeId || 'EMP-0000'}</span>
            {cardData.bloodGroup && <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${P}10`, color: P }}>{cardData.bloodGroup}</span>}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: P }} />
      </div>
    );
  };

  const renderVisitorPassTemplate = (template: number, isPreview = false) => {
    const isV = orientation === 'vertical';
    const ref = isPreview ? cardRef : undefined;
    const base = isV ? 'w-[260px] h-[400px]' : 'w-[400px] h-[260px]';
    const align = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';

    // Template 1: Visitor Standard — premium Niza branded
    if (template === 1) {
      return (
        <div ref={ref} className={`${base} bg-white rounded-2xl overflow-hidden shadow-2xl relative`}>
          <div className="py-3 px-4 text-center relative" style={{ background: `linear-gradient(135deg, ${P}, ${S})` }}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
            <div className="flex items-center justify-between relative z-10">
              <img src={logoUrl} alt="Logo" className="h-6 object-contain brightness-0 invert" crossOrigin="anonymous" />
              <span className="text-white font-bold text-sm tracking-[0.15em]">VISITOR</span>
            </div>
          </div>
          <div className={`p-4 ${isV ? 'flex flex-col items-center' : 'flex gap-4'}`}>
            <PhotoCircle size={isV ? 'w-[72px] h-[72px]' : 'w-[60px] h-[60px]'} borderColor={`${S}50`} rounded="xl" />
            <div className={`${isV ? 'mt-3 w-full' : 'flex-1'} ${align}`}>
              <h3 className="font-bold text-lg text-gray-900">{cardData.visitorName || cardData.name || 'Visitor Name'}</h3>
              <p className="text-sm text-gray-600">{cardData.visitorCompany || 'Company Name'}</p>
            </div>
          </div>
          <div className="px-4 pb-4 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between py-2 border-b border-gray-100"><span className="font-semibold text-gray-900">Purpose:</span><span>{cardData.visitPurpose || 'Meeting'}</span></div>
            <div className="flex justify-between py-2 border-b border-gray-100"><span className="font-semibold text-gray-900">Host:</span><span>{cardData.hostName || 'Host Name'}</span></div>
            <div className="flex justify-between py-2 border-b border-gray-100"><span className="font-semibold text-gray-900">Badge No:</span><span style={{ color: S }}>{cardData.badgeNumber || 'V-001'}</span></div>
            <div className="flex justify-between py-2"><span className="font-semibold text-gray-900">Valid Until:</span><span>{cardData.validUntil || 'DD/MM/YYYY'}</span></div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 py-2 text-center text-[10px] text-white font-medium" style={{ background: `linear-gradient(90deg, ${P}, ${S})` }}>Please return this pass when leaving</div>
        </div>
      );
    }

    // Template 2: Temporary Badge
    if (template === 2) {
      return (
        <div ref={ref} className={`${base} bg-white rounded-2xl overflow-hidden shadow-2xl relative`}>
          <div className="absolute top-0 left-0 right-0 h-20">
            <svg viewBox="0 0 400 80" className="w-full h-full" preserveAspectRatio="none">
              <defs><linearGradient id="tbGrad" x1="0%" y1="0%" x2="100%"><stop offset="0%" style={{ stopColor: P }} /><stop offset="100%" style={{ stopColor: S }} /></linearGradient></defs>
              <rect x="0" y="0" width="400" height="80" fill="url(#tbGrad)" opacity="0.08" />
            </svg>
          </div>
          <div className={`relative h-full ${isV ? 'flex flex-col' : 'flex'} p-5`}>
            <div className="flex justify-between items-start mb-4">
              <img src={logoUrl} alt="Logo" className="h-7 object-contain" crossOrigin="anonymous" />
              <div className="px-3 py-1 rounded-full text-[10px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${P}, ${S})` }}>TEMP BADGE</div>
            </div>
            <div className={`flex-1 ${isV ? 'flex flex-col items-center mt-4' : 'flex gap-4 items-center'}`}>
              <PhotoCircle size={isV ? 'w-[72px] h-[72px]' : 'w-[60px] h-[60px]'} borderColor={S} />
              <div className={`${isV ? 'mt-3 w-full' : 'flex-1'} ${align}`}>
                <h3 className="font-bold text-gray-900">{cardData.visitorName || cardData.name || 'Visitor Name'}</h3>
                <p className="text-sm" style={{ color: S }}>{cardData.visitorCompany || 'Company'}</p>
              </div>
            </div>
            <div className="mt-auto space-y-2 text-[11px] text-gray-700">
              <div className="flex justify-between"><span className="font-semibold text-gray-900">Visiting:</span><span>{cardData.hostName || 'Host Name'}</span></div>
              <div className="flex justify-between"><span className="font-semibold text-gray-900">Purpose:</span><span>{cardData.visitPurpose || 'Meeting'}</span></div>
              <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: `${S}30` }}>
                <span className="font-bold" style={{ color: S }}>{cardData.badgeNumber || 'V-001'}</span>
                <span className="text-gray-500">Expires: {cardData.validUntil || 'DD/MM/YYYY'}</span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, ${P}, ${S})` }} />
        </div>
      );
    }

    // Template 3: Guest Pass
    if (template === 3) {
      return (
        <div ref={ref} className={`${base} bg-white rounded-2xl overflow-hidden shadow-2xl relative`}>
          <div className="absolute top-0 left-0 right-0 h-28">
            <svg viewBox="0 0 400 120" className="w-full h-full" preserveAspectRatio="none">
              <defs><linearGradient id="gpGrad" x1="0%" y1="0%" x2="100%"><stop offset="0%" style={{ stopColor: P }} /><stop offset="100%" style={{ stopColor: S }} /></linearGradient></defs>
              <ellipse cx="200" cy="-30" rx="250" ry="120" fill="url(#gpGrad)" opacity="0.08" />
            </svg>
          </div>
          <div className={`relative h-full ${isV ? 'flex flex-col' : 'flex'} p-5`}>
            <div className="flex justify-between items-start mb-3">
              <img src={logoUrl} alt="Logo" className="h-7 object-contain" crossOrigin="anonymous" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: P }}>Guest Pass</span>
            </div>
            <div className={`flex-1 ${isV ? 'flex flex-col items-center mt-6' : 'flex gap-4 items-center'}`}>
              <PhotoCircle size={isV ? 'w-[88px] h-[88px]' : 'w-[72px] h-[72px]'} borderColor={`${S}40`} rounded="2xl" />
              <div className={`${isV ? 'mt-4 w-full' : 'flex-1'} ${align}`}>
                <h3 className="font-bold text-xl text-gray-900">{cardData.visitorName || cardData.name || 'Guest Name'}</h3>
                <p className="text-sm text-gray-600">{cardData.visitorCompany || 'Organization'}</p>
              </div>
            </div>
            <div className="mt-auto rounded-xl p-3 text-[11px]" style={{ backgroundColor: `${P}08` }}>
              <div className="grid grid-cols-2 gap-2 text-gray-700">
                <p><span className="font-semibold text-gray-900">Host:</span> {cardData.hostName || 'Host'}</p>
                <p><span className="font-semibold text-gray-900">Purpose:</span> {cardData.visitPurpose || 'Visit'}</p>
                <p><span className="font-semibold text-gray-900">Badge:</span> <span style={{ color: P }}>{cardData.badgeNumber || 'V-001'}</span></p>
                <p><span className="font-semibold text-gray-900">Valid:</span> {cardData.validUntil || 'DD/MM/YYYY'}</p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, ${P}, ${S})` }} />
        </div>
      );
    }

    // Template 4: Contractor Badge
    if (template === 4) {
      return (
        <div ref={ref} className={`${base} bg-white rounded-2xl overflow-hidden shadow-2xl border-l-4 relative`} style={{ borderLeftColor: A }}>
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${A}, ${P})` }} />
          <div className={`h-full ${isV ? 'flex flex-col' : 'flex'} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <img src={logoUrl} alt="Logo" className="h-7 object-contain" crossOrigin="anonymous" />
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: A }} />
                <span className="text-[10px] font-bold uppercase" style={{ color: A }}>Contractor</span>
              </div>
            </div>
            <div className={`flex-1 ${isV ? '' : 'flex gap-4'}`}>
              <div className={`${isV ? 'flex gap-4 mb-4' : ''}`}>
                <PhotoCircle size={isV ? 'w-[60px] h-[60px]' : 'w-[72px] h-[72px]'} borderColor={`${A}30`} rounded="xl" />
                {isV && <div className={`flex-1 ${align}`}><h3 className="font-bold text-gray-900">{cardData.visitorName || cardData.name || 'Contractor Name'}</h3><p className="text-sm text-gray-600">{cardData.visitorCompany || 'Company'}</p></div>}
              </div>
              {!isV && <div className={`flex-1 ${align}`}><h3 className="font-bold text-gray-900">{cardData.visitorName || cardData.name || 'Contractor Name'}</h3><p className="text-sm text-gray-600">{cardData.visitorCompany || 'Company'}</p></div>}
            </div>
            <div className="mt-auto space-y-2 text-[11px] text-gray-700 pt-3 border-t border-gray-100">
              <div className="flex justify-between"><span className="font-semibold text-gray-900">Work Area:</span><span>{cardData.visitPurpose || 'Area'}</span></div>
              <div className="flex justify-between"><span className="font-semibold text-gray-900">Escort:</span><span className={cardData.escortRequired === 'Yes' ? 'font-bold' : ''} style={{ color: cardData.escortRequired === 'Yes' ? A : 'inherit' }}>{cardData.escortRequired || 'No'}</span></div>
              <div className="flex justify-between"><span className="font-semibold text-gray-900">Supervisor:</span><span>{cardData.hostName || 'Supervisor'}</span></div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="font-bold" style={{ color: A }}>{cardData.badgeNumber || 'C-001'}</span>
                <span className="text-gray-500">{cardData.validFrom || 'Start'} - {cardData.validUntil || 'End'}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Template 5: Event Visitor
    return (
      <div ref={ref} className={`${base} bg-white rounded-2xl overflow-hidden shadow-2xl relative`}>
        <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-15" style={{ background: `linear-gradient(135deg, ${P}, ${S})` }} />
        <div className="absolute bottom-0 left-0 w-24 h-24 -ml-12 -mb-12 rounded-full opacity-10" style={{ background: `linear-gradient(135deg, ${A}, ${P})` }} />
        <div className={`relative h-full ${isV ? 'flex flex-col' : 'flex'} p-5`}>
          <div className="flex justify-between items-start mb-4">
            <img src={logoUrl} alt="Logo" className="h-7 object-contain" crossOrigin="anonymous" />
            <div className="px-3 py-1 rounded text-[10px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${P}, ${S})` }}>EVENT</div>
          </div>
          <div className={`flex-1 ${isV ? 'flex flex-col items-center' : 'flex gap-4 items-center'}`}>
            <PhotoCircle size={isV ? 'w-[72px] h-[72px]' : 'w-[60px] h-[60px]'} borderColor={`${S}40`} rounded="xl" />
            <div className={`${isV ? 'mt-4 w-full' : 'flex-1'} ${align}`}>
              <h3 className="font-bold text-lg text-gray-900">{cardData.visitorName || cardData.name || 'Attendee Name'}</h3>
              <p className="text-sm text-gray-600">{cardData.visitorCompany || 'Organization'}</p>
            </div>
          </div>
          <div className="mt-auto text-[11px] text-gray-700">
            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl" style={{ backgroundColor: `${P}06` }}>
              <p><span className="font-semibold text-gray-900">Event:</span> {cardData.visitPurpose || 'Event Name'}</p>
              <p><span className="font-semibold text-gray-900">Badge:</span> <span style={{ color: P }}>{cardData.badgeNumber || 'E-001'}</span></p>
              <p><span className="font-semibold text-gray-900">Date:</span> {cardData.validUntil || 'DD/MM/YYYY'}</p>
              <p><span className="font-semibold text-gray-900">Host:</span> {cardData.hostName || 'Host'}</p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, ${P}, ${S})` }} />
      </div>
    );
  };

  const currentTemplates = cardType === 'id' ? idCardTemplates : visitorPassTemplates;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ID Cards & Visitor Passes</h1>
          <p className="text-muted-foreground mt-1">Create professional ID cards and visitor passes</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" />Create New</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="id-card">ID Cards</TabsTrigger>
          <TabsTrigger value="visitor-pass">Visitor Passes</TabsTrigger>
        </TabsList>

        <TabsContent value="id-card" className="mt-6">
          <div className="grid gap-4 md:grid-cols-5">
            {idCardTemplates.map((template) => (
              <Card key={template.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setCardType('id'); setSelectedTemplate(template.id); setDialogOpen(true); }}>
                <CardContent className="p-4">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden mb-3 flex items-center justify-center bg-gray-50">
                    <div className="transform scale-[0.35] origin-center">{renderIDCardTemplate(template.id)}</div>
                  </div>
                  <p className="text-sm font-medium text-center">{template.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="visitor-pass" className="mt-6">
          <div className="grid gap-4 md:grid-cols-5">
            {visitorPassTemplates.map((template) => (
              <Card key={template.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setCardType('visitor'); setSelectedTemplate(template.id); setDialogOpen(true); }}>
                <CardContent className="p-4">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden mb-3 flex items-center justify-center bg-gray-50">
                    <div className="transform scale-[0.35] origin-center">{renderVisitorPassTemplate(template.id)}</div>
                  </div>
                  <p className="text-sm font-medium text-center">{template.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create {cardType === 'id' ? 'ID Card' : 'Visitor Pass'}</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Template</Label>
                  <Select value={selectedTemplate.toString()} onValueChange={(v) => setSelectedTemplate(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{currentTemplates.map((t) => (<SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div><Label>Orientation</Label>
                  <Select value={orientation} onValueChange={(v: 'vertical' | 'horizontal') => setOrientation(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="vertical">Vertical</SelectItem><SelectItem value="horizontal">Horizontal</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Text Alignment</Label>
                <Select value={textAlign} onValueChange={(v: 'left' | 'center' | 'right') => setTextAlign(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Photo</Label>
                <div className="flex gap-2">
                  <input type="file" ref={photoInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                  <Button variant="outline" className="flex-1" onClick={() => photoInputRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Upload Photo</Button>
                  {cardData.photo && <Button variant="outline" onClick={() => setCardData({ ...cardData, photo: null })}>Remove</Button>}
                </div>
              </div>
              {cardType === 'id' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Full Name</Label><Input value={cardData.name} onChange={(e) => setCardData({ ...cardData, name: e.target.value })} placeholder="John Smith" /></div>
                    <div><Label>Employee ID</Label><Input value={cardData.employeeId} onChange={(e) => setCardData({ ...cardData, employeeId: e.target.value })} placeholder="EMP-0001" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Designation</Label><Input value={cardData.designation} onChange={(e) => setCardData({ ...cardData, designation: e.target.value })} placeholder="Software Engineer" /></div>
                    <div><Label>Department</Label><Input value={cardData.department} onChange={(e) => setCardData({ ...cardData, department: e.target.value })} placeholder="Engineering" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Blood Group</Label><Input value={cardData.bloodGroup} onChange={(e) => setCardData({ ...cardData, bloodGroup: e.target.value })} placeholder="O+" /></div>
                    <div><Label>Emergency Contact</Label><Input value={cardData.emergencyContact} onChange={(e) => setCardData({ ...cardData, emergencyContact: e.target.value })} placeholder="+44 123 456 7890" /></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Visitor Name</Label><Input value={cardData.visitorName || cardData.name} onChange={(e) => setCardData({ ...cardData, visitorName: e.target.value, name: e.target.value })} placeholder="Jane Doe" /></div>
                    <div><Label>Badge Number</Label><Input value={cardData.badgeNumber} onChange={(e) => setCardData({ ...cardData, badgeNumber: e.target.value })} placeholder="V-001" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Company</Label><Input value={cardData.visitorCompany} onChange={(e) => setCardData({ ...cardData, visitorCompany: e.target.value })} placeholder="ABC Corporation" /></div>
                    <div><Label>Visit Purpose</Label><Input value={cardData.visitPurpose} onChange={(e) => setCardData({ ...cardData, visitPurpose: e.target.value })} placeholder="Business Meeting" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Host Name</Label><Input value={cardData.hostName} onChange={(e) => setCardData({ ...cardData, hostName: e.target.value })} placeholder="John Smith" /></div>
                    <div><Label>Escort Required</Label>
                      <Select value={cardData.escortRequired} onValueChange={(v) => setCardData({ ...cardData, escortRequired: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="No">No</SelectItem><SelectItem value="Yes">Yes</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Valid From</Label><Input type="date" value={cardData.validFrom} onChange={(e) => setCardData({ ...cardData, validFrom: e.target.value })} /></div>
                    <div><Label>Valid Until</Label><Input type="date" value={cardData.validUntil} onChange={(e) => setCardData({ ...cardData, validUntil: e.target.value })} /></div>
                  </div>
                </>
              )}
            </div>
            <div className="space-y-4">
              <Label>Preview</Label>
              <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center min-h-[450px]">
                {cardType === 'id' ? renderIDCardTemplate(selectedTemplate, true) : renderVisitorPassTemplate(selectedTemplate, true)}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleDownload('png')} variant="outline" className="flex-1"><Download className="h-4 w-4 mr-2" />PNG</Button>
                <Button onClick={() => handleDownload('jpg')} variant="outline" className="flex-1"><Download className="h-4 w-4 mr-2" />JPG</Button>
                <Button onClick={() => handleDownload('pdf')} variant="outline" className="flex-1"><Download className="h-4 w-4 mr-2" />PDF</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
