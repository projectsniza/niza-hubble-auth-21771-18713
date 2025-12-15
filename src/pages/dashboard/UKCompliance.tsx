import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GDPRSettings } from '@/components/uk-compliance/GDPRSettings';
import { UKPayrollSettings } from '@/components/uk-compliance/UKPayrollSettings';
import { StatutoryLeave } from '@/components/uk-compliance/StatutoryLeave';
import { BradfordFactor } from '@/components/uk-compliance/BradfordFactor';
import { Shield, PoundSterling, Baby, Calculator } from 'lucide-react';

export default function UKCompliance() {
  const [activeTab, setActiveTab] = useState('gdpr');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">UK Compliance</h1>
        <p className="text-muted-foreground">GDPR, UK Payroll, Statutory Leave & Absence Management</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="gdpr" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">GDPR</span>
          </TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-2">
            <PoundSterling className="h-4 w-4" />
            <span className="hidden sm:inline">UK Payroll</span>
          </TabsTrigger>
          <TabsTrigger value="statutory" className="flex items-center gap-2">
            <Baby className="h-4 w-4" />
            <span className="hidden sm:inline">Statutory Leave</span>
          </TabsTrigger>
          <TabsTrigger value="bradford" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Bradford</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gdpr" className="mt-6">
          <GDPRSettings />
        </TabsContent>

        <TabsContent value="payroll" className="mt-6">
          <UKPayrollSettings />
        </TabsContent>

        <TabsContent value="statutory" className="mt-6">
          <StatutoryLeave />
        </TabsContent>

        <TabsContent value="bradford" className="mt-6">
          <BradfordFactor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
