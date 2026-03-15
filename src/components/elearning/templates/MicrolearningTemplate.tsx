import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Zap, Star, Target, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  lesson: any;
  lessonIndex: number;
  totalLessons: number;
  isCompleted: boolean;
}

export default function MicrolearningTemplate({ lesson, lessonIndex, totalLessons, isCompleted }: Props) {
  const content = Array.isArray(lesson.content) ? lesson.content : [];
  const [cardIndex, setCardIndex] = useState(0);
  const xpPerLesson = 20;

  const cards = content.length > 0 ? content : [{ type: 'paragraph', content: 'No content yet.' }];
  const currentCard = cards[cardIndex];
  const isLastCard = cardIndex === cards.length - 1;
  const progressPercent = ((cardIndex + 1) / cards.length) * 100;

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
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-white">{i + 1}</span>
                </div>
                <span className="text-foreground/80 text-sm">{item}</span>
              </div>
            ))}
          </div>
        );
      case 'image':
        return block.url ? (
          <img src={block.url} alt={block.content || ''} className="w-full rounded-xl max-h-64 object-cover shadow-lg" />
        ) : (
          <div className="w-full h-40 rounded-xl bg-muted/50 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Image placeholder</span>
          </div>
        );
      case 'highlight':
      case 'infobox':
      case 'note':
        return (
          <div className="p-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/20 text-center">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center mx-auto mb-3">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <p className="text-foreground font-medium">{block.content}</p>
          </div>
        );
      case 'quote':
        return (
          <div className="text-center py-4">
            <p className="text-xl italic text-foreground/70">"{block.content}"</p>
          </div>
        );
      default:
        return <p className="text-foreground/80 text-center">{block.content}</p>;
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 md:p-10 flex flex-col items-center justify-center min-h-[60vh]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Badge className="bg-pink-500/10 text-pink-600 border border-pink-500/30 gap-1">
          <Target className="h-3 w-3" /> Microlearning
        </Badge>
        <Badge variant="outline" className="text-xs">Lesson {lessonIndex + 1}</Badge>
      </div>

      <h1 className="text-xl font-bold text-foreground mb-2 text-center">{lesson.title}</h1>
      
      {/* XP indicator */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 mb-6">
        <Zap className="h-3 w-3 text-amber-500" />
        <span className="text-xs font-bold text-amber-600">+{xpPerLesson} XP</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-muted mb-4 overflow-hidden">
        <div 
          className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Card */}
      <Card className={cn(
        "w-full border-2 shadow-lg transition-all overflow-hidden",
        isLastCard ? "border-amber-500/30" : "border-primary/20"
      )}>
        {isLastCard && <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />}
        <CardContent className="p-8 flex flex-col items-center justify-center min-h-[300px] gap-4">
          <div className="text-xs text-muted-foreground mb-2 font-mono">
            {cardIndex + 1} / {cards.length}
          </div>
          {renderCardContent(currentCard)}
          
          {isLastCard && !isCompleted && (
            <div className="mt-4 flex items-center gap-2 text-amber-600">
              <Trophy className="h-4 w-4" />
              <span className="text-sm font-bold">Almost done -- complete to earn XP</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card Navigation */}
      <div className="flex items-center justify-between w-full mt-6">
        <Button variant="outline" size="sm" disabled={cardIndex === 0} onClick={() => setCardIndex(cardIndex - 1)} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex gap-1.5">
          {cards.map((_: any, i: number) => (
            <button
              key={i} 
              onClick={() => setCardIndex(i)}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all",
                i === cardIndex ? "bg-gradient-to-r from-pink-400 to-rose-500 scale-125" : 
                i < cardIndex ? "bg-pink-400/50" : "bg-muted"
              )}
            />
          ))}
        </div>
        <Button variant="outline" size="sm" disabled={cardIndex >= cards.length - 1} onClick={() => setCardIndex(cardIndex + 1)} className="gap-1">
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
