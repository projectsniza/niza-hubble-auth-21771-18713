import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Search, Gift } from 'lucide-react';
import { GiftCardDialog } from '@/components/templates/GiftCardDialog';

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

export default function GiftCards() {
  const [searchQuery, setSearchQuery] = useState('');
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<GiftCard | null>(null);

  const handleSave = (cardData: Partial<GiftCard>) => {
    if (editingCard) {
      setGiftCards(giftCards.map(card =>
        card.id === editingCard.id ? { ...card, ...cardData } : card
      ));
    } else {
      const newCard: GiftCard = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString().split('T')[0],
        ...cardData as GiftCard
      };
      setGiftCards([newCard, ...giftCards]);
    }
    setDialogOpen(false);
    setEditingCard(null);
  };

  const handleCreateNew = () => {
    setEditingCard(null);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gift Cards & Coupons</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage gift cards for birthdays and special occasions
            </p>
          </div>
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Gift Card
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search gift cards..."
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

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Gift className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">No gift cards yet</h3>
              <p className="text-muted-foreground mb-4">Create gift cards for birthdays and special occasions</p>
            </div>
            <Button onClick={handleCreateNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Gift Card
            </Button>
          </div>
        </Card>
      </div>

      <GiftCardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        editingCard={editingCard}
      />
    </div>
  );
}
