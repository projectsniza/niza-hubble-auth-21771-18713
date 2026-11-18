import { Link } from 'react-router-dom';
import { 
  Home, Users, FileText, Clock, Calendar, 
  MapPin, DollarSign, TrendingUp,
  CalendarDays, GraduationCap, LucideIcon, ArrowRight, Settings, ClipboardList, Wrench, MessageSquare,
  CheckSquare, Car, Ticket, Wallet, BarChart3
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomRoleAccess } from '@/hooks/useCustomRoleAccess';
import { useNotificationCounts } from '@/hooks/useNotificationCounts';

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
  '/dashboard/customer-accounts': 'customer_accounts',
  '/dashboard/daily-summary': 'daily_summary',
};

// Map grid paths to notification count keys
const pathToCountKey: Record<string, string> = {
  '/dashboard/employees': 'employees',
  '/dashboard/messages': 'messages',
  '/dashboard/attendance': 'attendance',
  '/dashboard/maintenance': 'maintenance',
  '/dashboard/events': 'events',
  '/dashboard/documents': 'documents',
  '/dashboard/drive-offs': 'drive_offs',
  '/dashboard/reminders': 'reminders',
  '/dashboard/daily-reports': 'daily_reports',
  '/dashboard/performance': 'performance',
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
  { title: 'Sales Analysis', icon: BarChart3, path: '/dashboard/daily-summary', gradient: 'from-accent to-primary' },
  { title: 'Maintenance', icon: Wrench, path: '/dashboard/maintenance', gradient: 'from-accent to-primary' },
  { title: 'Holiday Diary', icon: Clock, path: '/dashboard/attendance', gradient: 'from-primary to-accent' },
  { title: 'Scheduling', icon: Calendar, path: '/dashboard/scheduling', gradient: 'from-accent to-primary' },
  { title: 'Clock-ins', icon: MapPin, path: '/dashboard/clock-ins', gradient: 'from-primary to-accent' },
  { title: 'Events & News', icon: CalendarDays, path: '/dashboard/events', gradient: 'from-accent to-primary' },
  { title: 'Payroll', icon: DollarSign, path: '/dashboard/payroll', gradient: 'from-primary to-accent' },
  { title: 'Performance', icon: TrendingUp, path: '/dashboard/performance', gradient: 'from-accent to-primary' },
  { title: 'Customer Accounts', icon: Wallet, path: '/dashboard/customer-accounts', gradient: 'from-primary to-accent' },
];

