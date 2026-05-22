import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShopTargetHoursReport } from './ShopTargetHoursReport';
import { AbnormalBehaviourReport } from './AbnormalBehaviourReport';
import { StaffListLive } from './StaffListLive';

export function SchedulingReports() {
  const [tab, setTab] = useState<'shop' | 'abnormal' | 'staff'>('shop');
  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="shop" className="flex-1 min-w-[120px] text-xs md:text-sm">Shop Target Hours</TabsTrigger>
          <TabsTrigger value="abnormal" className="flex-1 min-w-[120px] text-xs md:text-sm">Abnormal Behaviour</TabsTrigger>
          <TabsTrigger value="staff" className="flex-1 min-w-[120px] text-xs md:text-sm">Staff List (Live)</TabsTrigger>
        </TabsList>
        <TabsContent value="shop" className="mt-0"><ShopTargetHoursReport /></TabsContent>
        <TabsContent value="abnormal" className="mt-0"><AbnormalBehaviourReport /></TabsContent>
        <TabsContent value="staff" className="mt-0"><StaffListLive /></TabsContent>
      </Tabs>
    </div>
  );
}
