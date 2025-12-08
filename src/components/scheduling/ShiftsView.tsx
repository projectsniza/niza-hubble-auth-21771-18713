import { Calendar, Users, Monitor } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export function ShiftsView() {
  const [showShiftsFor, setShowShiftsFor] = useState<'everyone' | 'me'>('everyone');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Shifts</h2>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 flex-1">
            <Input 
              placeholder="28/10/2025 - 04/11/2025" 
              className="max-w-xs"
            />
            <Input 
              placeholder="Name, rota, label" 
              className="max-w-xs"
            />
            <Button variant="ghost" className="text-primary">Clear all filters</Button>
          </div>
          <div className="flex gap-2">
            <span className="text-sm text-muted-foreground mr-2">Show shifts for</span>
            <Button
              variant={showShiftsFor === 'everyone' ? 'default' : 'outline'}
              onClick={() => setShowShiftsFor('everyone')}
              size="sm"
            >
              Everyone
            </Button>
            <Button
              variant={showShiftsFor === 'me' ? 'default' : 'outline'}
              onClick={() => setShowShiftsFor('me')}
              size="sm"
            >
              Me
            </Button>
          </div>
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
          <h3 className="text-xl font-semibold mb-2">No shifts to see here yet...</h3>
          <p className="text-muted-foreground">
            All your upcoming shifts will appear here once you create your first rota.
          </p>
        </div>
      </Card>

      {/* Info Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-10 h-10 text-primary" />
              </div>
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
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-10 h-10 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Share with employees</h3>
              <p className="text-muted-foreground text-sm">
                We'll automatically share published rotas with your staff so they always know when they work. Made changes to shifts? We'll let the employee know so you don't have to.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Monitor className="w-10 h-10 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Everything in one place</h3>
              <p className="text-muted-foreground text-sm">
                No need to use different tools and software to keep track of rotas and staff details. BrightHR has all the information in one place so you can access it anywhere anytime.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Info */}
      <Card className="p-6">
        <div>
          <h3 className="font-semibold text-lg mb-2">Rotas made easy</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Our rota planning feature makes ensuring you have the right people, in the right place, at the right time, easier than ever! So whether you're staggering shifts to support social distancing, or sharing notes with your staff before their shift you'll have peace of mind that everything has been taken care of with BrightHR.
          </p>
          <p className="text-muted-foreground text-sm">
            Even better, with this feature also available on our mobile app, your employees will always have a copy of their rota to hand whenever they need it.
          </p>
          <Button variant="link" className="p-0 h-auto text-primary mt-2">
            Create a rota
          </Button>
        </div>
      </Card>
    </div>
  );
}
