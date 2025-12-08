import { EmployeeFormData } from '@/pages/dashboard/AddEmployee';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface BasicDetailsStepProps {
  formData: EmployeeFormData;
  updateFormData: (updates: Partial<EmployeeFormData>) => void;
}

export default function BasicDetailsStep({ formData, updateFormData }: BasicDetailsStepProps) {
  const addEmergencyContact = () => {
    updateFormData({
      emergencyContact: { name: '', phone: '', relationship: '' }
    });
  };

  const removeEmergencyContact = () => {
    updateFormData({ emergencyContact: null });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-6">Basic Details</h2>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Select value={formData.title} onValueChange={(value) => updateFormData({ title: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select Title" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mr">Mr</SelectItem>
                <SelectItem value="mrs">Mrs</SelectItem>
                <SelectItem value="miss">Miss</SelectItem>
                <SelectItem value="ms">Ms</SelectItem>
                <SelectItem value="dr">Dr</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="firstName">First name *</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => updateFormData({ firstName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="middleName">Middle name</Label>
            <Input
              id="middleName"
              value={formData.middleName}
              onChange={(e) => updateFormData({ middleName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Last name *</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => updateFormData({ lastName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={formData.gender} onValueChange={(value) => updateFormData({ gender: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unspecified">Unspecified</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ethnicity</Label>
            <Select value={formData.ethnicity} onValueChange={(value) => updateFormData({ ethnicity: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unspecified">Unspecified</SelectItem>
                <SelectItem value="white">White</SelectItem>
                <SelectItem value="asian">Asian</SelectItem>
                <SelectItem value="black">Black</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date of birth</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.dateOfBirth && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.dateOfBirth ? format(formData.dateOfBirth, "PPP") : <span>dd/mm/yyyy</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.dateOfBirth}
                  onSelect={(date) => updateFormData({ dateOfBirth: date })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateFormData({ email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile number</Label>
            <Input
              id="mobile"
              value={formData.mobile}
              onChange={(e) => updateFormData({ mobile: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workPhone">Work phone</Label>
            <Input
              id="workPhone"
              value={formData.workPhone}
              onChange={(e) => updateFormData({ workPhone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job title</Label>
            <Input
              id="jobTitle"
              value={formData.jobTitle}
              onChange={(e) => updateFormData({ jobTitle: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Employment start date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.employmentStartDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.employmentStartDate ? format(formData.employmentStartDate, "PPP") : <span>dd/mm/yyyy</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.employmentStartDate}
                  onSelect={(date) => updateFormData({ employmentStartDate: date })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Probation end date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.probationEndDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.probationEndDate ? format(formData.probationEndDate, "PPP") : <span>dd/mm/yyyy</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.probationEndDate}
                  onSelect={(date) => updateFormData({ probationEndDate: date })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Address details</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="address1">Address 1</Label>
            <Input
              id="address1"
              value={formData.address1}
              onChange={(e) => updateFormData({ address1: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address2">Address 2</Label>
            <Input
              id="address2"
              value={formData.address2}
              onChange={(e) => updateFormData({ address2: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address3">Address 3</Label>
            <Input
              id="address3"
              value={formData.address3}
              onChange={(e) => updateFormData({ address3: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="townCity">Town/City</Label>
            <Input
              id="townCity"
              value={formData.townCity}
              onChange={(e) => updateFormData({ townCity: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="county">County</Label>
            <Input
              id="county"
              value={formData.county}
              onChange={(e) => updateFormData({ county: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postcode">Postcode</Label>
            <Input
              id="postcode"
              value={formData.postcode}
              onChange={(e) => updateFormData({ postcode: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Emergency contact</h3>
        {!formData.emergencyContact ? (
          <Button variant="outline" onClick={addEmergencyContact}>
            <Plus className="h-4 w-4 mr-2" />
            Add Emergency Contact
          </Button>
        ) : (
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Emergency Contact Details</h4>
              <Button variant="ghost" size="icon" onClick={removeEmergencyContact}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.emergencyContact.name}
                  onChange={(e) => updateFormData({
                    emergencyContact: { ...formData.emergencyContact!, name: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.emergencyContact.phone}
                  onChange={(e) => updateFormData({
                    emergencyContact: { ...formData.emergencyContact!, phone: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Relationship</Label>
                <Input
                  value={formData.emergencyContact.relationship}
                  onChange={(e) => updateFormData({
                    emergencyContact: { ...formData.emergencyContact!, relationship: e.target.value }
                  })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Bank details</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="bankAccountName">Name on account</Label>
            <Input
              id="bankAccountName"
              placeholder="Account name"
              value={formData.bankAccountName}
              onChange={(e) => updateFormData({ bankAccountName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bankName">Name of bank</Label>
            <Input
              id="bankName"
              placeholder="Bank name"
              value={formData.bankName}
              onChange={(e) => updateFormData({ bankName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bankBranch">Bank branch</Label>
            <Input
              id="bankBranch"
              placeholder="Bank branch location"
              value={formData.bankBranch}
              onChange={(e) => updateFormData({ bankBranch: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account number</Label>
            <Input
              id="accountNumber"
              placeholder="8 digit number"
              value={formData.accountNumber}
              onChange={(e) => updateFormData({ accountNumber: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sortCode">Sort code</Label>
            <Input
              id="sortCode"
              placeholder="00-00-00"
              value={formData.sortCode}
              onChange={(e) => updateFormData({ sortCode: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Salary details</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="salary">Salary</Label>
            <Input
              id="salary"
              type="number"
              value={formData.salary}
              onChange={(e) => updateFormData({ salary: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Rate</Label>
            <Select value={formData.salaryRate} onValueChange={(value) => updateFormData({ salaryRate: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select rate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Payment frequency</Label>
            <Select value={formData.paymentFrequency} onValueChange={(value) => updateFormData({ paymentFrequency: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="fortnightly">Fortnightly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Effective from</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.effectiveFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.effectiveFrom ? format(formData.effectiveFrom, "PPP") : <span>dd/mm/yyyy</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.effectiveFrom}
                  onSelect={(date) => updateFormData({ effectiveFrom: date })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={formData.reason} onValueChange={(value) => updateFormData({ reason: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_starter">New Starter</SelectItem>
                <SelectItem value="promotion">Promotion</SelectItem>
                <SelectItem value="annual_review">Annual Review</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payrollNumber">Payroll number</Label>
            <Input
              id="payrollNumber"
              placeholder="ABC123"
              value={formData.payrollNumber}
              onChange={(e) => updateFormData({ payrollNumber: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Sensitive details</h3>
        <p className="text-sm text-muted-foreground mb-4">Tax, NI and eligibility information</p>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="taxCode">Tax code</Label>
            <Input
              id="taxCode"
              value={formData.taxCode}
              onChange={(e) => updateFormData({ taxCode: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="niNumber">NI number</Label>
            <Input
              id="niNumber"
              value={formData.niNumber}
              onChange={(e) => updateFormData({ niNumber: e.target.value })}
            />
          </div>

          <div className="col-span-2">
            <h4 className="font-medium mb-3">Passport</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="passportNumber">Passport number</Label>
                <Input
                  id="passportNumber"
                  value={formData.passportNumber}
                  onChange={(e) => updateFormData({ passportNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportCountry">Country of issue</Label>
                <Input
                  id="passportCountry"
                  value={formData.passportCountry}
                  onChange={(e) => updateFormData({ passportCountry: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Passport expiry date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.passportExpiry && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.passportExpiry ? format(formData.passportExpiry, "PPP") : <span>dd/mm/yyyy</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.passportExpiry}
                      onSelect={(date) => updateFormData({ passportExpiry: date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <h4 className="font-medium mb-3">Driving licence</h4>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="licenceNumber">Licence number</Label>
                <Input
                  id="licenceNumber"
                  value={formData.licenceNumber}
                  onChange={(e) => updateFormData({ licenceNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenceCountry">Country of issue</Label>
                <Input
                  id="licenceCountry"
                  value={formData.licenceCountry}
                  onChange={(e) => updateFormData({ licenceCountry: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenceClass">Licence class</Label>
                <Input
                  id="licenceClass"
                  value={formData.licenceClass}
                  onChange={(e) => updateFormData({ licenceClass: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date of expiry</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.licenceExpiry && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.licenceExpiry ? format(formData.licenceExpiry, "PPP") : <span>dd/mm/yyyy</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.licenceExpiry}
                      onSelect={(date) => updateFormData({ licenceExpiry: date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <h4 className="font-medium mb-3">Visa</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="visaNumber">Visa number</Label>
                <Input
                  id="visaNumber"
                  value={formData.visaNumber}
                  onChange={(e) => updateFormData({ visaNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Visa expiry date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.visaExpiry && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.visaExpiry ? format(formData.visaExpiry, "PPP") : <span>dd/mm/yyyy</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.visaExpiry}
                      onSelect={(date) => updateFormData({ visaExpiry: date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
