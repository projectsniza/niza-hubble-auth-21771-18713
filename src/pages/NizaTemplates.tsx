import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import NizaTemplatesSidebar from '@/components/templates/NizaTemplatesSidebar';
import AppsDialog from '@/components/dashboard/AppsDialog';

export default function NizaTemplates() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <NizaTemplatesSidebar 
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
  );
}
