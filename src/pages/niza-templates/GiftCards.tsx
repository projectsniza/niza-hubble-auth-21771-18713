import { useState, useRef, useEffect } from 'react';
import { Plus, Download, Search, Edit, Trash2, Gift, Store, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useGiftCards, useBrandSettings } from '@/hooks/useTemplates';
import { useToast } from '@/hooks/use-toast';
import { captureElementToCanvas } from '@/lib/captureElementToCanvas';
import jsPDF from 'jspdf';

interface GiftCardFormData {
  title: string;
  employeeName: string;
  discount: string;
  code: string;
  validDate: string;
  cardType: 'birthday' | 'reward' | 'holiday' | 'custom' | 'external';
  description: string;
  providerName: string;
  providerUrl: string;
  purchaseValue: string;
}

const defaultFormData: GiftCardFormData = {
  title: '',
  employeeName: '',
  discount: '',
  code: '',
  validDate: '',
  cardType: 'custom',
  description: '',
  providerName: '',
  providerUrl: '',
  purchaseValue: '',
};

// Popular gift card providers
const GIFT_CARD_PROVIDERS = [
  { name: 'Amazon', url: 'https://www.amazon.co.uk/gift-cards' },
  { name: 'John Lewis', url: 'https://www.johnlewis.com/gift-cards' },
  { name: 'M&S', url: 'https://www.marksandspencer.com/gift-cards' },
  { name: 'Tesco', url: 'https://www.tesco.com/gift-cards' },
  { name: 'Sainsbury\'s', url: 'https://www.sainsburys.co.uk/giftcards' },
  { name: 'Love2shop', url: 'https://www.love2shop.co.uk' },
  { name: 'One4all', url: 'https://www.one4all.com' },
  { name: 'Argos', url: 'https://www.argos.co.uk/gift-cards' },
  { name: 'Costa Coffee', url: 'https://www.costa.co.uk/gift-cards' },
  { name: 'Starbucks', url: 'https://www.starbucks.co.uk/card' },
  { name: 'Other', url: '' },
];

