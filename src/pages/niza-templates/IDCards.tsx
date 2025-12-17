import { useState, useRef } from 'react';
import { Plus, Download, Upload, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBrandSettings } from '@/hooks/useTemplates';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  name: '',
  designation: '',
  employeeId: '',
  department: '',
  bloodGroup: '',
  emergencyContact: '',
  photo: null,
  validFrom: '',
  validUntil: '',
  visitorCompany: '',
  visitPurpose: '',
  hostName: '',
  visitorName: '',
  badgeNumber: '',
  escortRequired: 'No',
};

// Logo colors - Niza brand colors (blue/teal)
const primaryColor = '#0066B3';
const secondaryColor = '#00A3E0';
const accentColor = '#004C8C';

// ID Card Templates
const idCardTemplates = [
  { id: 1, name: 'Corporate Classic' },
  { id: 2, name: 'Modern Stripe' },
  { id: 3, name: 'Elegant Wave' },
  { id: 4, name: 'Professional Grid' },
  { id: 5, name: 'Executive Minimal' },
];

// Visitor Pass Templates - Different designs
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

  const logoUrl = brandSettings?.primary_logo_path;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCardData({ ...cardData, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = async (format: 'png' | 'jpg' | 'pdf') => {
    if (!cardRef.current) return;
    
    const canvas = await html2canvas(cardRef.current, { scale: 3, backgroundColor: '#ffffff' });
    
    if (format === 'pdf') {
      const pdf = new jsPDF({
        orientation: orientation === 'vertical' ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a6',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${cardType}-card-${cardData.name || 'template'}.pdf`);
    } else {
      const link = document.createElement('a');
      link.download = `${cardType}-card-${cardData.name || 'template'}.${format}`;
      link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`);
      link.click();
    }
  };

  const renderIDCardTemplate = (template: number, isPreview = false) => {
    const isVertical = orientation === 'vertical';
    const ref = isPreview ? cardRef : undefined;
    
    const baseStyles = isVertical 
      ? 'w-[260px] h-[400px]' 
      : 'w-[400px] h-[260px]';

    const alignClass = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';

    // Template 1: Corporate Classic
    if (template === 1) {
      return (
        <div ref={ref} className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg border border-gray-200 relative`}>
          {/* Top accent bar */}
          <div className="h-2" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }} />
          
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain" />}
              <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                EMPLOYEE ID
              </span>
            </div>
          </div>
          
          <div className={`p-4 ${isVertical ? 'flex flex-col items-center' : 'flex gap-4'}`}>
            <div className={`${isVertical ? 'w-24 h-24' : 'w-20 h-20'} rounded-full border-4 shadow-md overflow-hidden bg-gray-50 flex items-center justify-center`} style={{ borderColor: primaryColor }}>
              {cardData.photo ? (
                <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-gray-300" />
              )}
            </div>
            
            <div className={`${isVertical ? 'mt-4 w-full' : 'flex-1'} ${alignClass}`}>
              <h3 className="font-bold text-lg text-gray-900">{cardData.name || 'Full Name'}</h3>
              <p className="text-sm font-medium" style={{ color: primaryColor }}>{cardData.designation || 'Designation'}</p>
              <div className={`mt-3 space-y-1.5 text-xs text-gray-700 ${alignClass}`}>
                <p><span className="font-semibold text-gray-900">ID:</span> {cardData.employeeId || 'EMP-0000'}</p>
                <p><span className="font-semibold text-gray-900">Department:</span> {cardData.department || 'Department'}</p>
                {cardData.bloodGroup && <p><span className="font-semibold text-gray-900">Blood Group:</span> {cardData.bloodGroup}</p>}
                {cardData.emergencyContact && <p><span className="font-semibold text-gray-900">Emergency:</span> {cardData.emergencyContact}</p>}
              </div>
            </div>
          </div>
          
          {/* Bottom design element */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 400 30" className="w-full h-8" preserveAspectRatio="none">
              <path d="M0,30 Q100,0 200,15 T400,30 L400,30 L0,30 Z" fill={`${primaryColor}10`} />
            </svg>
          </div>
        </div>
      );
    }

    // Template 2: Modern Stripe
    if (template === 2) {
      return (
        <div ref={ref} className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg relative`}>
          {/* Side stripe */}
          <div className="absolute left-0 top-0 bottom-0 w-3" style={{ background: `linear-gradient(180deg, ${primaryColor}, ${secondaryColor})` }} />
          
          <div className={`h-full ${isVertical ? 'flex flex-col' : 'flex'} pl-6 pr-4 py-4`}>
            <div className="flex items-center justify-between mb-4">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 object-contain" />}
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: secondaryColor }} />
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
              </div>
            </div>
            
            <div className={`flex-1 ${isVertical ? 'flex flex-col items-center' : 'flex gap-4 items-center'}`}>
              <div className={`${isVertical ? 'w-20 h-20' : 'w-16 h-16'} rounded-lg overflow-hidden border-2 bg-gray-50`} style={{ borderColor: primaryColor }}>
                {cardData.photo ? (
                  <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-10 h-10 text-gray-300" />
                  </div>
                )}
              </div>
              
              <div className={`${isVertical ? 'mt-4 w-full' : 'flex-1'} ${alignClass}`}>
                <h3 className="font-bold text-gray-900 text-lg">{cardData.name || 'Full Name'}</h3>
                <p className="text-sm font-medium" style={{ color: primaryColor }}>{cardData.designation || 'Designation'}</p>
              </div>
            </div>
            
            <div className="mt-auto pt-3 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                <p><span className="font-semibold text-gray-900">ID:</span> {cardData.employeeId || 'EMP-0000'}</p>
                <p><span className="font-semibold text-gray-900">Dept:</span> {cardData.department || 'Dept'}</p>
              </div>
            </div>
          </div>
          
          {/* Corner accent */}
          <div className="absolute bottom-0 right-0 w-16 h-16 opacity-20">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="100" cy="100" r="80" fill={primaryColor} />
            </svg>
          </div>
        </div>
      );
    }

    // Template 3: Elegant Wave
    if (template === 3) {
      return (
        <div ref={ref} className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg relative`}>
          {/* Top wave design */}
          <div className="absolute top-0 left-0 right-0 h-24">
            <svg viewBox="0 0 400 100" className="w-full h-full" preserveAspectRatio="none">
              <path d="M0,0 L400,0 L400,60 Q300,80 200,60 Q100,40 0,70 L0,0 Z" fill={primaryColor} />
              <path d="M0,0 L400,0 L400,50 Q300,70 200,50 Q100,30 0,60 L0,0 Z" fill={secondaryColor} opacity="0.5" />
            </svg>
          </div>
          
          <div className={`relative h-full ${isVertical ? 'flex flex-col' : 'flex'} p-5`}>
            <div className="flex justify-between items-start mb-4 relative z-10">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 object-contain brightness-0 invert" />}
              <span className="text-xs font-bold text-white uppercase tracking-wider">Employee</span>
            </div>
            
            <div className={`flex-1 ${isVertical ? 'flex flex-col items-center mt-8' : 'flex gap-4 items-center'}`}>
              <div className={`${isVertical ? 'w-24 h-24' : 'w-20 h-20'} rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-50`}>
                {cardData.photo ? (
                  <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-gray-300" />
                  </div>
                )}
              </div>
              
              <div className={`${isVertical ? 'mt-4 w-full' : 'flex-1'} ${alignClass}`}>
                <h3 className="font-bold text-xl text-gray-900">{cardData.name || 'Full Name'}</h3>
                <p className="text-sm font-medium" style={{ color: primaryColor }}>{cardData.designation || 'Designation'}</p>
                <div className="mt-3 space-y-1 text-xs text-gray-700">
                  <p><span className="font-semibold text-gray-900">ID:</span> {cardData.employeeId || 'EMP-0000'}</p>
                  <p><span className="font-semibold text-gray-900">Department:</span> {cardData.department || 'Department'}</p>
                </div>
              </div>
            </div>
            
            {cardData.emergencyContact && (
              <div className="mt-auto text-center text-xs text-gray-600 pt-2">
                Emergency: {cardData.emergencyContact}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Template 4: Professional Grid
    if (template === 4) {
      return (
        <div ref={ref} className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg border border-gray-200 relative`}>
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-5">
            <div className="w-full h-full" style={{ 
              backgroundImage: `linear-gradient(${primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${primaryColor} 1px, transparent 1px)`,
              backgroundSize: '20px 20px'
            }} />
          </div>
          
          <div className={`relative h-full ${isVertical ? 'flex flex-col' : 'flex'} p-5`}>
            <div className="flex items-center justify-between mb-4">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain" />}
              <div className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: primaryColor }}>
                ID CARD
              </div>
            </div>
            
            <div className={`flex-1 ${isVertical ? '' : 'flex gap-4'}`}>
              <div className={`${isVertical ? 'flex gap-4 mb-4' : ''}`}>
                <div className={`${isVertical ? 'w-20 h-20' : 'w-24 h-24'} rounded-lg overflow-hidden bg-gray-50 border-2`} style={{ borderColor: `${primaryColor}30` }}>
                  {cardData.photo ? (
                    <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                </div>
                {isVertical && (
                  <div className={`flex-1 ${alignClass}`}>
                    <h3 className="font-bold text-gray-900">{cardData.name || 'Full Name'}</h3>
                    <p className="text-sm" style={{ color: primaryColor }}>{cardData.designation || 'Designation'}</p>
                  </div>
                )}
              </div>
              
              {!isVertical && (
                <div className={`flex-1 ${alignClass}`}>
                  <h3 className="font-bold text-lg text-gray-900">{cardData.name || 'Full Name'}</h3>
                  <p className="text-sm" style={{ color: primaryColor }}>{cardData.designation || 'Designation'}</p>
                </div>
              )}
            </div>
            
            <div className="mt-auto pt-3 border-t" style={{ borderColor: `${primaryColor}20` }}>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                <p><span className="font-semibold text-gray-900">Employee ID:</span> {cardData.employeeId || 'EMP-0000'}</p>
                <p><span className="font-semibold text-gray-900">Department:</span> {cardData.department || 'Dept'}</p>
                {cardData.bloodGroup && <p><span className="font-semibold text-gray-900">Blood Group:</span> {cardData.bloodGroup}</p>}
              </div>
            </div>
          </div>
          
          {/* Corner accents */}
          <div className="absolute top-0 right-0 w-12 h-12">
            <div className="absolute top-2 right-2 w-2 h-8 rounded-full" style={{ backgroundColor: `${primaryColor}30` }} />
            <div className="absolute top-2 right-6 w-2 h-5 rounded-full" style={{ backgroundColor: `${secondaryColor}30` }} />
          </div>
        </div>
      );
    }

    // Template 5: Executive Minimal
    return (
      <div ref={ref} className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg relative`}>
        {/* Minimal top line */}
        <div className="h-1" style={{ backgroundColor: primaryColor }} />
        
        <div className={`h-full ${isVertical ? 'flex flex-col' : 'flex'} p-6`}>
          <div className="flex items-center gap-3 mb-6">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain" />}
            <div className="h-6 w-px" style={{ backgroundColor: `${primaryColor}30` }} />
            <span className="text-xs font-medium uppercase tracking-widest text-gray-500">Employee</span>
          </div>
          
          <div className={`flex-1 ${isVertical ? 'flex flex-col items-center' : 'flex gap-6 items-center'}`}>
            <div className={`${isVertical ? 'w-24 h-24' : 'w-20 h-20'} rounded-full overflow-hidden bg-gray-100`}>
              {cardData.photo ? (
                <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12 text-gray-300" />
                </div>
              )}
            </div>
            
            <div className={`${isVertical ? 'mt-4 w-full' : 'flex-1'} ${alignClass}`}>
              <h3 className="font-semibold text-xl text-gray-900">{cardData.name || 'Full Name'}</h3>
              <p className="text-sm mt-1" style={{ color: primaryColor }}>{cardData.designation || 'Designation'}</p>
              <p className="text-xs text-gray-500 mt-2">{cardData.department || 'Department'}</p>
            </div>
          </div>
          
          <div className="mt-auto pt-4 flex items-center justify-between text-xs text-gray-600">
            <span className="font-medium">{cardData.employeeId || 'EMP-0000'}</span>
            {cardData.bloodGroup && (
              <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                {cardData.bloodGroup}
              </span>
            )}
          </div>
        </div>
        
        {/* Subtle corner accent */}
        <div className="absolute bottom-0 right-0 w-20 h-20 opacity-10">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="100" cy="100" r="60" fill={primaryColor} />
          </svg>
        </div>
      </div>
    );
  };

  const renderVisitorPassTemplate = (template: number, isPreview = false) => {
    const isVertical = orientation === 'vertical';
    const ref = isPreview ? cardRef : undefined;
    
    const baseStyles = isVertical 
      ? 'w-[260px] h-[400px]' 
      : 'w-[400px] h-[260px]';

    const alignClass = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';

    // Template 1: Visitor Standard
    if (template === 1) {
      return (
        <div ref={ref} className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg border-2 relative`} style={{ borderColor: secondaryColor }}>
          {/* Header band */}
          <div className="py-3 px-4 text-center" style={{ backgroundColor: secondaryColor }}>
            <span className="text-white font-bold text-lg tracking-wider">VISITOR</span>
          </div>
          
          <div className={`p-4 ${isVertical ? 'flex flex-col items-center' : 'flex gap-4'}`}>
            <div className={`${isVertical ? 'w-20 h-20' : 'w-16 h-16'} rounded-lg border-2 overflow-hidden bg-gray-50 flex items-center justify-center`} style={{ borderColor: `${secondaryColor}50` }}>
              {cardData.photo ? (
                <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-gray-300" />
              )}
            </div>
            
            <div className={`${isVertical ? 'mt-3 w-full' : 'flex-1'} ${alignClass}`}>
              <h3 className="font-bold text-lg text-gray-900">{cardData.visitorName || cardData.name || 'Visitor Name'}</h3>
              <p className="text-sm text-gray-600">{cardData.visitorCompany || 'Company Name'}</p>
            </div>
          </div>
          
          <div className="px-4 pb-4 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="font-semibold text-gray-900">Purpose:</span>
              <span>{cardData.visitPurpose || 'Meeting'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="font-semibold text-gray-900">Host:</span>
              <span>{cardData.hostName || 'Host Name'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="font-semibold text-gray-900">Badge No:</span>
              <span style={{ color: secondaryColor }}>{cardData.badgeNumber || 'V-001'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-semibold text-gray-900">Valid Until:</span>
              <span>{cardData.validUntil || 'DD/MM/YYYY'}</span>
            </div>
          </div>
          
          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 py-2 text-center text-xs text-gray-500" style={{ backgroundColor: `${secondaryColor}10` }}>
            Please return this pass when leaving
          </div>
        </div>
      );
    }

    // Template 2: Temporary Badge
    if (template === 2) {
      return (
        <div ref={ref} className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg relative`}>
          {/* Diagonal stripe pattern */}
          <div className="absolute top-0 left-0 right-0 h-20">
            <svg viewBox="0 0 400 80" className="w-full h-full" preserveAspectRatio="none">
              <rect x="0" y="0" width="400" height="80" fill={`${secondaryColor}10`} />
              <line x1="0" y1="0" x2="100" y2="80" stroke={secondaryColor} strokeWidth="2" opacity="0.3" />
              <line x1="50" y1="0" x2="150" y2="80" stroke={secondaryColor} strokeWidth="2" opacity="0.3" />
              <line x1="100" y1="0" x2="200" y2="80" stroke={secondaryColor} strokeWidth="2" opacity="0.3" />
            </svg>
          </div>
          
          <div className={`relative h-full ${isVertical ? 'flex flex-col' : 'flex'} p-5`}>
            <div className="flex justify-between items-start mb-4">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 object-contain" />}
              <div className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: secondaryColor }}>
                TEMP BADGE
              </div>
            </div>
            
            <div className={`flex-1 ${isVertical ? 'flex flex-col items-center mt-4' : 'flex gap-4 items-center'}`}>
              <div className={`${isVertical ? 'w-20 h-20' : 'w-16 h-16'} rounded-full border-3 overflow-hidden bg-gray-50`} style={{ borderColor: secondaryColor }}>
                {cardData.photo ? (
                  <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-10 h-10 text-gray-300" />
                  </div>
                )}
              </div>
              
              <div className={`${isVertical ? 'mt-3 w-full' : 'flex-1'} ${alignClass}`}>
                <h3 className="font-bold text-gray-900">{cardData.visitorName || cardData.name || 'Visitor Name'}</h3>
                <p className="text-sm" style={{ color: secondaryColor }}>{cardData.visitorCompany || 'Company'}</p>
              </div>
            </div>
            
            <div className="mt-auto space-y-2 text-xs text-gray-700">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Visiting:</span>
                <span>{cardData.hostName || 'Host Name'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Purpose:</span>
                <span>{cardData.visitPurpose || 'Meeting'}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: `${secondaryColor}30` }}>
                <span className="font-bold" style={{ color: secondaryColor }}>{cardData.badgeNumber || 'V-001'}</span>
                <span className="text-gray-500">Expires: {cardData.validUntil || 'DD/MM/YYYY'}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Template 3: Guest Pass
    if (template === 3) {
      return (
        <div ref={ref} className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg relative`}>
          {/* Curved top design */}
          <div className="absolute top-0 left-0 right-0 h-28">
            <svg viewBox="0 0 400 120" className="w-full h-full" preserveAspectRatio="none">
              <ellipse cx="200" cy="-30" rx="250" ry="120" fill={`${secondaryColor}15`} />
              <ellipse cx="200" cy="-40" rx="220" ry="100" fill={`${secondaryColor}10`} />
            </svg>
          </div>
          
          <div className={`relative h-full ${isVertical ? 'flex flex-col' : 'flex'} p-5`}>
            <div className="flex justify-between items-start mb-3">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 object-contain" />}
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: secondaryColor }}>Guest Pass</span>
            </div>
            
            <div className={`flex-1 ${isVertical ? 'flex flex-col items-center mt-6' : 'flex gap-4 items-center'}`}>
              <div className={`${isVertical ? 'w-24 h-24' : 'w-20 h-20'} rounded-2xl overflow-hidden border-2 bg-gray-50 shadow-md`} style={{ borderColor: `${secondaryColor}40` }}>
                {cardData.photo ? (
                  <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-gray-300" />
                  </div>
                )}
              </div>
              
              <div className={`${isVertical ? 'mt-4 w-full' : 'flex-1'} ${alignClass}`}>
                <h3 className="font-bold text-xl text-gray-900">{cardData.visitorName || cardData.name || 'Guest Name'}</h3>
                <p className="text-sm text-gray-600">{cardData.visitorCompany || 'Organization'}</p>
              </div>
            </div>
            
            <div className="mt-auto rounded-lg p-3 text-xs" style={{ backgroundColor: `${secondaryColor}10` }}>
              <div className="grid grid-cols-2 gap-2 text-gray-700">
                <p><span className="font-semibold text-gray-900">Host:</span> {cardData.hostName || 'Host'}</p>
                <p><span className="font-semibold text-gray-900">Purpose:</span> {cardData.visitPurpose || 'Visit'}</p>
                <p><span className="font-semibold text-gray-900">Badge:</span> <span style={{ color: secondaryColor }}>{cardData.badgeNumber || 'V-001'}</span></p>
                <p><span className="font-semibold text-gray-900">Valid:</span> {cardData.validUntil || 'DD/MM/YYYY'}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Template 4: Contractor Badge
    if (template === 4) {
      return (
        <div ref={ref} className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg border-l-4 relative`} style={{ borderLeftColor: accentColor }}>
          <div className={`h-full ${isVertical ? 'flex flex-col' : 'flex'} p-5`}>
            <div className="flex items-center justify-between mb-4">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 object-contain" />}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accentColor }} />
                <span className="text-xs font-bold uppercase" style={{ color: accentColor }}>Contractor</span>
              </div>
            </div>
            
            <div className={`flex-1 ${isVertical ? '' : 'flex gap-4'}`}>
              <div className={`${isVertical ? 'flex gap-4 mb-4' : ''}`}>
                <div className={`${isVertical ? 'w-16 h-16' : 'w-20 h-20'} rounded-lg overflow-hidden bg-gray-50 border`} style={{ borderColor: `${accentColor}30` }}>
                  {cardData.photo ? (
                    <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                </div>
                {isVertical && (
                  <div className={`flex-1 ${alignClass}`}>
                    <h3 className="font-bold text-gray-900">{cardData.visitorName || cardData.name || 'Contractor Name'}</h3>
                    <p className="text-sm text-gray-600">{cardData.visitorCompany || 'Company'}</p>
                  </div>
                )}
              </div>
              
              {!isVertical && (
                <div className={`flex-1 ${alignClass}`}>
                  <h3 className="font-bold text-gray-900">{cardData.visitorName || cardData.name || 'Contractor Name'}</h3>
                  <p className="text-sm text-gray-600">{cardData.visitorCompany || 'Company'}</p>
                </div>
              )}
            </div>
            
            <div className="mt-auto space-y-2 text-xs text-gray-700 pt-3 border-t border-gray-100">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Work Area:</span>
                <span>{cardData.visitPurpose || 'Area'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Escort Required:</span>
                <span className={cardData.escortRequired === 'Yes' ? 'font-bold' : ''} style={{ color: cardData.escortRequired === 'Yes' ? accentColor : 'inherit' }}>
                  {cardData.escortRequired || 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Supervisor:</span>
                <span>{cardData.hostName || 'Supervisor'}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="font-bold" style={{ color: accentColor }}>{cardData.badgeNumber || 'C-001'}</span>
                <span className="text-gray-500">{cardData.validFrom || 'Start'} - {cardData.validUntil || 'End'}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Template 5: Event Visitor
    return (
      <div ref={ref} className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg relative`}>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-20" style={{ backgroundColor: secondaryColor }} />
        <div className="absolute bottom-0 left-0 w-24 h-24 -ml-12 -mb-12 rounded-full opacity-10" style={{ backgroundColor: primaryColor }} />
        
        <div className={`relative h-full ${isVertical ? 'flex flex-col' : 'flex'} p-5`}>
          <div className="flex justify-between items-start mb-4">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 object-contain" />}
            <div className="px-3 py-1 rounded text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
              EVENT
            </div>
          </div>
          
          <div className={`flex-1 ${isVertical ? 'flex flex-col items-center' : 'flex gap-4 items-center'}`}>
            <div className={`${isVertical ? 'w-20 h-20' : 'w-16 h-16'} rounded-xl overflow-hidden border-2 bg-gray-50`} style={{ borderColor: `${secondaryColor}40` }}>
              {cardData.photo ? (
                <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-10 h-10 text-gray-300" />
                </div>
              )}
            </div>
            
            <div className={`${isVertical ? 'mt-4 w-full' : 'flex-1'} ${alignClass}`}>
              <h3 className="font-bold text-lg text-gray-900">{cardData.visitorName || cardData.name || 'Attendee Name'}</h3>
              <p className="text-sm text-gray-600">{cardData.visitorCompany || 'Organization'}</p>
            </div>
          </div>
          
          <div className="mt-auto text-xs text-gray-700">
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg" style={{ backgroundColor: `${secondaryColor}08` }}>
              <p><span className="font-semibold text-gray-900">Event:</span> {cardData.visitPurpose || 'Event Name'}</p>
              <p><span className="font-semibold text-gray-900">Badge:</span> <span style={{ color: secondaryColor }}>{cardData.badgeNumber || 'E-001'}</span></p>
              <p><span className="font-semibold text-gray-900">Date:</span> {cardData.validUntil || 'DD/MM/YYYY'}</p>
              <p><span className="font-semibold text-gray-900">Host:</span> {cardData.hostName || 'Host'}</p>
            </div>
          </div>
        </div>
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
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create New
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="id-card">ID Cards</TabsTrigger>
          <TabsTrigger value="visitor-pass">Visitor Passes</TabsTrigger>
        </TabsList>

        <TabsContent value="id-card" className="mt-6">
          <div className="grid gap-4 md:grid-cols-5">
            {idCardTemplates.map((template) => (
              <Card 
                key={template.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  setCardType('id');
                  setSelectedTemplate(template.id);
                  setDialogOpen(true);
                }}
              >
                <CardContent className="p-4">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden mb-3 flex items-center justify-center bg-gray-50">
                    <div className="transform scale-[0.35] origin-center">
                      {renderIDCardTemplate(template.id)}
                    </div>
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
              <Card 
                key={template.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  setCardType('visitor');
                  setSelectedTemplate(template.id);
                  setDialogOpen(true);
                }}
              >
                <CardContent className="p-4">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden mb-3 flex items-center justify-center bg-gray-50">
                    <div className="transform scale-[0.35] origin-center">
                      {renderVisitorPassTemplate(template.id)}
                    </div>
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
          <DialogHeader>
            <DialogTitle>Create {cardType === 'id' ? 'ID Card' : 'Visitor Pass'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Form Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Template</Label>
                  <Select value={selectedTemplate.toString()} onValueChange={(v) => setSelectedTemplate(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Orientation</Label>
                  <Select value={orientation} onValueChange={(v: 'vertical' | 'horizontal') => setOrientation(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vertical">Vertical</SelectItem>
                      <SelectItem value="horizontal">Horizontal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Text Alignment</Label>
                <Select value={textAlign} onValueChange={(v: 'left' | 'center' | 'right') => setTextAlign(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Photo</Label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={photoInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button variant="outline" className="flex-1" onClick={() => photoInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </Button>
                  {cardData.photo && (
                    <Button variant="outline" onClick={() => setCardData({ ...cardData, photo: null })}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              {cardType === 'id' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Full Name</Label>
                      <Input 
                        value={cardData.name} 
                        onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <Label>Employee ID</Label>
                      <Input 
                        value={cardData.employeeId} 
                        onChange={(e) => setCardData({ ...cardData, employeeId: e.target.value })}
                        placeholder="EMP-0001"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Designation</Label>
                      <Input 
                        value={cardData.designation} 
                        onChange={(e) => setCardData({ ...cardData, designation: e.target.value })}
                        placeholder="Software Engineer"
                      />
                    </div>
                    <div>
                      <Label>Department</Label>
                      <Input 
                        value={cardData.department} 
                        onChange={(e) => setCardData({ ...cardData, department: e.target.value })}
                        placeholder="Engineering"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Blood Group</Label>
                      <Input 
                        value={cardData.bloodGroup} 
                        onChange={(e) => setCardData({ ...cardData, bloodGroup: e.target.value })}
                        placeholder="O+"
                      />
                    </div>
                    <div>
                      <Label>Emergency Contact</Label>
                      <Input 
                        value={cardData.emergencyContact} 
                        onChange={(e) => setCardData({ ...cardData, emergencyContact: e.target.value })}
                        placeholder="+44 123 456 7890"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Visitor Name</Label>
                      <Input 
                        value={cardData.visitorName || cardData.name} 
                        onChange={(e) => setCardData({ ...cardData, visitorName: e.target.value, name: e.target.value })}
                        placeholder="Jane Doe"
                      />
                    </div>
                    <div>
                      <Label>Badge Number</Label>
                      <Input 
                        value={cardData.badgeNumber} 
                        onChange={(e) => setCardData({ ...cardData, badgeNumber: e.target.value })}
                        placeholder="V-001"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Company</Label>
                      <Input 
                        value={cardData.visitorCompany} 
                        onChange={(e) => setCardData({ ...cardData, visitorCompany: e.target.value })}
                        placeholder="ABC Corporation"
                      />
                    </div>
                    <div>
                      <Label>Visit Purpose</Label>
                      <Input 
                        value={cardData.visitPurpose} 
                        onChange={(e) => setCardData({ ...cardData, visitPurpose: e.target.value })}
                        placeholder="Business Meeting"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Host Name</Label>
                      <Input 
                        value={cardData.hostName} 
                        onChange={(e) => setCardData({ ...cardData, hostName: e.target.value })}
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <Label>Escort Required</Label>
                      <Select value={cardData.escortRequired} onValueChange={(v) => setCardData({ ...cardData, escortRequired: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="No">No</SelectItem>
                          <SelectItem value="Yes">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Valid From</Label>
                      <Input 
                        type="date"
                        value={cardData.validFrom} 
                        onChange={(e) => setCardData({ ...cardData, validFrom: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Valid Until</Label>
                      <Input 
                        type="date"
                        value={cardData.validUntil} 
                        onChange={(e) => setCardData({ ...cardData, validUntil: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Preview Section */}
            <div className="space-y-4">
              <Label>Preview</Label>
              <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center min-h-[450px]">
                {cardType === 'id' 
                  ? renderIDCardTemplate(selectedTemplate, true)
                  : renderVisitorPassTemplate(selectedTemplate, true)
                }
              </div>
              
              <div className="flex gap-2">
                <Button onClick={() => handleDownload('png')} variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  PNG
                </Button>
                <Button onClick={() => handleDownload('jpg')} variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  JPG
                </Button>
                <Button onClick={() => handleDownload('pdf')} variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
