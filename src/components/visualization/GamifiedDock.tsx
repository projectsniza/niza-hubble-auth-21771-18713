import React from 'react';
import {
  Users,
  FileText,
  Car,
  Ticket,
  ClipboardList,
  BarChart3,
  Wrench,
  Calendar,
  MessageSquare,
  CheckSquare,
  GraduationCap,
  Clock,
  Shield,
  Lock,
  Wallet,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ZoneDataMap } from './useDigitalTwinData';
import { useAuth } from '@/contexts/AuthContext';
import nizaGroupIcon from '@/assets/niza-group-icon.png';

export interface DockModule {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  isAllowedForEmployee?: boolean;
}

export const DOCK_MODULES: DockModule[] = [
  { id: 'employees', name: 'Employee Hub', icon: Users, route: '/dashboard/employees', isAllowedForEmployee: true },
  { id: 'documents', name: 'Documents', icon: FileText, route: '/dashboard/documents', isAllowedForEmployee: true },
  { id: 'drive_offs', name: 'Drive-Offs', icon: Car, route: '/dashboard/drive-offs', isAllowedForEmployee: false },
  { id: 'lottery', name: 'Lottery', icon: Ticket, route: '/dashboard/lottery', isAllowedForEmployee: false },
  { id: 'customer_accounts', name: 'Customer Accounts', icon: Wallet, route: '/dashboard/customer-accounts', isAllowedForEmployee: false },
  { id: 'daily_reports', name: 'Daily Reports', icon: ClipboardList, route: '/dashboard/daily-reports', isAllowedForEmployee: false },
  { id: 'sales_analysis', name: 'Sales Analysis', icon: BarChart3, route: '/dashboard/daily-summary', isAllowedForEmployee: false },
  { id: 'maintenance', name: 'Maintenance', icon: Wrench, route: '/dashboard/maintenance', isAllowedForEmployee: false },
  { id: 'scheduling', name: 'Scheduling', icon: Calendar, route: '/dashboard/scheduling', isAllowedForEmployee: true },
  { id: 'messages', name: 'Messages', icon: MessageSquare, route: '/dashboard/messages', isAllowedForEmployee: true },
  { id: 'reminders', name: 'Reminders', icon: CheckSquare, route: '/dashboard/reminders', isAllowedForEmployee: true },
  { id: 'elearning', name: 'Training / eLearning', icon: GraduationCap, route: '/dashboard/elearning', isAllowedForEmployee: true },
  { id: 'attendance', name: 'Holiday Diary', icon: Clock, route: '/dashboard/attendance', isAllowedForEmployee: true },
  { id: 'niza_safe', name: 'NIZA Safe', icon: Shield, route: '/niza-safe', isAllowedForEmployee: false },
];

interface GamifiedDockProps {
  activeZone: string | null;
  onSelectZone: (zoneId: string | null) => void;
  metrics: ZoneDataMap;
  pulseTriggeredZones: Record<string, boolean>;
}

export function GamifiedDock({
  activeZone,
  onSelectZone,
  metrics,
  pulseTriggeredZones,
}: GamifiedDockProps) {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';

  return (
    <TooltipProvider delayDuration={100}>
      {/* Positioned at bottom-center with high z-index and guaranteed visibility */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[96vw] overflow-x-auto no-scrollbar pointer-events-auto">
        <div
          className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-2xl border-2 border-primary/40 shadow-2xl backdrop-blur-2xl transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(10, 15, 29, 0.96), rgba(6, 44, 34, 0.94))',
            boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.7), 0 0 25px rgba(47, 173, 135, 0.35)',
          }}
        >
          {/* Overview / Reset Camera Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onSelectZone(null)}
                className={`relative flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-xl transition-all duration-200 group cursor-pointer ${
                  activeZone === null
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-slate-950 bg-primary/30 shadow-lg shadow-primary/30 scale-105'
                    : 'hover:bg-white/10 hover:scale-105 active:scale-95'
                }`}
                aria-label="Overview"
              >
                <img
                  src={nizaGroupIcon}
                  alt="NIZA Overview"
                  className="h-6 w-6 object-contain group-hover:rotate-12 transition-transform duration-300"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-slate-900 border-primary/40 text-white shadow-xl">
              <p className="font-semibold text-xs text-primary">Overview (All Zones)</p>
              <p className="text-[10px] text-muted-foreground">Press Escape or click to reset view</p>
            </TooltipContent>
          </Tooltip>

          <div className="h-6 w-[1.5px] bg-white/20 mx-0.5" />

          {/* Module Dock Items */}
          {DOCK_MODULES.map((module) => {
            const data = metrics[module.id as keyof ZoneDataMap];
            const isActive = activeZone === module.id;
            const isPulsing = pulseTriggeredZones[module.id];
            const isLocked = isEmployee && !module.isAllowedForEmployee;
            const count = data?.count || 0;
            const Icon = module.icon;

            return (
              <Tooltip key={module.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (isLocked) return;
                      onSelectZone(module.id);
                    }}
                    className={`relative flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-xl transition-all duration-200 select-none ${
                      isLocked ? 'opacity-35 grayscale cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      isActive
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-slate-950 bg-primary text-white shadow-lg shadow-primary/50 scale-110'
                        : 'text-slate-300 hover:text-white hover:bg-white/15 hover:scale-110 active:scale-95'
                    } ${isPulsing ? 'animate-pulse ring-2 ring-destructive' : ''}`}
                    aria-label={module.name}
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />

                    {/* Live Badge Count */}
                    {count > 0 && !isLocked && (
                      <span
                        className={`absolute -top-1.5 -right-1.5 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full min-w-[19px] text-center shadow-lg transition-all ${
                          data?.status === 'alert'
                            ? 'bg-destructive text-white animate-bounce'
                            : data?.status === 'warning'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-primary text-white'
                        }`}
                      >
                        {count > 99 ? '99+' : count}
                      </span>
                    )}

                    {/* Locked Indicator for Restricted Employee View */}
                    {isLocked && (
                      <span className="absolute -bottom-0.5 -right-0.5 bg-slate-900 text-slate-400 p-0.5 rounded-full border border-slate-700">
                        <Lock className="h-2.5 w-2.5" />
                      </span>
                    )}

                    {/* Active Underline Glow */}
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
                    )}
                  </button>
                </TooltipTrigger>

                <TooltipContent side="top" className="bg-slate-900 border-primary/40 text-white shadow-xl max-w-xs">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-xs text-primary">{module.name}</p>
                    {isLocked && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1 border-muted text-muted-foreground">
                        Locked
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {isLocked
                      ? 'Restricted to branch managers & administrators'
                      : data?.summary || 'Click to focus physical zone'}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