export default function GiftCards() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [formData, setFormData] = useState<GiftCardFormData>(defaultFormData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('internal');
  const { giftCards, isLoading, createGiftCard, updateGiftCard, deleteGiftCard } = useGiftCards();
  const { brandSettings } = useBrandSettings();
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  const logoUrl = brandSettings?.primary_logo_path;

  const handleSave = async () => {
    try {
      const cardData = {
        title: formData.title,
        card_type: formData.cardType,
        discount: formData.discount,
        code: formData.code || `GIFT-${Date.now().toString(36).toUpperCase()}`,
        valid_date: formData.validDate || null,
        description: formData.description,
        design_template: { 
          template: selectedTemplate, 
          employeeName: formData.employeeName,
          providerName: formData.providerName,
          providerUrl: formData.providerUrl,
          purchaseValue: formData.purchaseValue,
        },
      };

      if (editingId) {
        await updateGiftCard(editingId, cardData);
      } else {
        await createGiftCard(cardData);
      }
      
      setDialogOpen(false);
      setFormData(defaultFormData);
      setEditingId(null);
    } catch (error) {
      toast({ title: 'Error saving gift card', variant: 'destructive' });
    }
  };

  const handleEdit = (card: any) => {
    const designTemplate = card.design_template as any;
    setFormData({
      title: card.title,
      employeeName: designTemplate?.employeeName || '',
      discount: card.discount,
      code: card.code,
      validDate: card.valid_date || '',
      cardType: card.card_type,
      description: card.description || '',
      providerName: designTemplate?.providerName || '',
      providerUrl: designTemplate?.providerUrl || '',
      purchaseValue: designTemplate?.purchaseValue || '',
    });
    setSelectedTemplate(designTemplate?.template || 1);
    setEditingId(card.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this gift card?')) {
      await deleteGiftCard(id);
    }
  };

  const handleDownload = async (format: 'png' | 'jpg' | 'pdf') => {
    if (!cardRef.current) return;

    const canvas = await captureElementToCanvas(cardRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
    });

    if (format === 'pdf') {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [150, 90],
      });
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 150, 90);
      pdf.save(`gift-card-${formData.employeeName || 'template'}.pdf`);
    } else {
      const link = document.createElement('a');
      link.download = `gift-card-${formData.employeeName || 'template'}.${format}`;
      link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`, 1.0);
      link.click();
    }
  };

  const handleProviderSelect = (providerName: string) => {
    const provider = GIFT_CARD_PROVIDERS.find(p => p.name === providerName);
    setFormData({ 
      ...formData, 
      providerName,
      providerUrl: provider?.url || '',
    });
  };

  const renderGiftCard = (template: number) => {
    const title = formData.title || 'Gift Card';
    const employeeName = formData.employeeName || 'Employee Name';
    const discount = formData.discount || '10%';
    const code = formData.code || 'GIFT-XXXX';
    const validDate = formData.validDate ? new Date(formData.validDate).toLocaleDateString() : 'Valid for 1 year';

    const cardStyles = 'w-[400px] h-[240px] rounded-2xl overflow-hidden shadow-xl';

    if (template === 1) {
      return (
        <div 
          ref={cardRef}
          className={`${cardStyles} bg-gradient-to-br from-purple-600 via-pink-500 to-rose-500 text-white relative`}
        >
          {/* Pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-5 right-10 w-20 h-20 border-4 border-white rounded-full" />
            <div className="absolute bottom-5 left-10 w-16 h-16 border-4 border-white rounded-full" />
          </div>
          
          <div className="relative h-full p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 brightness-0 invert" />}
              <span className="text-2xl">🎁</span>
            </div>
            
            <div className="text-center">
              <h2 className="text-3xl font-bold">{discount} OFF</h2>
              <p className="text-lg opacity-90">{title}</p>
              <p className="text-sm opacity-80 mt-1">For: {employeeName}</p>
            </div>
            
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs opacity-70">Code</p>
                <p className="font-mono font-bold">{code}</p>
              </div>
              <p className="text-xs opacity-70">{validDate}</p>
            </div>
          </div>
        </div>
      );
    }

    if (template === 2) {
      return (
        <div 
          ref={cardRef}
          className={`${cardStyles} bg-gray-900 text-white relative`}
        >
          {/* Gold accent */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400" />
          
          <div className="h-full p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 brightness-0 invert" />}
              <div className="text-right">
                <p className="text-yellow-400 text-sm font-medium uppercase tracking-wider">{formData.cardType} Gift</p>
              </div>
            </div>
            
            <div>
              <p className="text-gray-400 text-sm">Gift Card for</p>
              <h2 className="text-2xl font-bold text-white">{employeeName}</h2>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-yellow-400">{discount}</span>
                <span className="text-gray-400">discount</span>
              </div>
            </div>
            
            <div className="flex justify-between items-end">
              <div className="bg-gray-800 px-3 py-2 rounded">
                <p className="text-xs text-gray-500">Redeem Code</p>
                <p className="font-mono font-bold text-yellow-400">{code}</p>
              </div>
              <p className="text-xs text-gray-500">{validDate}</p>
            </div>
          </div>
        </div>
      );
    }

    // Template 3 - Festive
    return (
      <div 
        ref={cardRef}
        className={`${cardStyles} bg-gradient-to-br from-emerald-500 to-teal-600 text-white relative`}
      >
        {/* Confetti effect */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                backgroundColor: ['#ffd700', '#ff69b4', '#fff', '#87ceeb'][i % 4],
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: 0.6,
              }}
            />
          ))}
        </div>
        
        <div className="relative h-full p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 brightness-0 invert" />}
            <div className="text-3xl">🎉</div>
          </div>
          
          <div className="text-center">
            <p className="text-sm opacity-80 uppercase tracking-wider">Congratulations</p>
            <h2 className="text-2xl font-bold mt-1">{employeeName}</h2>
            <div className="mt-3 inline-block bg-white/20 backdrop-blur px-4 py-2 rounded-full">
              <span className="text-2xl font-bold">{discount} OFF</span>
            </div>
            <p className="text-sm mt-2 opacity-90">{title}</p>
          </div>
          
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs opacity-70">Use Code</p>
              <p className="font-mono font-bold bg-white/20 px-2 py-1 rounded">{code}</p>
            </div>
            <p className="text-xs opacity-70">{validDate}</p>
          </div>
        </div>
      </div>
    );
  };

  const internalCards = giftCards.filter(card => card.card_type !== 'external');
  const externalCards = giftCards.filter(card => card.card_type === 'external');

  const filteredInternalCards = internalCards.filter(card => 
    card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (card.design_template as any)?.employeeName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExternalCards = externalCards.filter(card => 
    card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (card.design_template as any)?.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (card.design_template as any)?.providerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gift Cards & Coupons</h1>
          <p className="text-muted-foreground mt-1">Create personalized gift cards for employees or manage external provider cards</p>
        </div>
        <Button onClick={() => { setFormData(defaultFormData); setEditingId(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Gift Card
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, employee, or provider..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Card className="px-4 py-2">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{giftCards.length} Total Cards</span>
          </div>
        </Card>
      </div>

      {/* Tabs for Internal vs External cards */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="internal" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Internal Cards ({internalCards.length})
          </TabsTrigger>
          <TabsTrigger value="external" className="gap-2">
            <Store className="h-4 w-4" />
            External Provider Cards ({externalCards.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="internal" className="mt-6">
          {filteredInternalCards.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredInternalCards.map((card) => (
                <Card key={card.id} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold">{card.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          For: {(card.design_template as any)?.employeeName || 'N/A'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(card)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(card.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-primary">{card.discount} OFF</span>
                      <code className="bg-muted px-2 py-1 rounded text-xs">{card.code}</code>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Gift className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">No internal gift cards yet</h3>
                  <p className="text-muted-foreground mb-4">Create gift cards for birthdays and special occasions</p>
                </div>
                <Button onClick={() => setDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Internal Gift Card
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="external" className="mt-6">
          {filteredExternalCards.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredExternalCards.map((card) => {
                const designTemplate = card.design_template as any;
                return (
                  <Card key={card.id} className="overflow-hidden">
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              {designTemplate?.providerName || 'External'}
                            </span>
                          </div>
                          <h3 className="font-semibold">{card.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            For: {designTemplate?.employeeName || 'N/A'}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(card)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(card.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-primary">
                          {designTemplate?.purchaseValue ? `£${designTemplate.purchaseValue}` : card.discount}
                        </span>
                        <code className="bg-muted px-2 py-1 rounded text-xs">{card.code}</code>
                      </div>
                      {designTemplate?.providerUrl && (
                        <a 
                          href={designTemplate.providerUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline mt-2 block"
                        >
                          Visit Provider →
                        </a>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Store className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">No external provider cards yet</h3>
                  <p className="text-muted-foreground mb-4">Track gift cards purchased from external providers like Amazon, John Lewis, etc.</p>
                </div>
                <Button onClick={() => { 
                  setFormData({ ...defaultFormData, cardType: 'external' }); 
                  setEditingId(null); 
                  setDialogOpen(true); 
                }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add External Gift Card
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Gift Card' : 'Create Gift Card'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid md:grid-cols-2 gap-6 py-4">
            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Card Source</Label>
                <Select 
                  value={formData.cardType === 'external' ? 'external' : 'internal'} 
                  onValueChange={(v) => setFormData({ ...formData, cardType: v === 'external' ? 'external' : 'custom' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Internal (Create your own)
                      </div>
                    </SelectItem>
                    <SelectItem value="external">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        External Provider (Amazon, etc.)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.cardType === 'external' ? (
                <>
                  {/* External provider fields */}
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={formData.providerName} onValueChange={handleProviderSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {GIFT_CARD_PROVIDERS.map((provider) => (
                          <SelectItem key={provider.name} value={provider.name}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.providerName === 'Other' && (
                    <div className="space-y-2">
                      <Label>Provider URL (optional)</Label>
                      <Input 
                        value={formData.providerUrl}
                        onChange={(e) => setFormData({ ...formData, providerUrl: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Title/Description</Label>
                    <Input 
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Christmas Bonus Gift Card"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Employee Name</Label>
                    <Input 
                      value={formData.employeeName}
                      onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                      placeholder="Enter employee name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Value (£)</Label>
                      <Input 
                        value={formData.purchaseValue}
                        onChange={(e) => setFormData({ ...formData, purchaseValue: e.target.value, discount: `£${e.target.value}` })}
                        placeholder="e.g., 50"
                        type="number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Card Code/Number</Label>
                      <Input 
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="Gift card code"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Valid Until</Label>
                    <Input 
                      type="date"
                      value={formData.validDate}
                      onChange={(e) => setFormData({ ...formData, validDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Textarea 
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Any additional notes..."
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Internal card fields */}
                  <div className="space-y-2">
                    <Label>Template</Label>
                    <Select value={selectedTemplate.toString()} onValueChange={(v) => setSelectedTemplate(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Gradient Party</SelectItem>
                        <SelectItem value="2">Elegant Gold</SelectItem>
                        <SelectItem value="3">Festive Celebration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Card Type</Label>
                    <Select value={formData.cardType} onValueChange={(v) => setFormData({ ...formData, cardType: v as any })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="birthday">Birthday</SelectItem>
                        <SelectItem value="reward">Reward</SelectItem>
                        <SelectItem value="holiday">Holiday</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input 
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Birthday Gift Card"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Employee Name</Label>
                    <Input 
                      value={formData.employeeName}
                      onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                      placeholder="Enter employee name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Discount</Label>
                      <Input 
                        value={formData.discount}
                        onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                        placeholder="e.g., 20%"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code</Label>
                      <Input 
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="Auto-generated if empty"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Valid Until</Label>
                    <Input 
                      type="date"
                      value={formData.validDate}
                      onChange={(e) => setFormData({ ...formData, validDate: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Preview - only for internal cards */}
            {formData.cardType !== 'external' && (
              <div className="flex flex-col items-center">
                <h3 className="text-sm font-medium mb-4">Preview</h3>
                <div className="transform scale-[0.85] origin-top">
                  {renderGiftCard(selectedTemplate)}
                </div>
              </div>
            )}

            {/* External card info */}
            {formData.cardType === 'external' && (
              <div className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-6">
                <Store className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">External Gift Card</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Track gift cards purchased from external providers. These cards are managed by the provider.
                </p>
                {formData.providerName && formData.providerUrl && (
                  <a 
                    href={formData.providerUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-4 text-primary hover:underline flex items-center gap-1"
                  >
                    Visit {formData.providerName} →
                  </a>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-wrap gap-2">
            {formData.cardType !== 'external' && (
              <>
                <Button variant="outline" onClick={() => handleDownload('png')} className="gap-2">
                  <Download className="h-4 w-4" />
                  PNG
                </Button>
                <Button variant="outline" onClick={() => handleDownload('jpg')} className="gap-2">
                  <Download className="h-4 w-4" />
                  JPG
                </Button>
                <Button variant="outline" onClick={() => handleDownload('pdf')} className="gap-2">
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
              </>
            )}
            <Button onClick={handleSave}>
              {editingId ? 'Update' : 'Create'} Gift Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
