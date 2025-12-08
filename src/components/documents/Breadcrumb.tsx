import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BreadcrumbProps {
  path: string[];
  onNavigate: (index: number) => void;
}

export default function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-3 border-b bg-muted/30">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigate(0)}
        className="h-8 gap-1 text-muted-foreground hover:text-foreground"
      >
        <Home className="h-4 w-4" />
        <span>Documents</span>
      </Button>
      
      {path.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(index + 1)}
            className={`h-8 ${index === path.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
          >
            {item}
          </Button>
        </div>
      ))}
    </div>
  );
}
