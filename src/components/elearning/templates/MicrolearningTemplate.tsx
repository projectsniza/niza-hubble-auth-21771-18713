import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';

interface Props {
  lesson: any;
  lessonIndex: number;
  totalLessons: number;
  isCompleted: boolean;
}

export default function MicrolearningTemplate({ lesson, lessonIndex, totalLessons, isCompleted }: Props) {
  const content = Array.isArray(lesson.content) ? lesson.content : [];
  const [cardIndex, setCardIndex] = useState(0);

  // Each content block becomes a card
  const cards = content.length > 0 ? content : [{ type: 'paragraph', content: 'No content yet.' }];
  const currentCard = cards[cardIndex];

  const renderCardContent = (block: any) => {
    switch (block.type) {
      case 'heading':
        return <h2 className="text-2xl font-bold text-foreground text-center">{block.content}</h2>;
      case 'subheading':
        return <h3 className="text-lg font-semibold text-foreground/90 text-center">{block.content}</h3>;
      case 'paragraph':
        return <p className="text-foreground/80 leading-relaxed text-center text-lg">{block.content}</p>;
      case 'bullet_points':
        return (
          <div className="space-y-3 w-full">
            {(block.items || []).map((item: string, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Zap className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span className="text-foreground/80">{item}</span>
              </div>
            ))}
          </div>
        );
      case 'image':
        return block.url ? <img src={block.url} alt={block.content || ''} className="w-full rounded-xl max-h-64 object-cover" /> : null;
      case 'highlight':
      case 'infobox':
      case 'note':
        return (
          <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center">
            <Zap className="h-6 w-6 text-orange-500 mx-auto mb-2" />
            <p className="text-foreground font-medium">{block.content}</p>
          </div>
        );
      case 'quote':
        return (
          <div className="text-center">
            <p className="text-xl italic text-foreground/70">"{block.content}"</p>
          </div>
        );
      default:
        return <p className="text-foreground/80 text-center">{block.content}</p>;
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 md:p-10 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="flex items-center gap-2 mb-6">
        <Badge className="bg-pink-500/10 text-pink-600">Microlearning</Badge>
        <Badge variant="outline" className="text-xs">Lesson {lessonIndex + 1}</Badge>
      </div>

      <h1 className="text-xl font-bold text-foreground mb-6 text-center">{lesson.title}</h1>

      {/* Card */}
      <Card className="w-full border-primary/20 shadow-lg">
        <CardContent className="p-8 flex flex-col items-center justify-center min-h-[300px] gap-4">
          <div className="text-xs text-muted-foreground mb-2">
            Card {cardIndex + 1} of {cards.length}
          </div>
          {renderCardContent(currentCard)}
        </CardContent>
      </Card>

      {/* Card Navigation */}
      <div className="flex items-center justify-between w-full mt-6">
        <Button variant="outline" size="sm" disabled={cardIndex === 0} onClick={() => setCardIndex(cardIndex - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-1">
          {cards.map((_: any, i: number) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === cardIndex ? 'bg-orange-500' : 'bg-muted'}`} />
          ))}
        </div>
        <Button variant="outline" size="sm" disabled={cardIndex >= cards.length - 1} onClick={() => setCardIndex(cardIndex + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
