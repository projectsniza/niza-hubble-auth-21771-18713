import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, CalendarDays, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

type RotaView = 'table' | 'timeline' | 'drag-drop';

export function RotaSettings() {
  const [defaultView, setDefaultView] = useState<RotaView>('table');
  const [restrictedPermissions, setRestrictedPermissions] = useState('disable');
  const [hideShiftLabels, setHideShiftLabels] = useState('disable');
  const [openShifts, setOpenShifts] = useState('disable');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Rota settings</h2>
        <p className="text-muted-foreground">
          Configure your rota preferences and permissions
        </p>
      </div>

      {/* Default View Selection */}
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Select your default rota view below</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <Card
              className={cn(
                'p-6 cursor-pointer transition-all',
                defaultView === 'table' && 'border-primary bg-primary/5'
              )}
              onClick={() => setDefaultView('table')}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className={cn(
                    'w-16 h-16 rounded-lg flex items-center justify-center',
                    defaultView === 'table' ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
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
                defaultView === 'timeline' && 'border-primary bg-primary/5'
              )}
              onClick={() => setDefaultView('timeline')}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className={cn(
                    'w-16 h-16 rounded-lg flex items-center justify-center',
                    defaultView === 'timeline' ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
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
                defaultView === 'drag-drop' && 'border-primary bg-primary/5'
              )}
              onClick={() => setDefaultView('drag-drop')}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className={cn(
                    'w-16 h-16 rounded-lg flex items-center justify-center',
                    defaultView === 'drag-drop' ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
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
      </Card>

      {/* Company Rota Settings */}
      <Card className="p-6 space-y-8">
        <div>
          <h3 className="text-lg font-semibold mb-6">Company rota settings</h3>
          
          {/* Restricted Permissions */}
          <div className="space-y-4 pb-6 border-b">
            <div>
              <Label className="text-base font-semibold">Restricted rota permissions</Label>
              <p className="text-sm text-muted-foreground mt-1">
                By enabling this setting, you are restricting the edit and delete capabilities of your managers. Once created, rotas can be edited by the author and by admins. Additional managers can be given edit permissions from the rota menu.
              </p>
            </div>
            <RadioGroup value={restrictedPermissions} onValueChange={setRestrictedPermissions}>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="enable" id="restricted-enable" />
                  <Label htmlFor="restricted-enable" className="font-normal cursor-pointer">Enable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="disable" id="restricted-disable" />
                  <Label htmlFor="restricted-disable" className="font-normal cursor-pointer">Disable</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Hide Shift Labels */}
          <div className="space-y-4 py-6 border-b">
            <div>
              <Label className="text-base font-semibold">Hide shift labels in rotas from employees</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Enabling this setting will prevent employees from seeing any colours and labels assigned to shifts on your rotas.
              </p>
            </div>
            <RadioGroup value={hideShiftLabels} onValueChange={setHideShiftLabels}>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="enable" id="labels-enable" />
                  <Label htmlFor="labels-enable" className="font-normal cursor-pointer">Enable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="disable" id="labels-disable" />
                  <Label htmlFor="labels-disable" className="font-normal cursor-pointer">Disable</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Accept/Decline Shifts */}
          <div className="space-y-4 py-6 border-b">
            <div>
              <Label className="text-base font-semibold">Ability to accept and decline shifts</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Select which employees have the ability to accept or decline shifts by clicking the button on the right.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Please note: Amending these settings will only impact shifts assigned after changes are saved.
              </p>
            </div>
            <Button variant="default">
              Select eligible employees
            </Button>
          </div>

          {/* Open Shifts */}
          <div className="space-y-4 pt-6">
            <div>
              <Label className="text-base font-semibold">Activate open shifts</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Enabling this setting will allow employees to assign themselves to available open shifts. Only admins and managers can create open shifts.
              </p>
            </div>
            <RadioGroup value={openShifts} onValueChange={setOpenShifts}>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="enable" id="open-enable" />
                  <Label htmlFor="open-enable" className="font-normal cursor-pointer">Enable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="disable" id="open-disable" />
                  <Label htmlFor="open-disable" className="font-normal cursor-pointer">Disable</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button variant="outline">Cancel</Button>
          <Button>Confirm</Button>
        </div>
      </Card>
    </div>
  );
}
