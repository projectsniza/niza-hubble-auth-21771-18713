import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Info, AlertCircle, Quote, Zap, Target, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  lesson: any;
  lessonIndex: number;
  totalLessons: number;
  isCompleted: boolean;
}

export default function ClassicTemplate({ lesson, lessonIndex, totalLessons, isCompleted }: Props) {
  const content = Array.isArray(lesson.content) ? lesson.content : [];
  const xpPerLesson = 25;
  const currentXP = (lessonIndex + (isCompleted ? 1 : 0)) * xpPerLesson;
  const totalXP = totalLessons * xpPerLesson;

  const renderBlock = (block: any, index: number) => {
    switch (block.type) {
      case 'heading':
        return (
          <div key={index} className="flex items-center gap-3 mt-8 mb-4">
            <div className="w-1 h-8 rounded-full bg-gradient-to-b from-primary to-primary/50" />
            <h2 className="text-2xl font-bold text-foreground">{block.content}</h2>
          </div>
        );
      case 'subheading':
        return <h3 key={index} className="text-lg font-semibold text-foreground mt-5 mb-2">{block.content}</h3>;
      case 'paragraph':
        return <p key={index} className="text-foreground/80 leading-relaxed mb-4">{block.content}</p>;
      case 'bullet_points':
        return (
          <div key={index} className="mb-4 space-y-2">
            {(block.items || []).map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                </div>
                <span className="text-foreground/80 text-sm">{item}</span>
              </div>
            ))}
          </div>
        );
      case 'image':
        return (
          <div key={index} className="mb-4">
            {block.url ? (
              <img src={block.url} alt={block.content || ''} className="w-full rounded-xl max-h-96 object-cover shadow-lg" />
            ) : (
              <div className="w-full h-48 rounded-xl bg-muted/50 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                <span className="text-sm text-muted-foreground">Image placeholder</span>
              </div>
            )}
            {block.content && <p className="text-sm text-muted-foreground mt-2 text-center italic">{block.content}</p>}
          </div>
        );
      case 'video':
        return (
          <div key={index} className="mb-4">
            {block.url && (
              <div className="aspect-video rounded-xl overflow-hidden bg-muted shadow-lg">
                <iframe src={block.url} className="w-full h-full" allowFullScreen />
              </div>
            )}
            {block.content && <p className="text-sm text-muted-foreground mt-2 text-center">{block.content}</p>}
          </div>
        );
      case 'highlight':
        return (
          <Card key={index} className="mb-4 border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Key Takeaway</p>
                <p className="text-foreground font-medium">{block.content}</p>
              </div>
            </CardContent>
          </Card>
        );
      case 'note':
        return (
          <Card key={index} className="mb-4 border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Important Note</p>
                <p className="text-foreground/80">{block.content}</p>
              </div>
            </CardContent>
          </Card>
        );
      case 'quote':
        return (
          <div key={index} className="mb-4 pl-4 border-l-4 border-primary/30 py-3 bg-primary/5 rounded-r-lg">
            <Quote className="h-5 w-5 text-primary/40 mb-2" />
            <p className="italic text-foreground/70 text-lg">{block.content}</p>
          </div>
        );
      case 'infobox':
        return (
          <Card key={index} className="mb-4 border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-green-500/5 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-green-500" />
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center flex-shrink-0">
                <Info className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Did You Know</p>
                <p className="text-foreground/80">{block.content}</p>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return <p key={index} className="text-foreground/80 mb-4">{block.content}</p>;
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10">
      {/* Gamified header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1 border-primary/30">
            <Target className="h-3 w-3" /> Lesson {lessonIndex + 1} of {totalLessons}
          </Badge>
          {isCompleted && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 gap-1">
              <Shield className="h-3 w-3" /> Completed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <Zap className="h-3 w-3 text-amber-500" />
          <span className="text-xs font-bold text-amber-600">{currentXP}/{totalXP} XP</span>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-foreground mb-6">{lesson.title}</h1>

      {content.map(renderBlock)}

      {/* XP reward footer */}
      {!isCompleted && (
        <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Complete this lesson to earn +{xpPerLesson} XP</p>
            <p className="text-xs text-muted-foreground">Progress towards your next achievement</p>
          </div>
        </div>
      )}
    </div>
  );
}
