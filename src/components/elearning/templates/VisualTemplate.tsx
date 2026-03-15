import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Star, Eye, Target } from 'lucide-react';

interface Props {
  lesson: any;
  lessonIndex: number;
  totalLessons: number;
  isCompleted: boolean;
}

export default function VisualTemplate({ lesson, lessonIndex, totalLessons, isCompleted }: Props) {
  const content = Array.isArray(lesson.content) ? lesson.content : [];
  const xpPerLesson = 35;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Banner */}
      <div className="w-full h-64 bg-gradient-to-br from-purple-600/20 via-violet-500/20 to-pink-500/20 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.15),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(236,72,153,0.1),transparent_60%)]" />
        <div className="relative text-center z-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Badge variant="outline" className="border-purple-500/30 gap-1">
              <Eye className="h-3 w-3" /> Lesson {lessonIndex + 1} of {totalLessons}
            </Badge>
            {isCompleted && (
              <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 gap-1">
                <Star className="h-3 w-3" /> Complete
              </Badge>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">{lesson.title}</h1>
          <div className="flex items-center justify-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 mx-auto w-fit">
            <Zap className="h-3 w-3 text-amber-500" />
            <span className="text-xs font-bold text-amber-600">+{xpPerLesson} XP on completion</span>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-10 space-y-6">
        {content.map((block: any, i: number) => {
          switch (block.type) {
            case 'heading':
              return (
                <div key={i} className="flex items-center gap-3 mt-8">
                  <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-purple-400 to-pink-500" />
                  <h2 className="text-2xl font-bold text-foreground">{block.content}</h2>
                </div>
              );
            case 'subheading':
              return <h3 key={i} className="text-lg font-semibold text-foreground/90">{block.content}</h3>;
            case 'paragraph':
              return <p key={i} className="text-lg text-foreground/70 leading-relaxed">{block.content}</p>;
            case 'image':
              return (
                <div key={i} className="my-6">
                  {block.url ? (
                    <img src={block.url} alt={block.content || ''} className="w-full rounded-xl shadow-lg max-h-[500px] object-cover" />
                  ) : (
                    <div className="w-full h-64 rounded-xl bg-muted/50 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">Image placeholder</span>
                    </div>
                  )}
                  {block.content && <p className="text-center text-sm text-muted-foreground mt-3 italic">{block.content}</p>}
                </div>
              );
            case 'bullet_points':
              return (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(block.items || []).map((item: string, j: number) => (
                    <Card key={j} className="border-purple-500/10 hover:border-purple-500/30 transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-in" style={{ animationDelay: `${j * 100}ms` }}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-purple-500/20">{j + 1}</div>
                        <span className="text-sm text-foreground/80">{item}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            case 'video':
              return block.url ? (
                <div key={i} className="aspect-video rounded-xl overflow-hidden shadow-lg">
                  <iframe src={block.url} className="w-full h-full" allowFullScreen />
                </div>
              ) : null;
            case 'highlight':
            case 'note':
            case 'infobox':
              return (
                <Card key={i} className="border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-pink-500/5 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-500" />
                  <CardContent className="p-5 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center flex-shrink-0">
                      <Target className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-foreground/80">{block.content}</p>
                  </CardContent>
                </Card>
              );
            default:
              return (
                <Card key={i} className="border-primary/20">
                  <CardContent className="p-5">
                    <p className="text-foreground/80">{block.content}</p>
                  </CardContent>
                </Card>
              );
          }
        })}
      </div>
    </div>
  );
}
