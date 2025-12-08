import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Gift, Calendar } from 'lucide-react';

interface GiftCard {
  id: string;
  title: string;
  type: 'birthday' | 'custom';
  date?: string;
  discount: string;
  code: string;
  description: string;
  createdAt: string;
}

interface GiftCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<GiftCard>) => void;
  editingCard: GiftCard | null;
}

export function GiftCardDialog({ open, onOpenChange, onSave, editingCard }: GiftCardDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    type: 'birthday' as 'birthday' | 'custom',
    date: '',
    discount: '',
    code: '',
    description: ''
  });

  useEffect(() => {
    if (editingCard) {
      setFormData({
        title: editingCard.title,
        type: editingCard.type,
        date: editingCard.date || '',
        discount: editingCard.discount,
        code: editingCard.code,
        description: editingCard.description
      });
    } else {
      setFormData({
        title: '',
        type: 'birthday',
        date: '',
        discount: '',
        code: '',
        description: ''
      });
    }
  }, [editingCard, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingCard ? 'Edit Gift Card' : 'Create New Gift Card'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Birthday Special"
              required
            />
          </div>

          {/* Type Selection */}
          <div className="space-y-3">
            <Label>Card Type *</Label>
            <RadioGroup
              value={formData.type}
              onValueChange={(value: 'birthday' | 'custom') => 
                setFormData({ ...formData, type: value, date: value === 'birthday' ? '' : formData.date })
              }
            >
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="birthday" id="birthday" />
                <Label htmlFor="birthday" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Gift className="h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium">Birthday Gift Card</div>
                    <div className="text-sm text-muted-foreground">Automatically valid on employee birthdays</div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium">Custom Date</div>
                    <div className="text-sm text-muted-foreground">Set a specific date for this gift card</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Custom Date */}
          {formData.type === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="date">Valid Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          )}

          {/* Discount and Code */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discount">Discount Amount *</Label>
              <Input
                id="discount"
                value={formData.discount}
                onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                placeholder="e.g., 20% OFF"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Coupon Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., BDAY20"
                className="font-mono"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter a message for the gift card recipient..."
              rows={3}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingCard ? 'Save Changes' : 'Create Gift Card'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
