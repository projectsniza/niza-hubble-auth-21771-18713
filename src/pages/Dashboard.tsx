import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import AppsDialog from '@/components/dashboard/AppsDialog';
import TaskReminderListener from '@/components/reminders/TaskReminderListener';
import ReminderDuePopup from '@/components/reminders/ReminderDuePopup';
import RemindersSidebar from '@/components/reminders/RemindersSidebar';
import TodayEventsPopup from '@/components/dashboard/TodayEventsPopup';
import NotificationBell from '@/components/notifications/NotificationBell';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, CheckSquare } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { NizaLoaderFullPage } from '@/components/ui/niza-loader';

export default function Dashboard() {
  const { user, isLoading } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [remindersSidebarOpen, setRemindersSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  if (isLoading) {
    return <NizaLoaderFullPage />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <TaskReminderListener />
      <ReminderDuePopup />
      <TodayEventsPopup />
      {/* Desktop Sidebar */}
      {!isMobile && (
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Mobile Sidebar Sheet */}
      {isMobile && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-[280px] flex flex-col h-full">
            <DashboardSidebar
              collapsed={false}
              onToggle={() => setMobileMenuOpen(false)}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        <header
          className="h-14 border-b border-primary/20 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 sticky top-0 z-50"
          style={{ background: 'var(--gradient-panel)' }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <AppsDialog />
          </div>

          {/* Notification Bell and Reminders Button */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRemindersSidebarOpen(true)}
              className="relative"
              title="My Reminders"
            >
              <CheckSquare className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Reminders Sidebar */}
        <RemindersSidebar
          open={remindersSidebarOpen}
          onClose={() => setRemindersSidebarOpen(false)}
        />

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
