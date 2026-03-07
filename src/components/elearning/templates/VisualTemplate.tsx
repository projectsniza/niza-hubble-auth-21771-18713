import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  lesson: any;
  lessonIndex: number;
  totalLessons: number;
  isCompleted: boolean;
}

export default function VisualTemplate({ lesson, lessonIndex, totalLessons, isCompleted }: Props) {
  const content = Array.isArray(lesson.content) ? lesson.content : [];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Banner */}
      <div className="w-full h-64 bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Badge variant="outline" className="mb-3">Lesson {lessonIndex + 1} of {totalLessons}</Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{lesson.title}</h1>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-10 space-y-6">
        {content.map((block: any, i: number) => {
          switch (block.type) {
            case 'heading':
              return <h2 key={i} className="text-2xl font-bold text-foreground mt-8">{block.content}</h2>;
            case 'subheading':
              return <h3 key={i} className="text-lg font-semibold text-foreground/90">{block.content}</h3>;
            case 'paragraph':
              return <p key={i} className="text-lg text-foreground/70 leading-relaxed">{block.content}</p>;
            case 'image':
              return (
                <div key={i} className="my-6">
                  {block.url && <img src={block.url} alt={block.content || ''} className="w-full rounded-xl shadow-lg max-h-[500px] object-cover" />}
                  {block.content && <p className="text-center text-sm text-muted-foreground mt-3 italic">{block.content}</p>}
                </div>
              );
            case 'bullet_points':
              return (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(block.items || []).map((item: string, j: number) => (
                    <Card key={j} className="border-primary/10">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">{j + 1}</div>
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
