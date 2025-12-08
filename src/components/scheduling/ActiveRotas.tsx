import { Calendar, Users, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ActiveRotas() {
  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <Input placeholder="Select range..." className="max-w-xs" />
          <Input placeholder="Rota name..." className="max-w-xs" />
          <Button variant="ghost" className="text-primary">Clear all filters</Button>
          <Button className="ml-auto">Create new rota</Button>
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
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="w-16 h-16 text-primary" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">No rotas to see here yet...</h3>
            <p className="text-muted-foreground">
              Active rotas that are currently running are shown here. Create your first rota to get started!
            </p>
          </div>
          <Button size="lg" className="mt-4">Create your first rota</Button>
        </div>
      </Card>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Create & manage</h3>
              <p className="text-muted-foreground text-sm">
                Create, plan and manage rotas all in one place. Add multiple staff to shifts, edit ongoing shifts and get an up-to-date view of who's working when.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Share with employees</h3>
              <p className="text-muted-foreground text-sm">
                We'll automatically share published rotas with your staff so they always know when they work. Made changes to shifts? We'll let the employee know so you don't have to.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
