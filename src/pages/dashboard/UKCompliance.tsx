import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GDPRSettings } from '@/components/uk-compliance/GDPRSettings';
import { BradfordFactor } from '@/components/uk-compliance/BradfordFactor';
import { Shield, Calculator } from 'lucide-react';

export default function UKCompliance() {
  const [activeTab, setActiveTab] = useState('gdpr');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">UK Compliance</h1>
        <p className="text-muted-foreground">GDPR & Absence Management</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gdpr" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">GDPR</span>
          </TabsTrigger>
          <TabsTrigger value="bradford" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Bradford Factor</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gdpr" className="mt-6">
          <GDPRSettings />
        </TabsContent>

        <TabsContent value="bradford" className="mt-6">
          <BradfordFactor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
