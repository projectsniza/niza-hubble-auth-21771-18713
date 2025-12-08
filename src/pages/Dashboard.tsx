import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import AppsDialog from '@/components/dashboard/AppsDialog';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-primary/20 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50" 
                style={{ background: 'var(--gradient-panel)' }}>
          <div className="flex items-center gap-4">
            <AppsDialog />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
