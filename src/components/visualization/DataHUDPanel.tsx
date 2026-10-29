import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Shield,
  Ticket,
  Car,
  FileText,
  Wrench,
  Calendar,
  MessageSquare,
  BarChart3,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ZoneDataMap, ModuleLiveMetrics } from './useDigitalTwinData';
import { DOCK_MODULES } from './GamifiedDock';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface DataHUDPanelProps {
  focusedZone: string;
  onClose: () => void;
  metrics: ZoneDataMap;
}

export function DataHUDPanel({ focusedZone, onClose, metrics }: DataHUDPanelProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';

  const moduleConfig = DOCK_MODULES.find((m) => m.id === focusedZone);
  const data: ModuleLiveMetrics | undefined = metrics[focusedZone as keyof ZoneDataMap];

  if (!moduleConfig || !data) return null;

  const isRestrictedForEmployee = isEmployee && !moduleConfig.isAllowedForEmployee;
  const Icon = moduleConfig.icon;

  return (
    <aside
      className="fixed top-20 right-4 sm:right-6 bottom-6 w-[340px] sm:w-[380px] z-40 rounded-2xl border border-primary/25 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden transition-all animate-in fade-in slide-in-from-right-4 duration-300"
      style={{
        background: 'linear-gradient(180deg, hsla(var(--card) / 0.92), hsla(var(--card) / 0.85))',
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.4), 0 0 20px hsla(var(--primary) / 0.15)',
      }}
    >
      {/* HUD Header */}
      <div className="p-4 border-b border-primary/15 flex items-center justify-between gap-2 bg-muted/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0 shadow-inner">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-base text-foreground truncate">{moduleConfig.name}</h2>
              {isRestrictedForEmployee && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/30">
                  Restricted
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">Live Station Telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Return to Overview (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main HUD Body */}
      <ScrollArea className="flex-1 p-4 space-y-4">
        {isRestrictedForEmployee ? (
          /* Employee Restricted Message */
          <div className="py-8 px-4 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-foreground text-sm">Zone Restricted</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This physical zone telemetry is accessible to branch store managers and administrators. As an employee, you can access your personal Hub, My Profile, Holiday Diary, Clock-Ins, and Training modules.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Summary Banner */}
            <div
              className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                data.status === 'alert'
                  ? 'bg-destructive/10 border-destructive/30 text-destructive'
                  : data.status === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  : 'bg-primary/10 border-primary/20 text-primary'
              }`}
            >
              {data.status === 'alert' ? (
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              ) : data.status === 'warning' ? (
                <Clock className="h-5 w-5 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-xs leading-relaxed font-medium">{data.summary}</div>
            </div>

            {/* Live KPI Metric Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-card border border-primary/15 shadow-sm">
                <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Active Badge
                </span>
                <span className="text-xl font-bold text-foreground">
                  {data.count}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-primary/15 shadow-sm">
                <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Zone Status
                </span>
                <Badge
                  variant={data.status === 'alert' ? 'destructive' : 'secondary'}
                  className="font-medium text-[11px]"
                >
                  {data.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Zone-Specific Drilldown Details */}
            {focusedZone === 'employees' && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  HR & People Hub (Dedicated Zone)
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">All Employees</span>
                    <span className="font-semibold text-foreground text-sm">{data.details.activeCount ?? 24}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                    <span className="text-amber-500 font-medium">Pending Onboardings</span>
                    <Badge variant="outline" className="border-amber-500 text-amber-500 font-bold">1</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs">
                    <span className="text-primary font-medium">Contract Approvals</span>
                    <Badge variant="outline" className="border-primary text-primary font-bold">2</Badge>
                  </div>
                </div>
              </div>
            )}

            {focusedZone === 'daily_reports' && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Back Office Daily Reports
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Daily Reports Today</span>
                    <span className="font-semibold text-foreground">{data.count || 2} Submitted</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Shift Till Audits</span>
                    <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">Balanced</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Fuel Delivery Reconciliation</span>
                    <span className="font-semibold text-primary">Logged</span>
                  </div>
                </div>
              </div>
            )}

            {focusedZone === 'sales_analysis' && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Till 1 & 2 Sales Analysis
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs">
                    <span className="text-primary font-medium">Today's Revenue</span>
                    <span className="font-bold text-foreground text-sm">£5,420.50</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Completed Transactions</span>
                    <span className="font-semibold text-foreground">1,240</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/30 text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fuel Volume</span>
                      <span className="font-medium text-foreground">68% (£3,685)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shop Retail</span>
                      <span className="font-medium text-foreground">28% (£1,518)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">National Lottery</span>
                      <span className="font-medium text-foreground">4% (£217)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {focusedZone === 'scheduling' && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Scheduling & Staff Planning
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Staff Rostered Today</span>
                    <span className="font-semibold text-foreground">8 Scheduled</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Shift Coverage</span>
                    <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">Full Coverage</Badge>
                  </div>
                </div>
              </div>
            )}

            {focusedZone === 'attendance' && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Holiday Diary & Leave
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                    <span className="text-amber-500 font-medium">Pending Leave Requests</span>
                    <Badge variant="outline" className="border-amber-500 text-amber-500 font-bold">{data.count || 4}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Staff on Leave Today</span>
                    <span className="font-semibold text-foreground">2 Staff</span>
                  </div>
                </div>
              </div>
            )}

            {focusedZone === 'lottery' && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Scratchcard & Till Stats
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Active Game Slots</span>
                    <span className="font-semibold text-foreground">{data.details.activeGames ?? 12}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Flagged Variances</span>
                    <span className={`font-semibold ${data.details.flaggedVariances > 0 ? 'text-destructive font-bold' : 'text-primary'}`}>
                      {data.details.flaggedVariances ?? 0}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal bg-muted/20 p-2.5 rounded-lg">
                  💡 Non-destructive slot history audit trail is active. Daily opening/closing packs and change records are logged permanently for manager change visibility.
                </p>
              </div>
            )}

            {focusedZone === 'customer_accounts' && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Commercial Fleet & Customer Accounts
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs">
                    <span className="text-primary font-medium">Active Accounts</span>
                    <span className="font-bold text-foreground text-sm">{data.details.activeAccounts ?? 18}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Credit Holds</span>
                    <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">0 Holds</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Month-to-Date Fuel Spend</span>
                    <span className="font-semibold text-foreground">{data.details.monthlySpend ?? '£14,850'}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal bg-muted/20 p-2.5 rounded-lg">
                  💳 Corporate fleet cards, key tag accounts, and B2B fuel charge invoices synchronized with head office ledger.
                </p>
              </div>
            )}

            {focusedZone === 'reminders' && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Branch Reminders & Tasks
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                    <span className="text-amber-500 font-medium">Due Reminders</span>
                    <Badge variant="outline" className="border-amber-500 text-amber-500 font-bold">{data.count || 2}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Priority Tasks</span>
                    <span className="font-semibold text-foreground">Till Balance & Dip Tank</span>
                  </div>
                </div>
              </div>
            )}

            {focusedZone === 'niza_safe' && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Safety Compliance Status
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Open Incidents</span>
                    <span className={`font-semibold ${data.details.openIncidents > 0 ? 'text-destructive font-bold' : 'text-foreground'}`}>
                      {data.details.openIncidents ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Overdue Safety Checklists</span>
                    <span className={`font-semibold ${data.details.overdueTasks > 0 ? 'text-amber-500 font-bold' : 'text-foreground'}`}>
                      {data.details.overdueTasks ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Fire Safety & First Aid</span>
                    <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">Valid</Badge>
                  </div>
                </div>
              </div>
            )}

            {focusedZone === 'drive_offs' && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Forecourt Fuel Incidents
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Unresolved Drive-Offs</span>
                    <span className={`font-semibold ${data.details.openDriveOffs > 0 ? 'text-destructive font-bold' : 'text-primary'}`}>
                      {data.details.openDriveOffs ?? 0}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground bg-muted/20 p-2.5 rounded-lg">
                    Vehicle CCTV footage, pump numbers, and police report logs are linked to each logged incident.
                  </p>
                </div>
              </div>
            )}

            {focusedZone === 'maintenance' && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Facility Equipment Tickets
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Active Work Orders</span>
                    <span className="font-semibold text-foreground">{data.details.openTickets ?? 0}</span>
                  </div>
                </div>
              </div>
            )}

            {focusedZone === 'documents' && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Compliance Documents Archive
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs">
                    <span className="text-destructive font-medium">Overdue Documents</span>
                    <span className="font-bold text-destructive">{data.details.pendingFollowUps || 3} Required</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground bg-muted/20 p-2.5 rounded-lg">
                    Critical compliance files past due date. Follow-up required for employee identity, training, and right-to-work documents.
                  </p>
                </div>
              </div>
            )}

            {/* Telemetry Refresh Footnote */}
            <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-2 border-t border-primary/10">
              <span>Telemetry sync: Live</span>
              <span>Updated {format(data.lastUpdated, 'HH:mm:ss')}</span>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* HUD Footer Action Button */}
      <div className="p-3 border-t border-primary/15 bg-muted/30 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="flex-1 text-xs gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Overview
        </Button>
        <Button
          size="sm"
          onClick={() => navigate(moduleConfig.route)}
          className="flex-1 text-xs gap-1.5 bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/20"
        >
          <span>Open Module</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </aside>
  );
}
