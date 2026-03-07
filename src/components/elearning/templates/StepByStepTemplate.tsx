import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle } from 'lucide-react';

interface Props {
  lesson: any;
  lessonIndex: number;
  totalLessons: number;
  isCompleted: boolean;
}

export default function StepByStepTemplate({ lesson, lessonIndex, totalLessons, isCompleted }: Props) {
  const content = Array.isArray(lesson.content) ? lesson.content : [];
  const stepProgress = Math.round(((lessonIndex + 1) / totalLessons) * 100);

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Step {lessonIndex + 1} of {totalLessons}</span>
          <span className="text-sm text-muted-foreground">{stepProgress}%</span>
        </div>
        <Progress value={stepProgress} className="h-3" />
      </div>

      {/* Step Content */}
      <Card className="border-primary/20">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold">
              {lessonIndex + 1}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{lesson.title}</h1>
              {isCompleted && <Badge className="bg-green-500/10 text-green-600 mt-1"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>}
            </div>
          </div>

          {content.map((block: any, i: number) => {
            switch (block.type) {
              case 'heading':
                return <h2 key={i} className="text-xl font-bold text-foreground mt-6 mb-3">{block.content}</h2>;
              case 'subheading':
                return <h3 key={i} className="text-base font-semibold text-foreground mt-4 mb-2">{block.content}</h3>;
              case 'paragraph':
                return <p key={i} className="text-foreground/80 leading-relaxed mb-4">{block.content}</p>;
              case 'bullet_points':
                return (
                  <div key={i} className="mb-4 space-y-2">
                    {(block.items || []).map((item: string, j: number) => (
                      <div key={j} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
                        <div className="w-5 h-5 rounded border-2 border-primary/30 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">{j + 1}</span>
                        </div>
                        <span className="text-foreground/80">{item}</span>
                      </div>
                    ))}
                  </div>
                );
              case 'image':
                return block.url ? <img key={i} src={block.url} alt={block.content || ''} className="w-full rounded-lg my-4 max-h-80 object-cover" /> : null;
              case 'highlight':
              case 'infobox':
              case 'note':
                return (
                  <Card key={i} className="mb-4 border-green-500/30 bg-green-500/5">
                    <CardContent className="p-4">
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
