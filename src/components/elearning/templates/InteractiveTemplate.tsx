import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, Lightbulb, HelpCircle, Zap, Shield, Target, Trophy, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  lesson: any;
  lessonIndex: number;
  totalLessons: number;
  isCompleted: boolean;
}

export default function InteractiveTemplate({ lesson, lessonIndex, totalLessons, isCompleted }: Props) {
  const content = Array.isArray(lesson.content) ? lesson.content : [];
  const [revealedBlocks, setRevealedBlocks] = useState<Set<number>>(new Set());
  const [revealCount, setRevealCount] = useState(0);
  const xpPerLesson = 40;
  const bonusXP = revealCount * 5;

  const toggleReveal = (index: number) => {
    setRevealedBlocks(prev => {
      const next = new Set(prev);
      if (!next.has(index)) {
        next.add(index);
        setRevealCount(c => c + 1);
      } else {
        next.delete(index);
      }
      return next;
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10">
      {/* Gamified header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Badge className="bg-orange-500/10 text-orange-600 border border-orange-500/30 gap-1">
            <Target className="h-3 w-3" /> Interactive
          </Badge>
          <Badge variant="outline" className="gap-1">Lesson {lessonIndex + 1} of {totalLessons}</Badge>
          {isCompleted && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 gap-1">
              <Shield className="h-3 w-3" /> Completed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {bonusXP > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
              <Star className="h-3 w-3 text-purple-500" />
              <span className="text-[10px] font-bold text-purple-600">+{bonusXP} bonus</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
            <Zap className="h-3 w-3 text-amber-500" />
            <span className="text-xs font-bold text-amber-600">{xpPerLesson} XP</span>
          </div>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-foreground mb-8">{lesson.title}</h1>

      <div className="space-y-6">
        {content.map((block: any, i: number) => {
          switch (block.type) {
            case 'heading':
              return (
                <div key={i} className="flex items-center gap-3 mt-6">
                  <div className="w-1 h-6 rounded-full bg-gradient-to-b from-orange-400 to-amber-500" />
                  <h2 className="text-xl font-bold text-foreground">{block.content}</h2>
                </div>
              );
            case 'subheading':
              return <h3 key={i} className="text-base font-semibold text-foreground/90">{block.content}</h3>;
            case 'paragraph':
              return <p key={i} className="text-foreground/80 leading-relaxed">{block.content}</p>;
            case 'bullet_points':
              return (
                <div key={i} className="space-y-2">
                  {(block.items || []).map((item: string, j: number) => (
                    <div key={j} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors animate-fade-in" style={{ animationDelay: `${j * 80}ms` }}>
                      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-foreground/80">{item}</span>
                    </div>
                  ))}
                </div>
              );
            case 'highlight':
              return (
                <Card 
                  key={i} 
                  className={cn(
                    "border-orange-500/30 cursor-pointer transition-all hover:shadow-lg overflow-hidden",
                    revealedBlocks.has(i) ? "bg-gradient-to-r from-orange-500/5 to-amber-500/5" : "bg-muted/30"
                  )} 
                  onClick={() => toggleReveal(i)}
                >
                  <div className="h-1 bg-gradient-to-r from-orange-400 to-amber-500" />
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                          <Lightbulb className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-sm text-foreground">Think About This</span>
                      </div>
                      {!revealedBlocks.has(i) && (
                        <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600 gap-1">
                          <Star className="h-2.5 w-2.5" /> +5 XP
                        </Badge>
                      )}
                    </div>
                    {revealedBlocks.has(i) ? (
                      <p className="text-foreground/80 mt-2 animate-fade-in">{block.content}</p>
                    ) : (
                      <p className="text-muted-foreground italic text-sm">Tap to reveal and earn bonus XP...</p>
                    )}
                  </CardContent>
                </Card>
              );
            case 'infobox':
              return (
                <Card key={i} className="border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                        <HelpCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-bold text-sm text-foreground">Scenario Challenge</span>
                    </div>
                    <p className="text-foreground/80">{block.content}</p>
                  </CardContent>
                </Card>
              );
            case 'quote':
              return (
                <Card key={i} className="border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-violet-500/5 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-purple-400 to-violet-500" />
                  <CardContent className="p-5">
                    <p className="text-foreground/80 italic text-lg">"{block.content}"</p>
                  </CardContent>
                </Card>
              );
            case 'image':
              return block.url ? (
                <img key={i} src={block.url} alt={block.content || ''} className="w-full rounded-xl max-h-80 object-cover shadow-lg" />
              ) : (
                <div key={i} className="w-full h-40 rounded-xl bg-muted/50 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">Image placeholder</span>
                </div>
              );
            default:
              return <p key={i} className="text-foreground/80">{block.content}</p>;
          }
        })}
      </div>

      {/* Engagement stats */}
      {revealCount > 0 && (
        <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-purple-500/5 to-violet-500/5 border border-purple-500/20 flex items-center gap-3">
          <Trophy className="h-5 w-5 text-purple-500" />
          <div>
            <p className="text-sm font-bold text-foreground">Engaged Learner</p>
            <p className="text-xs text-muted-foreground">You revealed {revealCount} interactive element{revealCount > 1 ? 's' : ''} -- +{bonusXP} bonus XP</p>
          </div>
        </div>
      )}
    </div>
  );
}
