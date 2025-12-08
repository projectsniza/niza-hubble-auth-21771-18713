import { useState } from 'react';
import { Calendar, Copy, Table, CalendarDays, Layers, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type RotaView = 'table' | 'timeline' | 'drag-drop';
type CreateMode = 'new' | 'copy' | null;

export function CreateRota() {
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [selectedView, setSelectedView] = useState<RotaView>('table');

  if (!createMode) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Create a rota</h2>
          <p className="text-muted-foreground">
            Create and manage staggered shift patterns to support your back to work plans and manage shift rotas for employees who regularly change their hours of work.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">What would you like to do?</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <Card
              className="p-6 cursor-pointer hover:border-primary transition-all"
              onClick={() => setCreateMode('new')}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Create a new rota</h3>
                  <p className="text-muted-foreground text-sm">
                    Create a new bespoke rota for your business. Choose your shift times, assign employees and add notes before publishing.
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-6 cursor-pointer hover:border-primary transition-all"
              onClick={() => setCreateMode('copy')}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Copy className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Copy an existing rota</h3>
                  <p className="text-muted-foreground text-sm">
                    Choose to copy a previous rota and pull through existing shifts and rota notes. Then, select a new start date and make any changes you need before publishing.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {createMode === 'new' ? 'Create a new rota' : 'Copy an existing rota'}
        </h2>
        <Button variant="outline" onClick={() => setCreateMode(null)}>
          Back
        </Button>
      </div>

      <Card className="p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="rota-name">
              Rota name <span className="text-destructive">*</span>
            </Label>
            <Input id="rota-name" placeholder="Enter a new rota name" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rota-duration" className="flex items-center gap-2">
              Rota duration <span className="text-destructive">*</span>
              <Info className="h-4 w-4 text-muted-foreground" />
            </Label>
            <Select defaultValue="7">
              <SelectTrigger id="rota-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="21">21 days</SelectItem>
                <SelectItem value="28">28 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date">Rota start date</Label>
            <Input id="start-date" type="date" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget" className="flex items-center gap-2">
              Rota budget
              <Info className="h-4 w-4 text-muted-foreground" />
            </Label>
            <div className="flex gap-2">
              <Input id="budget" placeholder="1,000.00" className="flex-1" />
              <span className="flex items-center text-muted-foreground px-3 py-2 border rounded-md bg-muted">
                (GBP)
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Label>Select your rota view</Label>
          <div className="grid md:grid-cols-3 gap-4">
            <Card
              className={cn(
                'p-6 cursor-pointer transition-all',
                selectedView === 'table' && 'border-primary bg-primary/5'
              )}
              onClick={() => setSelectedView('table')}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className={cn(
                    'w-16 h-16 rounded-lg flex items-center justify-center',
                    selectedView === 'table' ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                  )}>
                    <Table className="w-8 h-8" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Table view</h3>
                  <p className="text-sm text-muted-foreground">
                    Set your shift times and easily assign this across employees and dates at once, with a click.
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className={cn(
                'p-6 cursor-pointer transition-all',
                selectedView === 'timeline' && 'border-primary bg-primary/5'
              )}
              onClick={() => setSelectedView('timeline')}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className={cn(
                    'w-16 h-16 rounded-lg flex items-center justify-center',
                    selectedView === 'timeline' ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                  )}>
                    <CalendarDays className="w-8 h-8" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Timeline view</h3>
                  <p className="text-sm text-muted-foreground">
                    Add your shift times and assign this to as many employees as you need, right then and there.
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className={cn(
                'p-6 cursor-pointer transition-all',
                selectedView === 'drag-drop' && 'border-primary bg-primary/5'
              )}
              onClick={() => setSelectedView('drag-drop')}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className={cn(
                    'w-16 h-16 rounded-lg flex items-center justify-center',
                    selectedView === 'drag-drop' ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                  )}>
                    <Layers className="w-8 h-8" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Drag and drop view</h3>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop each employee onto the shift you'd like them to work.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button variant="outline" onClick={() => setCreateMode(null)}>
            Cancel
          </Button>
          <Button>
            Continue
          </Button>
        </div>
      </Card>
    </div>
  );
}
