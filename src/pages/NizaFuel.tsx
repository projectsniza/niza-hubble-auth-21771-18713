import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import NizaFuelSidebar from '@/components/dashboard/NizaFuelSidebar';
import AppsDialog from '@/components/dashboard/AppsDialog';
import { NizaLoaderFullPage } from '@/components/ui/niza-loader';
import RouteErrorBoundary from '@/components/shared/RouteErrorBoundary';

/** Niza Fuel: UK fuel prices. Super Admin only. */
export default function NizaFuel() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (user.role !== 'super_admin') navigate('/dashboard', { replace: true });
  }, [user, isLoading, navigate]);

  if (isLoading) return <NizaLoaderFullPage />;
  if (!user || user.role !== 'super_admin') return null;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <NizaFuelSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <AppsDialog />
        </header>
        <div className="flex-1 overflow-y-auto bg-background">
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </div>
      </main>
    </div>
  );
}
