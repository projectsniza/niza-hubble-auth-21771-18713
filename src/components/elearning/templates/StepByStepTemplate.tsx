import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Target, Zap, Shield, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  lesson: any;
  lessonIndex: number;
  totalLessons: number;
  isCompleted: boolean;
}

export default function StepByStepTemplate({ lesson, lessonIndex, totalLessons, isCompleted }: Props) {
  const content = Array.isArray(lesson.content) ? lesson.content : [];
  const stepProgress = Math.round(((lessonIndex + 1) / totalLessons) * 100);
  const xpPerLesson = 30;

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10">
      {/* Gamified Progress Header */}
      <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-emerald-500/5 to-green-500/5 border border-emerald-500/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-foreground">Step {lessonIndex + 1} of {totalLessons}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
            <Zap className="h-3 w-3 text-amber-500" />
            <span className="text-xs font-bold text-amber-600">+{xpPerLesson} XP</span>
          </div>
        </div>
        <div className="relative">
          <Progress value={stepProgress} className="h-3" />
          <div className="flex justify-between mt-2">
            {Array.from({ length: totalLessons }).map((_, i) => (
              <div key={i} className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                i < lessonIndex ? "bg-gradient-to-br from-emerald-400 to-green-500 border-emerald-500/40" :
                i === lessonIndex ? "bg-primary border-primary/40 ring-2 ring-primary/20" :
                "bg-muted border-muted-foreground/20"
              )}>
                {i < lessonIndex ? (
                  <CheckCircle className="h-3 w-3 text-white" />
                ) : i === lessonIndex ? (
                  <Star className="h-2.5 w-2.5 text-primary-foreground" />
                ) : (
                  <span className="text-[8px] font-bold text-muted-foreground">{i + 1}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <Card className="border-primary/20 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-green-500 to-primary" />
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20">
              {lessonIndex + 1}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{lesson.title}</h1>
              {isCompleted && (
                <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 mt-1 gap-1">
                  <Shield className="h-3 w-3" /> Completed -- +{xpPerLesson} XP Earned
                </Badge>
              )}
            </div>
          </div>

          {content.map((block: any, i: number) => {
            switch (block.type) {
              case 'heading':
                return (
                  <div key={i} className="flex items-center gap-3 mt-6 mb-3">
                    <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-green-500" />
                    <h2 className="text-xl font-bold text-foreground">{block.content}</h2>
                  </div>
                );
              case 'subheading':
                return <h3 key={i} className="text-base font-semibold text-foreground mt-4 mb-2">{block.content}</h3>;
              case 'paragraph':
                return <p key={i} className="text-foreground/80 leading-relaxed mb-4">{block.content}</p>;
              case 'bullet_points':
                return (
                  <div key={i} className="mb-4 space-y-2">
                    {(block.items || []).map((item: string, j: number) => (
                      <div key={j} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/50 animate-fade-in" style={{ animationDelay: `${j * 60}ms` }}>
                        <div className="w-6 h-6 rounded-md border-2 border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <CheckCircle className="h-3 w-3 text-emerald-500" />
                        </div>
                        <span className="text-foreground/80">{item}</span>
                      </div>
                    ))}
                  </div>
                );
              case 'image':
                return block.url ? (
                  <img key={i} src={block.url} alt={block.content || ''} className="w-full rounded-xl my-4 max-h-80 object-cover shadow-lg" />
                ) : (
                  <div key={i} className="w-full h-40 rounded-xl bg-muted/50 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center my-4">
                    <span className="text-sm text-muted-foreground">Image placeholder</span>
                  </div>
                );
              case 'highlight':
              case 'infobox':
              case 'note':
                return (
                  <Card key={i} className="mb-4 border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-green-500/5 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-emerald-400 to-green-500" />
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center flex-shrink-0">
                        <Target className="h-4 w-4 text-white" />
                      </div>
                      <p className="text-foreground/80 font-medium">{block.content}</p>
                    </CardContent>
                  </Card>
                );
              default:
                return <p key={i} className="text-foreground/80 mb-3">{block.content}</p>;
            }
          })}
        </CardContent>
      </Card>
    </div>
  );
}
