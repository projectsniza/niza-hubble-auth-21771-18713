import { EmployeeFormData } from '@/pages/dashboard/AddEmployee';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Printer, Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import nizaGroupLogo from '@/assets/niza-group-logo.png';

interface ContractStepProps {
  formData: EmployeeFormData;
  updateFormData: (updates: Partial<EmployeeFormData>) => void;
}

const ENTITY_OPTIONS = [
  { value: 'niza-superstores', label: 'Niza Superstores Eastbourne Ltd', regNumber: '10650399' },
  { value: 'niza-southwater', label: 'Niza Southwater Ltd', regNumber: '11199022' },
  { value: 'niza-forecourt', label: 'Niza Forecourt Ltd', regNumber: '09859890' },
  { value: 'niza-enterprises', label: 'Niza Enterprises Ltd', regNumber: '04914942' }
];

export default function ContractStep({ formData, updateFormData }: ContractStepProps) {
  const selectedEntity = ENTITY_OPTIONS.find(e => e.value === formData.entity);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTemplate = () => {
    const contractFile = `/contracts/${formData.entity}-contract.pdf`;
    window.open(contractFile, '_blank');
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold mb-2">Employment Contract</h2>
          <p className="text-muted-foreground">Edit the contract details and generate for signature</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDownloadTemplate} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print Contract
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="space-y-2">
          <Label>Select Entity</Label>
          <Select value={formData.entity} onValueChange={(value) => updateFormData({ entity: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_OPTIONS.map(entity => (
                <SelectItem key={entity.value} value={entity.value}>
                  {entity.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Contract Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.contractDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.contractDate ? format(formData.contractDate, "PPP") : <span>Select date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.contractDate}
                onSelect={(date) => updateFormData({ contractDate: date })}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="border rounded-lg p-8 space-y-6 bg-white print:shadow-none">
        <div className="flex items-center justify-between pb-4 border-b">
          <img src={nizaGroupLogo} alt="Niza Group" className="h-20" />
          <div className="text-right text-sm text-muted-foreground">
            <p>Registered Office: 15 The Gallop, Sutton, Surrey, SM2 5RU</p>
            <p>Company Number: {selectedEntity?.regNumber}</p>
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">CONTRACT OF EMPLOYMENT</h1>
          <p className="text-muted-foreground">
            This contract is made on{' '}
            <span className="font-medium text-foreground">
              {formData.contractDate ? format(formData.contractDate, "do MMMM yyyy") : '_______________________'}
            </span>
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">PARTIES</h2>
          <ol className="list-decimal ml-6 space-y-2">
            <li>
              <strong>{selectedEntity?.label}</strong> a company incorporated in England and Wales 
              (registered number {selectedEntity?.regNumber}) whose registered office is at 15 The Gallop, 
              Sutton, Surrey, SM2 5RU (the Employer); and
            </li>
            <li>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee Full Name</Label>
                    <Input
                      value={formData.contractEmployeeName}
                      onChange={(e) => updateFormData({ contractEmployeeName: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Employee Address</Label>
                    <Textarea
                      value={formData.contractEmployeeAddress}
                      onChange={(e) => updateFormData({ contractEmployeeAddress: e.target.value })}
                      placeholder="Enter full address"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </li>
          </ol>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">THE PARTIES AGREE:</h2>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">1. Appointment</h3>
            <ol className="list-decimal ml-6 space-y-2 text-sm">
              <li>The Employer will employ you on the terms and conditions set out in this contract.</li>
              <li>
                Your employment with the Employer under this contract will commence on{' '}
                <div className="inline-block w-48">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="link" className="p-0 h-auto font-normal">
                        {formData.contractStartDate ? format(formData.contractStartDate, "do MMMM yyyy") : '[Select Date]'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.contractStartDate}
                        onSelect={(date) => updateFormData({ contractStartDate: date })}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {' '}(The Commencement Date).
              </li>
              <li>Your period of continuous employment with the Employer commenced on the Commencement Date, 
                and no period of employment with any previous employer counts as part of your period of 
                continuous employment with the Employer.</li>
              <li>You warrant to the Employer that you have the unconditional right to work in the U.K. 
                Should this right be withdrawn, or should your status materially change, you agree to notify 
                the Employer immediately.</li>
              <li>Any misrepresentation of your employment status is a serious disciplinary offence which 
                may result in your dismissal.</li>
              <li>The first 6 months of your employment will be a probationary period (the Probationary Period), 
                during which the Employer will monitor your performance and conduct.</li>
            </ol>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">2. Duties</h3>
            <ol className="list-decimal ml-6 space-y-2 text-sm">
              <li>
                You will be employed as a{' '}
                <Input
                  className="inline-block w-64 h-8"
                  value={formData.contractJobTitle}
                  onChange={(e) => updateFormData({ contractJobTitle: e.target.value })}
                  placeholder="Job title"
                />
                {' '}or in such other capacity as the Employer may from time to time reasonably direct.
              </li>
              <li>In addition to your normal duties, you may be required to undertake alternative, 
                additional, or ancillary duties from time to time or to transfer to another part of 
                the business as the Employer may reasonably direct.</li>
              <li>Unless otherwise notified, you will report to the site manager (your Manager). 
                The Employer may from time to time change your Manager.</li>
            </ol>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">3. Hours of work</h3>
            <ol className="list-decimal ml-6 space-y-2 text-sm">
              <li>
                Your normal hours of work are{' '}
                <Input
                  className="inline-block w-20 h-8"
                  value={formData.contractHoursPerWeek}
                  onChange={(e) => updateFormData({ contractHoursPerWeek: e.target.value })}
                  placeholder="Hours"
                />
                {' '}hours per week.
              </li>
              <li>The Employer may vary your hours of work or the pattern of your normal hours, 
                as it considers necessary to meet the needs of the business.</li>
              <li>You are required to work such additional hours as are deemed necessary by the Employer 
                for the proper performance of your duties.</li>
            </ol>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">4. Salary</h3>
            <ol className="list-decimal ml-6 space-y-2 text-sm">
              <li>
                The Employer will pay you a salary at the rate of £
                <Input
                  className="inline-block w-24 h-8"
                  value={formData.contractSalaryPerHour}
                  onChange={(e) => updateFormData({ contractSalaryPerHour: e.target.value })}
                  placeholder="Amount"
                />
                {' '}per hour (Salary).
              </li>
              <li>All payments of Salary are subject to deductions for income tax and national insurance 
                contributions and other authorised deductions or deductions required by law.</li>
              <li>The Employer will pay your Salary monthly in arrears by bank credit transfer.</li>
            </ol>
          </div>

          <div className="pt-12 mt-12 border-t space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <p className="text-sm font-medium">Signed by the Employee:</p>
                <div className="border-b-2 border-muted-foreground/30 h-12"></div>
                <p className="text-sm text-muted-foreground">Signature</p>
                <div className="border-b-2 border-muted-foreground/30 h-8"></div>
                <p className="text-sm text-muted-foreground">Date</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Signed by the Employer:</p>
                <div className="border-b-2 border-muted-foreground/30 h-12"></div>
                <p className="text-sm text-muted-foreground">Signature</p>
                <div className="border-b-2 border-muted-foreground/30 h-8"></div>
                <p className="text-sm text-muted-foreground">Date</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
