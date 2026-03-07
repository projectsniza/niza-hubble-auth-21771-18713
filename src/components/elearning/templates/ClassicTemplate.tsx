import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Info, AlertCircle, Quote } from 'lucide-react';

interface Props {
  lesson: any;
  lessonIndex: number;
  totalLessons: number;
  isCompleted: boolean;
}

export default function ClassicTemplate({ lesson, lessonIndex, totalLessons, isCompleted }: Props) {
  const content = Array.isArray(lesson.content) ? lesson.content : [];

  const renderBlock = (block: any, index: number) => {
    switch (block.type) {
      case 'heading':
        return <h2 key={index} className="text-2xl font-bold text-foreground mt-6 mb-3">{block.content}</h2>;
      case 'subheading':
        return <h3 key={index} className="text-lg font-semibold text-foreground mt-4 mb-2">{block.content}</h3>;
      case 'paragraph':
        return <p key={index} className="text-foreground/80 leading-relaxed mb-4">{block.content}</p>;
      case 'bullet_points':
        return (
          <ul key={index} className="list-disc pl-6 mb-4 space-y-1.5">
            {(block.items || []).map((item: string, i: number) => (
              <li key={i} className="text-foreground/80">{item}</li>
            ))}
          </ul>
        );
      case 'image':
        return (
          <div key={index} className="mb-4">
            {block.url && <img src={block.url} alt={block.content || ''} className="w-full rounded-lg max-h-96 object-cover" />}
            {block.content && <p className="text-sm text-muted-foreground mt-2 text-center italic">{block.content}</p>}
          </div>
        );
      case 'video':
        return (
          <div key={index} className="mb-4">
            {block.url && (
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <iframe src={block.url} className="w-full h-full" allowFullScreen />
              </div>
            )}
            {block.content && <p className="text-sm text-muted-foreground mt-2 text-center">{block.content}</p>}
          </div>
        );
      case 'highlight':
        return (
          <Card key={index} className="mb-4 border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4">
              <p className="text-foreground font-medium">{block.content}</p>
            </CardContent>
          </Card>
        );
      case 'note':
        return (
          <Card key={index} className="mb-4 border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-foreground/80">{block.content}</p>
            </CardContent>
          </Card>
        );
      case 'quote':
        return (
          <blockquote key={index} className="border-l-4 border-primary/30 pl-4 py-2 mb-4 italic text-foreground/70">
            <Quote className="h-4 w-4 text-primary/40 mb-1" />
            {block.content}
          </blockquote>
        );
      case 'infobox':
        return (
          <Card key={index} className="mb-4 border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-foreground/80">{block.content}</p>
            </CardContent>
          </Card>
        );
      default:
        return <p key={index} className="text-foreground/80 mb-4">{block.content}</p>;
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10">
      <div className="flex items-center gap-2 mb-6">
        <Badge variant="outline" className="text-xs">Lesson {lessonIndex + 1} of {totalLessons}</Badge>
        {isCompleted && <Badge className="bg-green-500/10 text-green-600">Completed</Badge>}
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-6">{lesson.title}</h1>
      {content.map(renderBlock)}
    </div>
  );
}
