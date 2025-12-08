import { Calendar, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function OldRotas() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Old rotas</h2>
          <p className="text-muted-foreground">Rotas which have ended are shown here.</p>
        </div>
        <Button>Create new rota</Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Input placeholder="Select range..." />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Input placeholder="Rota name..." />
          </div>
          <Button variant="ghost" className="text-primary">Clear all filters</Button>
        </div>
        <div className="mt-4">
          <Select defaultValue="start-date">
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="start-date">Start date (Newest first)</SelectItem>
              <SelectItem value="start-date-old">Start date (Oldest first)</SelectItem>
              <SelectItem value="name">Rota name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Rota name (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Empty State */}
      <Card className="p-12 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="w-16 h-16 text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">No rotas to see here yet...</h3>
          <p className="text-muted-foreground mb-4">
            Old rotas that have finished will appear here for your reference.
          </p>
        </div>
      </Card>

      {/* Report Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">Generate a rota report</h3>
            <p className="text-muted-foreground text-sm">
              At the tap of a button, you can download a summary of the hours your staff have worked over a set period. It also includes the total hours worked.
            </p>
          </div>
          <Button variant="outline" className="flex-shrink-0">
            <Download className="mr-2 h-4 w-4" />
            Download rota report
          </Button>
        </div>
      </Card>
    </div>
  );
}
