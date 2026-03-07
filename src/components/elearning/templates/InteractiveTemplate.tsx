import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, Lightbulb, HelpCircle } from 'lucide-react';

interface Props {
  lesson: any;
  lessonIndex: number;
  totalLessons: number;
  isCompleted: boolean;
}

export default function InteractiveTemplate({ lesson, lessonIndex, totalLessons, isCompleted }: Props) {
  const content = Array.isArray(lesson.content) ? lesson.content : [];
  const [revealedBlocks, setRevealedBlocks] = useState<Set<number>>(new Set());

  const toggleReveal = (index: number) => {
    setRevealedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10">
      <div className="flex items-center gap-2 mb-6">
        <Badge className="bg-orange-500/10 text-orange-600">Interactive</Badge>
        <Badge variant="outline">Lesson {lessonIndex + 1} of {totalLessons}</Badge>
        {isCompleted && <Badge className="bg-green-500/10 text-green-600">Completed</Badge>}
      </div>

      <h1 className="text-3xl font-bold text-foreground mb-8">{lesson.title}</h1>

      <div className="space-y-6">
        {content.map((block: any, i: number) => {
          switch (block.type) {
            case 'heading':
              return <h2 key={i} className="text-xl font-bold text-foreground mt-6">{block.content}</h2>;
            case 'subheading':
              return <h3 key={i} className="text-base font-semibold text-foreground/90">{block.content}</h3>;
            case 'paragraph':
              return <p key={i} className="text-foreground/80 leading-relaxed">{block.content}</p>;
            case 'bullet_points':
              return (
                <ul key={i} className="space-y-2">
                  {(block.items || []).map((item: string, j: number) => (
                    <li key={j} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                      <span className="text-foreground/80">{item}</span>
                    </li>
                  ))}
                </ul>
              );
            case 'highlight':
              return (
                <Card key={i} className="border-orange-500/30 bg-orange-500/5 cursor-pointer" onClick={() => toggleReveal(i)}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <Lightbulb className="h-5 w-5 text-orange-500" />
                      <span className="font-medium text-orange-700">Think About This</span>
                    </div>
                    {revealedBlocks.has(i) ? (
                      <p className="text-foreground/80 mt-2">{block.content}</p>
                    ) : (
                      <p className="text-muted-foreground italic text-sm">Click to reveal the answer...</p>
                    )}
                  </CardContent>
                </Card>
              );
            case 'infobox':
              return (
                <Card key={i} className="border-blue-500/30 bg-blue-500/5">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <HelpCircle className="h-5 w-5 text-blue-500" />
                      <span className="font-medium text-blue-700">Scenario</span>
                    </div>
                    <p className="text-foreground/80">{block.content}</p>
                  </CardContent>
                </Card>
              );
            case 'quote':
              return (
                <Card key={i} className="border-purple-500/30 bg-purple-500/5">
                  <CardContent className="p-5">
                    <p className="text-foreground/80 italic text-lg">"{block.content}"</p>
                  </CardContent>
                </Card>
              );
            case 'image':
              return block.url ? <img key={i} src={block.url} alt={block.content || ''} className="w-full rounded-lg max-h-80 object-cover" /> : null;
            default:
              return <p key={i} className="text-foreground/80">{block.content}</p>;
          }
        })}
      </div>
    </div>
  );
}
