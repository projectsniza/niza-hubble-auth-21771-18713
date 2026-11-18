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
import OpenItemsHeaderWidget from '@/components/dashboard/OpenItemsHeaderWidget';
import ActionItemsHeaderWidget from '@/components/dashboard/ActionItemsHeaderWidget';
import ActionRequiredPopup from '@/components/messaging/ActionRequiredPopup';
import ContractWorkflowPopup from '@/components/onboarding/ContractWorkflowPopup';
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
    <div className="min-h-screen flex w-full niza-canvas relative">
      {/* Living aurora backdrop */}
      <div aria-hidden="true" className="pointer-events-none">
        <div className="niza-blob" style={{ width: 520, height: 520, left: '-8%', top: '-10%', background: 'rgba(52,199,140,0.35)' }} />
        <div className="niza-blob" style={{ width: 460, height: 460, right: '-6%', top: '6%', background: 'rgba(252,211,77,0.30)', animationDelay: '-8s' }} />
        <div className="niza-blob" style={{ width: 560, height: 560, left: '38%', bottom: '-22%', background: 'rgba(110,231,183,0.32)', animationDelay: '-15s' }} />
      </div>
      <TaskReminderListener />
      {(user?.role === 'super_admin' || user?.role === 'hr') && <ReminderDuePopup />}
      <ActionRequiredPopup />
      <TodayEventsPopup />
      <ContractWorkflowPopup />
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

      <main className="relative z-10 flex-1 min-w-0 flex flex-col overflow-clip md:m-3 md:rounded-[28px] niza-panel">
        <header
          className="h-16 border-b border-white/70 bg-white/55 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 sticky top-0 z-50"
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

          {/* Open Items Widget, Notification Bell and Reminders Button */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {(user?.role === 'super_admin' || user?.role === 'hr') && <OpenItemsHeaderWidget />}
            <ActionItemsHeaderWidget />
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
