import { useState, useRef, useEffect } from 'react';
import { Upload, Plus, Palette, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBrandSettings } from '@/hooks/useTemplates';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function BrandSettings() {
  const { brandSettings, isLoading, saveBrandSettings, uploadLogo } = useBrandSettings();
  const { toast } = useToast();
  const primaryLogoRef = useRef<HTMLInputElement>(null);
  const secondaryLogoRef = useRef<HTMLInputElement>(null);
  
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [newColor, setNewColor] = useState('#0057D9');
  const [colorName, setColorName] = useState('');
  const [brandColors, setBrandColors] = useState<{ name: string; color: string }[]>([]);
  const [uploading, setUploading] = useState<'primary' | 'secondary' | null>(null);

  useEffect(() => {
    if (brandSettings?.brand_colors) {
      try {
        const colors = Array.isArray(brandSettings.brand_colors) 
          ? brandSettings.brand_colors 
          : JSON.parse(brandSettings.brand_colors as any);
        setBrandColors(colors);
      } catch {
        setBrandColors([]);
      }
    }
  }, [brandSettings]);

  const handleLogoUpload = async (file: File, type: 'primary' | 'secondary') => {
    try {
      setUploading(type);
      await uploadLogo(file, type);
      toast({ title: `${type === 'primary' ? 'Primary' : 'Secondary'} logo uploaded successfully` });
    } catch (error) {
      toast({ title: 'Error uploading logo', variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const handleAddColor = async () => {
    if (!colorName.trim()) {
      toast({ title: 'Please enter a color name', variant: 'destructive' });
      return;
    }
    const newColors = [...brandColors, { name: colorName, color: newColor }];
    setBrandColors(newColors);
    await saveBrandSettings({ brand_colors: newColors as any });
    setColorDialogOpen(false);
    setColorName('');
    setNewColor('#0057D9');
  };

  const handleRemoveColor = async (index: number) => {
    const newColors = brandColors.filter((_, i) => i !== index);
    setBrandColors(newColors);
    await saveBrandSettings({ brand_colors: newColors as any });
  };

  const handleRemoveLogo = async (type: 'primary' | 'secondary') => {
    const field = type === 'primary' ? 'primary_logo_path' : 'secondary_logo_path';
    await saveBrandSettings({ [field]: null });
    toast({ title: `${type === 'primary' ? 'Primary' : 'Secondary'} logo removed` });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Brand Settings</h1>
        <p className="text-muted-foreground mt-1">Manage logos, colors, and brand assets</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Primary Logo */}
        <Card>
          <CardHeader>
            <CardTitle>Company Logo (Primary)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center relative">
              {brandSettings?.primary_logo_path ? (
                <div className="relative">
                  <img 
                    src={brandSettings.primary_logo_path} 
                    alt="Primary Logo" 
                    className="max-h-32 mx-auto object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-0 right-0"
                    onClick={() => handleRemoveLogo('primary')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-4xl">🏢</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">No logo uploaded</p>
                </>
              )}
              <input
                ref={primaryLogoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file, 'primary');
                }}
              />
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => primaryLogoRef.current?.click()}
                disabled={uploading === 'primary'}
              >
                <Upload className="h-4 w-4" />
                {uploading === 'primary' ? 'Uploading...' : 'Upload Logo'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Recommended: PNG or SVG, minimum 512x512px
            </p>
          </CardContent>
        </Card>

        {/* Secondary Logo */}
        <Card>
          <CardHeader>
            <CardTitle>Secondary Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center relative">
              {brandSettings?.secondary_logo_path ? (
                <div className="relative">
                  <img 
                    src={brandSettings.secondary_logo_path} 
                    alt="Secondary Logo" 
                    className="max-h-32 mx-auto object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-0 right-0"
                    onClick={() => handleRemoveLogo('secondary')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-4xl">📱</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">No secondary logo uploaded</p>
                </>
              )}
              <input
                ref={secondaryLogoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file, 'secondary');
                }}
              />
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => secondaryLogoRef.current?.click()}
                disabled={uploading === 'secondary'}
              >
                <Upload className="h-4 w-4" />
                {uploading === 'secondary' ? 'Uploading...' : 'Upload Alternative Logo'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Optional: Light version for dark backgrounds
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Brand Colors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Brand Colors</CardTitle>
          <Button size="sm" className="gap-2" onClick={() => setColorDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Color
          </Button>
        </CardHeader>
        <CardContent>
          {brandColors.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {brandColors.map((colorItem, index) => (
                <div key={index} className="relative group">
                  <div 
                    className="w-full aspect-square rounded-lg border border-border shadow-sm"
                    style={{ backgroundColor: colorItem.color }}
                  />
                  <div className="mt-2 text-center">
                    <p className="text-sm font-medium">{colorItem.name}</p>
                    <p className="text-xs text-muted-foreground">{colorItem.color}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveColor(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Palette className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No brand colors configured</h3>
              <p className="text-muted-foreground mb-4">Add your brand colors to maintain consistency</p>
              <Button size="sm" className="gap-2" onClick={() => setColorDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add First Color
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Color Dialog */}
      <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Brand Color</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Color Name</Label>
              <Input 
                placeholder="e.g., Primary Blue, Accent Green"
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-16 h-10 rounded cursor-pointer border-0"
                />
                <Input 
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <div 
              className="w-full h-20 rounded-lg border"
              style={{ backgroundColor: newColor }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColorDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddColor}>Add Color</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
