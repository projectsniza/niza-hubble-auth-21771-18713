import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Grid3x3 } from 'lucide-react';
import NizaSafeSidebar from '@/components/dashboard/NizaSafeSidebar';
import nizaCloudLogo from '@/assets/niza-cloud-logo.png';

export default function NizaSafe() {
  const navigate = useNavigate();
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="hover:bg-primary/10"
            title="Back to Dashboard"
          >
            <Grid3x3 className="h-5 w-5" />
          </Button>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
