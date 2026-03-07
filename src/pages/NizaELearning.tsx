import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import NizaELearningSidebar from '@/components/elearning/ELearningSidebar';
import AppsDialog from '@/components/dashboard/AppsDialog';
import TaskReminderListener from '@/components/reminders/TaskReminderListener';
import AppRouteGuard from '@/components/shared/AppRouteGuard';

export default function NizaELearning() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <AppRouteGuard appKey="niza_elearning">
      <div className="min-h-screen flex w-full bg-background">
        <TaskReminderListener />
        <NizaELearningSidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 relative z-10">
            <AppsDialog />
          </header>

          <div className="flex-1 overflow-y-auto bg-background">
            <Outlet />
          </div>
        </main>
      </div>
    </AppRouteGuard>
  );
}