export default function DashboardGrid() {
  const { user } = useAuth();
  const { customRole, hasPermission } = useCustomRoleAccess();
  const { counts } = useNotificationCounts();
  
  // Add Settings card for super_admin and HR
  const allItems = (user?.role === 'super_admin' || user?.role === 'hr')
    ? [...gridItems, { title: 'Settings', icon: Settings, path: '/dashboard/settings', gradient: 'from-primary to-accent' }]
    : gridItems;

  // Filter based on custom role permissions
  // Super admins always see everything; HR with custom role gets filtered
  const displayItems = (user?.role === 'super_admin' || (user?.role === 'hr' && !customRole))
    ? allItems
    : allItems.filter(item => {
        const permKey = pathToPermissionKey[item.path];
        if (!permKey) return true;
        if (customRole) return hasPermission(permKey);
        return true;
      });

  const getCountForPath = (path: string): number => {
    const key = pathToCountKey[path];
    if (!key) return 0;
    return (counts as any)[key] || 0;
  };

  const TONES = [
    { box: 'from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200/80', art: '#34d399' },
    { box: 'from-teal-50 to-teal-100 text-teal-700 border-teal-200/80', art: '#2dd4bf' },
    { box: 'from-amber-50 to-orange-100 text-amber-700 border-amber-200/80', art: '#fbbf24' },
    { box: 'from-lime-50 to-lime-100 text-lime-700 border-lime-200/80', art: '#a3e635' },
  ];
  const firstName = (user?.name || '').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="relative max-w-[1400px] mx-auto px-5 py-8 md:px-10 md:py-10">
      {/* Hero */}
      <div className="relative mb-10 md:mb-12 min-h-[150px]">
        <div className="relative z-10 max-w-2xl niza-rise">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Dashboard
          </p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
            {greeting}{firstName ? `, ${firstName}` : ''} <span className="inline-block origin-[70%_70%] animate-[niza-pop_2.4s_ease-in-out_infinite]">👋</span>
          </h2>
          <p className="mt-3 text-base md:text-lg text-muted-foreground">
            Select a module to get started and manage your organization seamlessly.
          </p>
        </div>

        {/* Hero artwork: rolling hills, sun and rising bars */}
        <svg className="pointer-events-none absolute -top-6 right-0 hidden h-[210px] w-[460px] lg:block" viewBox="0 0 460 210" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gHillA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#bdf0d4" /><stop offset="1" stopColor="#34c48b" /></linearGradient>
            <linearGradient id="gHillB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e8f8c8" /><stop offset="1" stopColor="#8fd16a" /></linearGradient>
            <radialGradient id="gSun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fff3b8" /><stop offset="1" stopColor="#fcd34d" stopOpacity="0" /></radialGradient>
          </defs>
          <circle cx="360" cy="52" r="62" fill="url(#gSun)"><animate attributeName="r" values="56;70;56" dur="6s" repeatCount="indefinite" /></circle>
          <g opacity="0.95">
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={i} x={250 + i * 34} y={150 - (i + 1) * 20} width="20" rx="6" height={(i + 1) * 20 + 40} fill="url(#gHillA)" opacity={0.45 + i * 0.1}>
                <animate attributeName="height" values={`${(i + 1) * 20 + 40};${(i + 1) * 20 + 52};${(i + 1) * 20 + 40}`} dur={`${4 + i * 0.7}s`} repeatCount="indefinite" />
              </rect>
            ))}
          </g>
          <path d="M0 175 C 70 130, 140 140, 220 165 C 300 190, 380 120, 460 150 L 460 210 L 0 210 Z" fill="url(#gHillB)" opacity="0.85">
            <animate attributeName="d" dur="9s" repeatCount="indefinite" values="M0 175 C 70 130, 140 140, 220 165 C 300 190, 380 120, 460 150 L 460 210 L 0 210 Z;M0 165 C 70 150, 140 125, 220 150 C 300 178, 380 140, 460 138 L 460 210 L 0 210 Z;M0 175 C 70 130, 140 140, 220 165 C 300 190, 380 120, 460 150 L 460 210 L 0 210 Z" />
          </path>
          <path d="M0 192 C 90 160, 170 190, 250 178 C 330 166, 400 176, 460 168 L 460 210 L 0 210 Z" fill="url(#gHillA)" opacity="0.8" />
        </svg>
      </div>

      {/* Module tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
        {displayItems.map((item, i) => {
          const notifCount = getCountForPath(item.path);
          const tone = TONES[i % TONES.length];
          return (
            <Link key={item.path} to={item.path} className="group niza-rise" style={{ animationDelay: `${Math.min(i, 14) * 45}ms` }}>
              <div className="niza-tile h-36 md:h-40 p-5">
                {/* graphic */}
                <svg className="pointer-events-none absolute -bottom-1 -right-1 h-24 w-3/4 transition-transform duration-700 group-hover:scale-110 group-hover:-translate-x-1" viewBox="0 0 240 96" fill="none" aria-hidden="true">
                  <defs>
                    <linearGradient id={`tw${i}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor={tone.art} stopOpacity="0.05" />
                      <stop offset="1" stopColor={tone.art} stopOpacity="0.38" />
                    </linearGradient>
                  </defs>
                  <path d="M0 70 C 50 30, 110 90, 170 50 C 200 30, 225 36, 240 24 L 240 96 L 0 96 Z" fill={`url(#tw${i})`} />
                  <path d="M60 96 C 100 60, 150 80, 240 52 L 240 96 Z" fill={`url(#tw${i})`} opacity="0.7" />
                </svg>

                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border bg-gradient-to-br shadow-sm ${tone.box}`}>
                      <item.icon className="niza-icon-pop h-6 w-6" strokeWidth={1.9} />
                    </div>
                    {notifCount > 0 && (
                      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-500 px-1.5 text-[11px] font-bold text-white shadow-[0_6px_14px_-4px_rgba(249,115,22,0.7)]">
                        {notifCount > 99 ? '99+' : notifCount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <h3 className="text-[17px] font-semibold leading-tight tracking-tight text-foreground line-clamp-2">
                      {item.title}
                    </h3>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white bg-white/90 text-primary shadow-md transition-all duration-300 group-hover:translate-x-1 group-hover:bg-primary group-hover:text-white">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
