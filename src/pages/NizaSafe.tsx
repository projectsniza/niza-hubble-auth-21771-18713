import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import NizaSafeSidebar from '@/components/dashboard/NizaSafeSidebar';
import AppsDialog from '@/components/dashboard/AppsDialog';

export default function NizaSafe() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <NizaSafeSidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 relative z-10">
          <AppsDialog />
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
