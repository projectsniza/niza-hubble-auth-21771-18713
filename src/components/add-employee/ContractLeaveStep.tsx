import { EmployeeFormData } from '@/pages/dashboard/AddEmployee';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface ContractLeaveStepProps {
  formData: EmployeeFormData;
  updateFormData: (updates: Partial<EmployeeFormData>) => void;
}

export default function ContractLeaveStep({ formData, updateFormData }: ContractLeaveStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Contract and annual leave information</h2>
        <p className="text-muted-foreground mb-6">Contracted hours of work, employment start date and leave entitlement</p>

        <Card className="p-6 mb-6 bg-muted/30">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold mb-1">Annual leave balance</h3>
              <p className="text-3xl font-bold text-primary">{formData.minLeaveEntitlement} days</p>
            </div>
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Entitlement unit in</span>
                <span className="font-medium">{formData.entitlementUnit === 'days' ? 'Days' : 'Hours'}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Contract summary</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Employment type</Label>
            <Select value={formData.employmentType} onValueChange={(value) => updateFormData({ employmentType: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
                <SelectItem value="temporary">Temporary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Entitlement unit</Label>
            <Select value={formData.entitlementUnit} onValueChange={(value) => updateFormData({ entitlementUnit: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Contract start date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.leaveContractStartDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.leaveContractStartDate ? format(formData.leaveContractStartDate, "PPP") : <span>dd MMM yyyy</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.leaveContractStartDate}
                  onSelect={(date) => updateFormData({ leaveContractStartDate: date })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workingTimePattern">Working time pattern</Label>
            <Input
              id="workingTimePattern"
              value={formData.workingTimePattern}
              onChange={(e) => updateFormData({ workingTimePattern: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractedHours">Contracted hours</Label>
            <Input
              id="contractedHours"
              type="number"
              value={formData.contractedHours}
              onChange={(e) => updateFormData({ contractedHours: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="annualLeaveYearStart">Annual leave year start</Label>
            <Input
              id="annualLeaveYearStart"
              value={formData.annualLeaveYearStart}
              onChange={(e) => updateFormData({ annualLeaveYearStart: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="minLeaveEntitlement">Min. leave entitlement</Label>
            <Input
              id="minLeaveEntitlement"
              type="number"
              value={formData.minLeaveEntitlement}
              onChange={(e) => updateFormData({ minLeaveEntitlement: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="placeOfWork">Place of work</Label>
            <Input
              id="placeOfWork"
              placeholder="Working location"
              value={formData.placeOfWork}
              onChange={(e) => updateFormData({ placeOfWork: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Public holidays</h3>
        <div className="space-y-2">
          <Label>Public holidays for (Deducted from entitlement)</Label>
          <Select value={formData.publicHolidays} onValueChange={(value) => updateFormData({ publicHolidays: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="England & Wales">England & Wales</SelectItem>
              <SelectItem value="Scotland">Scotland</SelectItem>
              <SelectItem value="Northern Ireland">Northern Ireland</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Role information</h3>
        <p className="text-sm text-muted-foreground mb-4">Job title, probation and notice period</p>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="contractType">Contract type</Label>
            <Input
              id="contractType"
              value={formData.contractType}
              onChange={(e) => updateFormData({ contractType: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team">Team(s)</Label>
            <Input
              id="team"
              placeholder="No team"
              value={formData.team}
              onChange={(e) => updateFormData({ team: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reportsTo">Reports to</Label>
            <Input
              id="reportsTo"
              placeholder="No managers"
              value={formData.reportsTo}
              onChange={(e) => updateFormData({ reportsTo: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="noticePeriod">Notice period</Label>
            <Input
              id="noticePeriod"
              placeholder="e.g., 1 month"
              value={formData.noticePeriod}
              onChange={(e) => updateFormData({ noticePeriod: e.target.value })}
            />
          </div>

          <div className="col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Probation required</Label>
                <p className="text-sm text-muted-foreground">Usually 6 months</p>
              </div>
              <Switch
                checked={formData.probationRequired}
                onCheckedChange={(checked) => updateFormData({ probationRequired: checked })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
