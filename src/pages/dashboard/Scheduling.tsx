import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActiveRotas } from '@/components/scheduling/ActiveRotas';
import { OldRotas } from '@/components/scheduling/OldRotas';
import { ShiftsView } from '@/components/scheduling/ShiftsView';
import { CreateRota } from '@/components/scheduling/CreateRota';
import { RotaSettings } from '@/components/scheduling/RotaSettings';
import { Card } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export default function Scheduling() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('active-rotas');

  // Employee View - Read-only shifts
  if (user?.role === 'employee') {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Schedule</h1>
          <p className="text-muted-foreground">View your upcoming shifts and schedule</p>
        </div>

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No scheduled shifts</h3>
              <p className="text-muted-foreground">Your upcoming shifts will appear here</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Admin/HR/Manager View - Full access
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Rota & Shifts</h1>
        <p className="text-muted-foreground">
          Create, plan and manage rotas all in one place. Add multiple staff to shifts, edit ongoing shifts and get an up-to-date view of who's working when.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="active-rotas">Active rotas</TabsTrigger>
          <TabsTrigger value="old-rotas">Old rotas</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="create-rota">Create rota</TabsTrigger>
          <TabsTrigger value="rota-settings">Rota settings</TabsTrigger>
        </TabsList>

        <TabsContent value="active-rotas" className="mt-0">
          <ActiveRotas />
        </TabsContent>

        <TabsContent value="old-rotas" className="mt-0">
          <OldRotas />
        </TabsContent>

        <TabsContent value="shifts" className="mt-0">
          <ShiftsView />
        </TabsContent>

        <TabsContent value="create-rota" className="mt-0">
          <CreateRota />
        </TabsContent>

        <TabsContent value="rota-settings" className="mt-0">
          <RotaSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
