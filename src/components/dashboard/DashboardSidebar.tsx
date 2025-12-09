import { NavLink } from 'react-router-dom';
import { 
  Home, Users, FileText, Clock, Calendar, 
  MapPin, DollarSign, TrendingUp,
  CalendarDays, GraduationCap, ChevronLeft, ChevronRight, LogOut, LayoutDashboard, Settings,
  User, Briefcase
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import nizaCloudLogo from '@/assets/niza-cloud-logo.png';

const getMenuItems = (role: string) => {
  // Employee gets restricted view
  if (role === 'employee') {
    return [
      { title: 'My Dashboard', icon: Home, path: '/dashboard' },
      { title: 'My Profile', icon: User, path: '/dashboard/my-profile' },
      { title: 'Clock In/Out', icon: MapPin, path: '/dashboard/clock-ins' },
      { title: 'My Schedule', icon: Calendar, path: '/dashboard/scheduling' },
      { title: 'My Attendance', icon: Clock, path: '/dashboard/attendance' },
      { title: 'My Documents', icon: FileText, path: '/dashboard/documents' },
      { title: 'My Leave', icon: Briefcase, path: '/dashboard/my-leave' },
      { title: 'Pay Slips', icon: DollarSign, path: '/dashboard/payroll' },
      { title: 'Training', icon: GraduationCap, path: '/dashboard/elearning' },
      { title: 'Events & News', icon: CalendarDays, path: '/dashboard/events' },
      { title: 'Performance', icon: TrendingUp, path: '/dashboard/performance' },
    ];
  }

  // Manager role - branch-restricted view
  if (role === 'manager') {
    return [
      { title: 'Home', icon: Home, path: '/dashboard' },
      { title: 'Overview', icon: LayoutDashboard, path: '/dashboard/overview' },
      { title: 'Employee Hub', icon: Users, path: '/dashboard/employees' },
      { title: 'Documents', icon: FileText, path: '/dashboard/documents' },
      { title: 'Scheduling', icon: Calendar, path: '/dashboard/scheduling' },
      { title: 'Clock-ins', icon: MapPin, path: '/dashboard/clock-ins' },
      { title: 'Attendance', icon: Clock, path: '/dashboard/attendance' },
      { title: 'Events & News', icon: CalendarDays, path: '/dashboard/events' },
      { title: 'Training', icon: GraduationCap, path: '/dashboard/elearning' },
      { title: 'Performance', icon: TrendingUp, path: '/dashboard/performance' },
    ];
  }

  // super_admin, hr, and other roles - full access
  const items = [
    { title: 'Home', icon: Home, path: '/dashboard' },
    { title: 'Overview', icon: LayoutDashboard, path: '/dashboard/overview' },
    { title: 'Employee Hub', icon: Users, path: '/dashboard/employees' },
    { title: 'Documents', icon: FileText, path: '/dashboard/documents' },
    { title: 'Training', icon: GraduationCap, path: '/dashboard/elearning' },
    { title: 'Attendance', icon: Clock, path: '/dashboard/attendance' },
    { title: 'Scheduling', icon: Calendar, path: '/dashboard/scheduling' },
    { title: 'Clock-ins', icon: MapPin, path: '/dashboard/clock-ins' },
    { title: 'Events & News', icon: CalendarDays, path: '/dashboard/events' },
    { title: 'Payroll', icon: DollarSign, path: '/dashboard/payroll' },
    { title: 'Performance', icon: TrendingUp, path: '/dashboard/performance' },
  ];

  // Add Settings only for super_admin
  if (role === 'super_admin') {
    items.push({ title: 'Settings', icon: Settings, path: '/dashboard/settings' });
  }

  return items;
};

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function DashboardSidebar({ collapsed, onToggle }: DashboardSidebarProps) {
  const { user, logout } = useAuth();

  if (!user) return null;

  const menuItems = getMenuItems(user.role);

  return (
    <aside 
      className={`${collapsed ? 'w-16' : 'w-64'} transition-all duration-300 border-r border-primary/20 flex flex-col relative overflow-hidden`}
      style={{ background: 'var(--gradient-panel)' }}
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
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute -right-3 top-6 h-6 w-6 rounded-full bg-card border border-primary/20 shadow-lg hover:bg-primary hover:text-primary-foreground z-20"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      {/* Logo */}
      <div className="p-4 flex items-center justify-center border-b border-primary/20 relative z-10">
        <img src={nizaCloudLogo} alt="Niza Cloud" className={collapsed ? "h-8" : "h-10"} />
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
              <p className="text-xs text-muted-foreground truncate capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1 relative z-10">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
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
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-primary/20 relative z-10">
        <Button 
          variant="ghost" 
          className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start'} gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive`}
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="font-medium">Logout</span>}
        </Button>
      </div>
    </aside>
  );
}
