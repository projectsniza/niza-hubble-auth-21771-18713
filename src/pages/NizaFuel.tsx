import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import NizaFuelSidebar from '@/components/dashboard/NizaFuelSidebar';
import AppsDialog from '@/components/dashboard/AppsDialog';
import AppRouteGuard from '@/components/shared/AppRouteGuard';
import RouteErrorBoundary from '@/components/shared/RouteErrorBoundary';

function FuelShell() {
  const [collapsed, setCollapsed] = useState(false);
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

/**
 * Niza Fuel: UK fuel prices, saved locations and live charts.
 * Super Admin always; any other login only when a Super Admin switched "Niza Fuel" on in its custom role.
 */
export default function NizaFuel() {
  return (
    <AppRouteGuard appKey="niza_fuel">
      <FuelShell />
    </AppRouteGuard>
  );
}
