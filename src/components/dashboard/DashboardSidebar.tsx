import { NavLink } from 'react-router-dom';
import { 
  Home, Users, FileText, Clock, Calendar, 
  MapPin, DollarSign, TrendingUp,
  CalendarDays, GraduationCap, LogOut, LayoutDashboard, Settings,
  User, Wrench, ClipboardList, Shield, ClipboardCheck, MessageSquare, Ticket, CheckSquare, Car, Wallet, Menu
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import nizaCloudLogo from '@/assets/niza-cloud-logo.png';
import nizaGroupIcon from '@/assets/niza-group-icon.png';
import { useNotificationCounts } from '@/hooks/useNotificationCounts';
import { useCustomRoleAccess } from '@/hooks/useCustomRoleAccess';

// Map sidebar paths to permission keys
const pathToPermissionKey: Record<string, string> = {
  '/dashboard/employees': 'employee_management',
  '/dashboard/documents': 'documents',
  '/dashboard/documents/submit': 'documents',
  '/dashboard/drive-offs': 'drive_offs',
  '/dashboard/lottery': 'lottery',
  '/dashboard/daily-reports': 'daily_reports',
  '/dashboard/maintenance': 'maintenance',
  '/dashboard/elearning': 'training',
  '/dashboard/attendance': 'attendance',
  '/dashboard/scheduling': 'scheduling',
  '/dashboard/clock-ins': 'clock_ins',
  '/dashboard/events': 'events',
  '/dashboard/payroll': 'payroll',
  '/dashboard/performance': 'performance',
  '/dashboard/uk-compliance': 'uk_compliance',
  '/dashboard/messages': 'messages',
  '/dashboard/reminders': 'reminders',
  '/dashboard/settings': 'settings',
  '/dashboard/safety-tasks': 'safety',
  '/dashboard/store-templates': 'templates',
  '/dashboard/customer-accounts': 'customer_accounts',
};

const getMenuItems = (role: string) => {
  // Employee gets restricted view
  if (role === 'employee') {
    return [
      { title: 'My Dashboard', icon: Home, path: '/dashboard' },
      { title: 'My Profile', icon: User, path: '/dashboard/my-profile' },
      { title: 'Messages', icon: MessageSquare, path: '/dashboard/messages' },
      { title: 'Reminders', icon: CheckSquare, path: '/dashboard/reminders' },
      { title: 'Clock In/Out', icon: MapPin, path: '/dashboard/clock-ins' },
      { title: 'My Schedule', icon: Calendar, path: '/dashboard/scheduling' },
      { title: 'Attendance & Leave', icon: Clock, path: '/dashboard/attendance' },
      { title: 'Safety', icon: Shield, path: '/dashboard/safety-tasks' },
      { title: 'Pay Slips', icon: DollarSign, path: '/dashboard/payroll' },
      { title: 'Training', icon: GraduationCap, path: '/dashboard/elearning' },
      { title: 'Events & News', icon: CalendarDays, path: '/dashboard/events' },
      { title: 'Performance', icon: TrendingUp, path: '/dashboard/performance' },
      { title: 'Settings', icon: Settings, path: '/dashboard/settings' },
    ];
  }

  // Store Account role - branch-restricted view
  if (role === 'manager') {
    return [
      { title: 'Home', icon: Home, path: '/dashboard' },
      { title: 'Overview', icon: LayoutDashboard, path: '/dashboard/overview' },
      { title: 'Messages', icon: MessageSquare, path: '/dashboard/messages' },
      { title: 'Reminders', icon: CheckSquare, path: '/dashboard/reminders' },
      { title: 'Employee Hub', icon: Users, path: '/dashboard/employees' },
      { title: 'Submit Documents', icon: FileText, path: '/dashboard/documents/submit' },
      { title: 'Drive-Offs', icon: Car, path: '/dashboard/drive-offs' },
      { title: 'Lottery', icon: Ticket, path: '/dashboard/lottery' },
      { title: 'Daily Reports', icon: ClipboardList, path: '/dashboard/daily-reports' },
      { title: 'Maintenance', icon: Wrench, path: '/dashboard/maintenance' },
      { title: 'Safety', icon: Shield, path: '/dashboard/safety-tasks' },
      { title: 'Templates', icon: FileText, path: '/dashboard/store-templates' },
      { title: 'Scheduling', icon: Calendar, path: '/dashboard/scheduling' },
      { title: 'Clock-ins', icon: MapPin, path: '/dashboard/clock-ins' },
      { title: 'Attendance', icon: Clock, path: '/dashboard/attendance' },
      { title: 'Events & News', icon: CalendarDays, path: '/dashboard/events' },
      { title: 'Training', icon: GraduationCap, path: '/dashboard/elearning' },
      { title: 'Performance', icon: TrendingUp, path: '/dashboard/performance' },
      { title: 'Customer Accounts', icon: Wallet, path: '/dashboard/customer-accounts' },
      { title: 'Settings', icon: Settings, path: '/dashboard/settings' },
    ];
  }

  // HR role - same as super_admin except Contract Approvals
  if (role === 'hr') {
    return [
      { title: 'Home', icon: Home, path: '/dashboard' },
      { title: 'Overview', icon: LayoutDashboard, path: '/dashboard/overview' },
      { title: 'Messages', icon: MessageSquare, path: '/dashboard/messages' },
      { title: 'Reminders', icon: CheckSquare, path: '/dashboard/reminders' },
      { title: 'Employee Hub', icon: Users, path: '/dashboard/employees' },
      { title: 'Documents', icon: FileText, path: '/dashboard/documents' },
      { title: 'Submit Documents', icon: FileText, path: '/dashboard/documents/submit' },
      { title: 'Drive-Offs', icon: Car, path: '/dashboard/drive-offs' },
      { title: 'Lottery', icon: Ticket, path: '/dashboard/lottery' },
      { title: 'Daily Reports', icon: ClipboardList, path: '/dashboard/daily-reports' },
      { title: 'Maintenance', icon: Wrench, path: '/dashboard/maintenance' },
      { title: 'Training', icon: GraduationCap, path: '/dashboard/elearning' },
      { title: 'Attendance', icon: Clock, path: '/dashboard/attendance' },
      { title: 'Scheduling', icon: Calendar, path: '/dashboard/scheduling' },
      { title: 'Clock-ins', icon: MapPin, path: '/dashboard/clock-ins' },
      { title: 'Events & News', icon: CalendarDays, path: '/dashboard/events' },
      { title: 'Payroll', icon: DollarSign, path: '/dashboard/payroll' },
      { title: 'Performance', icon: TrendingUp, path: '/dashboard/performance' },
      { title: 'Customer Accounts', icon: Wallet, path: '/dashboard/customer-accounts' },
      { title: 'UK Compliance', icon: Shield, path: '/dashboard/uk-compliance' },
      { title: 'Settings', icon: Settings, path: '/dashboard/settings' },
    ];
  }

  // super_admin, hr, and other roles - full access
  const items = [
    { title: 'Home', icon: Home, path: '/dashboard' },
    { title: 'Overview', icon: LayoutDashboard, path: '/dashboard/overview' },
    { title: 'Messages', icon: MessageSquare, path: '/dashboard/messages' },
    { title: 'Reminders', icon: CheckSquare, path: '/dashboard/reminders' },
    { title: 'Employee Hub', icon: Users, path: '/dashboard/employees' },
    { title: 'Documents', icon: FileText, path: '/dashboard/documents' },
    { title: 'Drive-Offs', icon: Car, path: '/dashboard/drive-offs' },
    { title: 'Lottery', icon: Ticket, path: '/dashboard/lottery' },
    { title: 'Daily Reports', icon: ClipboardList, path: '/dashboard/daily-reports' },
    { title: 'Maintenance', icon: Wrench, path: '/dashboard/maintenance' },
    { title: 'Training', icon: GraduationCap, path: '/dashboard/elearning' },
    { title: 'Attendance', icon: Clock, path: '/dashboard/attendance' },
    { title: 'Scheduling', icon: Calendar, path: '/dashboard/scheduling' },
    { title: 'Clock-ins', icon: MapPin, path: '/dashboard/clock-ins' },
    { title: 'Events & News', icon: CalendarDays, path: '/dashboard/events' },
    { title: 'Payroll', icon: DollarSign, path: '/dashboard/payroll' },
    { title: 'Performance', icon: TrendingUp, path: '/dashboard/performance' },
    { title: 'Customer Accounts', icon: Wallet, path: '/dashboard/customer-accounts' },
    { title: 'UK Compliance', icon: Shield, path: '/dashboard/uk-compliance' },
  ];

  // Add Settings for super_admin and HR
  if (role === 'super_admin' || role === 'hr') {
    items.push({ title: 'Settings', icon: Settings, path: '/dashboard/settings' });
  }

  return items;
};

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export default function DashboardSidebar({ collapsed, onToggle, onNavigate }: DashboardSidebarProps) {
  const { user, logout } = useAuth();
  const { counts } = useNotificationCounts();
  const { customRole, hasPermission } = useCustomRoleAccess();

  if (!user) return null;

  const allMenuItems = getMenuItems(user.role);

  // Filter menu items based on custom role permissions
  // Super admins and HR always see everything; custom roles filter by permissions
  const menuItems = (user.role === 'super_admin' || user.role === 'hr')
    ? allMenuItems
    : allMenuItems.filter(item => {
        const permKey = pathToPermissionKey[item.path];
        // Items without a permission mapping are always shown (Home, Overview, My Profile)
        if (!permKey) return true;
        // If user has a custom role, check permissions
        if (customRole) return hasPermission(permKey);
        // No custom role = show all (default behavior)
        return true;
      });

  // Map paths to notification counts
  const getCountForPath = (path: string): number => {
    switch (path) {
      case '/dashboard/messages':
        return counts.messages;
      case '/dashboard/employees':
        return counts.employees;
      case '/dashboard/attendance':
        return counts.attendance;
      case '/dashboard/maintenance':
        return counts.maintenance;
      case '/dashboard/events':
        return counts.events;
      case '/dashboard/documents':
        return counts.documents;
      default:
        return 0;
    }
  };

  const handleNavClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <aside 
      className={`transition-all duration-300 border-r border-primary/20 flex flex-col relative overflow-hidden h-screen sticky top-0 flex-shrink-0`}
      style={{ background: 'var(--gradient-panel)', width: collapsed ? '80px' : '256px' }}
    >
      {/* Decorative SVG Background */}
      <svg className="absolute inset-0 w-full h-full opacity-5 z-0" viewBox="0 0 593 470" fill="none" preserveAspectRatio="xMidYMid slice">
        <path d="M8.44398 0.617329H592.052V469.547C592.052 48.6499 274.052 498.547 366.552 250.047C459.052 1.5472 419.436 102.82 419.436 102.82C419.436 102.82 343.17 209.048 201.552 208.547C124.426 208.274 104.783 140.619 188.052 102.82C319.337 43.2233 149.498 31.3712 120.052 23.0472C56.1705 4.98889 22.6081 1.25634 8.44398 0.617329H0.0516663C0.0516663 0.617329 2.59244 0.353338 8.44398 0.617329Z" fill="url(#paint0_linear)" stroke="hsl(var(--border))"/>
        <defs>
          <linearGradient id="paint0_linear" x1="592.659" y1="0.617318" x2="376.315" y2="504.04" gradientUnits="userSpaceOnUse">
            <stop offset="0.0734679" stopColor="hsl(var(--accent))"/>
            <stop offset="0.458691" stopColor="hsl(var(--primary))"/>
          </linearGradient>
        </defs>
      </svg>
      {/* Logo - Always big and unchanged regardless of collapse */}
      <div className="p-4 flex items-center justify-center relative z-10 min-h-[80px] overflow-visible" style={{ width: collapsed ? '80px' : '256px' }}>
        {collapsed ? (
          <img src={nizaGroupIcon} alt="Niza Group" className="h-12 w-auto object-contain" />
        ) : (
          <img src={nizaCloudLogo} alt="Niza Cloud" className="h-16 w-auto object-contain" />
        )}
      </div>

      {/* Hamburger Toggle - Gmail style */}
      <div className={`px-3 pb-2 relative z-10 ${collapsed ? 'flex justify-center' : ''}`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-10 w-10 rounded-full hover:bg-card/60 cursor-pointer hidden md:flex items-center justify-center"
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          <Menu className="h-5 w-5 text-foreground/70" />
        </Button>
      </div>

      {/* User Info */}
      {!collapsed && user && (
        <div className="p-4 border-b border-primary/20 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold shadow-lg">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{user.role === 'manager' ? 'Store Account' : user.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1 relative z-10">
        {menuItems.map((item) => {
          const notifCount = getCountForPath(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              onClick={handleNavClick}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25'
                  : 'text-foreground/70 hover:bg-card/50 hover:text-foreground'
                }
              `}
              title={collapsed ? item.title : undefined}
            >
              <div className="relative">
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {collapsed && notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </div>
              {!collapsed && (
                <>
                  <span className="text-sm font-medium flex-1">{item.title}</span>
                  {notifCount > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                      {notifCount > 99 ? '99+' : notifCount}
                    </Badge>
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {!collapsed && (
          <Button
            variant="ghost"
            className="w-full gap-3 justify-start text-destructive hover:bg-destructive/10 hover:text-destructive md:hidden mt-2"
            onClick={async () => {
              await logout();
              handleNavClick();
            }}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium">Logout</span>
          </Button>
        )}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-primary/20 relative z-10 hidden md:block">
        <Button
          variant="ghost"
          className={`w-full gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive ${collapsed ? 'justify-center px-0' : 'justify-start'}`}
          onClick={logout}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="font-medium">Logout</span>}
        </Button>
      </div>
    </aside>
  );
}
