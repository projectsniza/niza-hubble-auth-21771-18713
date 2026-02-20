import { Link } from 'react-router-dom';
import { 
  Home, Users, FileText, Clock, Calendar, 
  MapPin, DollarSign, TrendingUp,
  CalendarDays, GraduationCap, LucideIcon, ArrowRight, Settings, ClipboardList, Wrench, MessageSquare,
  CheckSquare, Car, Ticket
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomRoleAccess } from '@/hooks/useCustomRoleAccess';

// Map grid paths to permission keys
const pathToPermissionKey: Record<string, string> = {
  '/dashboard/employees': 'employee_management',
  '/dashboard/documents': 'documents',
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
  '/dashboard/messages': 'messages',
  '/dashboard/reminders': 'reminders',
  '/dashboard/settings': 'settings',
};

interface GridItem {
  title: string;
  icon: LucideIcon;
  path: string;
  gradient: string;
}

const gridItems: GridItem[] = [
  { title: 'Overview', icon: Home, path: '/dashboard/overview', gradient: 'from-primary to-accent' },
  { title: 'Employee Hub', icon: Users, path: '/dashboard/employees', gradient: 'from-accent to-primary' },
  { title: 'Documents', icon: FileText, path: '/dashboard/documents', gradient: 'from-primary to-accent' },
  { title: 'Messages', icon: MessageSquare, path: '/dashboard/messages', gradient: 'from-accent to-primary' },
  { title: 'Reminders', icon: CheckSquare, path: '/dashboard/reminders', gradient: 'from-primary to-accent' },
  { title: 'Drive-Offs', icon: Car, path: '/dashboard/drive-offs', gradient: 'from-accent to-primary' },
  { title: 'Lottery', icon: Ticket, path: '/dashboard/lottery', gradient: 'from-primary to-accent' },
  { title: 'Training', icon: GraduationCap, path: '/dashboard/elearning', gradient: 'from-accent to-primary' },
  { title: 'Daily Reports', icon: ClipboardList, path: '/dashboard/daily-reports', gradient: 'from-primary to-accent' },
  { title: 'Maintenance', icon: Wrench, path: '/dashboard/maintenance', gradient: 'from-accent to-primary' },
  { title: 'Attendance', icon: Clock, path: '/dashboard/attendance', gradient: 'from-primary to-accent' },
  { title: 'Scheduling', icon: Calendar, path: '/dashboard/scheduling', gradient: 'from-accent to-primary' },
  { title: 'Clock-ins', icon: MapPin, path: '/dashboard/clock-ins', gradient: 'from-primary to-accent' },
  { title: 'Events & News', icon: CalendarDays, path: '/dashboard/events', gradient: 'from-accent to-primary' },
  { title: 'Payroll', icon: DollarSign, path: '/dashboard/payroll', gradient: 'from-primary to-accent' },
  { title: 'Performance', icon: TrendingUp, path: '/dashboard/performance', gradient: 'from-accent to-primary' },
];

export default function DashboardGrid() {
  const { user } = useAuth();
  const { customRole, hasPermission } = useCustomRoleAccess();
  
  // Add Settings card for super_admin and HR
  const allItems = (user?.role === 'super_admin' || user?.role === 'hr')
    ? [...gridItems, { title: 'Settings', icon: Settings, path: '/dashboard/settings', gradient: 'from-primary to-accent' }]
    : gridItems;

  // Filter based on custom role permissions
  const displayItems = (user?.role === 'super_admin' || user?.role === 'hr')
    ? allItems
    : allItems.filter(item => {
        const permKey = pathToPermissionKey[item.path];
        if (!permKey) return true;
        if (customRole) return hasPermission(permKey);
        return true;
      });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto relative overflow-hidden" style={{ background: 'var(--gradient-panel)' }}>
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

      <div className="mb-6 md:mb-8 relative z-10">
        <h2 className="text-2xl md:text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Dashboard</h2>
        <p className="text-sm md:text-base text-muted-foreground">Select a module to get started</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 relative z-10">
        {displayItems.map((item) => (
          <Link key={item.path} to={item.path} className="group">
            <Card className="relative h-32 md:h-48 overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 md:hover:-translate-y-2">
              {/* Gradient Overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              
              {/* Content */}
              <div className="relative h-full flex flex-col items-center justify-center p-3 md:p-6 text-center">
                {/* Icon Container */}
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-2 md:mb-4 group-hover:scale-110 transition-all duration-300 shadow-lg`}>
                  <item.icon className="h-6 w-6 md:h-8 md:w-8 text-white" />
                </div>
                
                {/* Title */}
                <h3 className="font-semibold md:font-bold text-sm md:text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {item.title}
                </h3>
                
                {/* Arrow Icon - Hidden on mobile */}
                <div className="absolute bottom-3 md:bottom-4 right-3 md:right-4 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
                  <ArrowRight className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
              </div>
              
              {/* Shine Effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
