import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, Clock, TrendingUp, Calendar, ArrowUpRight, Sparkles, Bell, FileText, AlertCircle, UserPlus, DollarSign, Wrench, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';

interface DocumentFollowUp {
  id: string;
  title: string;
  file_name: string;
  follow_up_date: string;
  employee: { first_name: string; last_name: string } | null;
}

interface PendingApproval {
  id: string;
  employee_id: string;
  submitted_at: string;
  employee: {
    first_name: string;
    last_name: string;
    job_title: string | null;
    join_date: string | null;
  } | null;
}

interface DailyReport {
  id: string;
  title: string;
  report_type: string | null;
  submitted_at: string | null;
  branch?: { name: string } | null;
}

interface MaintenanceTicket {
  id: string;
  title: string;
  priority: string | null;
  status: string | null;
  created_at: string | null;
  branch?: { name: string } | null;
}

interface Stats {
  totalEmployees: number;
  presentToday: number;
  pendingApprovals: number;
  activeEvents: number;
}

export default function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [overdueFollowUps, setOverdueFollowUps] = useState<DocumentFollowUp[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<DocumentFollowUp[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<MaintenanceTicket[]>([]);
  const [stats, setStats] = useState<Stats>({ totalEmployees: 0, presentToday: 0, pendingApprovals: 0, activeEvents: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();

    // Real-time subscriptions
    const documentsChannel = supabase
      .channel('documents-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => fetchDocumentFollowUps())
      .subscribe();

    const approvalsChannel = supabase
      .channel('approvals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_approvals' }, () => fetchPendingApprovals())
      .subscribe();

    const reportsChannel = supabase
      .channel('daily-reports-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' }, () => fetchDailyReports())
      .subscribe();

    const maintenanceChannel = supabase
      .channel('maintenance-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_tickets' }, () => fetchMaintenanceTickets())
      .subscribe();

    return () => {
      supabase.removeChannel(documentsChannel);
      supabase.removeChannel(approvalsChannel);
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(maintenanceChannel);
    };
  }, [user?.role]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStats(),
      fetchDocumentFollowUps(),
      fetchPendingApprovals(),
      fetchDailyReports(),
      fetchMaintenanceTickets()
    ]);
    setLoading(false);
  };

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const [employeesRes, clockInsRes, approvalsRes, eventsRes] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('clock_ins').select('id', { count: 'exact', head: true })
        .gte('clock_in_time', `${today}T00:00:00`)
        .lte('clock_in_time', `${today}T23:59:59`),
      supabase.from('contract_approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('events').select('id', { count: 'exact', head: true })
        .gte('event_date', new Date().toISOString())
    ]);

    setStats({
      totalEmployees: employeesRes.count || 0,
      presentToday: clockInsRes.count || 0,
      pendingApprovals: approvalsRes.count || 0,
      activeEvents: eventsRes.count || 0
    });
  };

  const fetchDocumentFollowUps = async () => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const [overdueRes, upcomingRes] = await Promise.all([
      supabase
        .from('documents')
        .select('id, title, file_name, follow_up_date, employee:employees(first_name, last_name)')
        .not('follow_up_date', 'is', null)
        .lt('follow_up_date', today.toISOString().split('T')[0])
        .order('follow_up_date', { ascending: true })
        .limit(10),
      supabase
        .from('documents')
        .select('id, title, file_name, follow_up_date, employee:employees(first_name, last_name)')
        .not('follow_up_date', 'is', null)
        .gte('follow_up_date', today.toISOString().split('T')[0])
        .lte('follow_up_date', thirtyDaysFromNow.toISOString().split('T')[0])
        .order('follow_up_date', { ascending: true })
        .limit(10)
    ]);

    setOverdueFollowUps(overdueRes.data || []);
    setUpcomingFollowUps(upcomingRes.data || []);
  };

  const fetchPendingApprovals = async () => {
    const { data } = await supabase
      .from('contract_approvals')
      .select(`id, employee_id, submitted_at, employee:employees(first_name, last_name, job_title, join_date)`)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(10);
    setPendingApprovals(data || []);
  };

  const fetchDailyReports = async () => {
    const { data } = await supabase
      .from('daily_reports')
      .select(`id, title, report_type, submitted_at, branch:branches(name)`)
      .order('submitted_at', { ascending: false })
      .limit(10);
    setDailyReports(data || []);
  };

  const fetchMaintenanceTickets = async () => {
    const { data } = await supabase
      .from('maintenance_tickets')
      .select(`id, title, priority, status, created_at, branch:branches(name)`)
      .neq('status', 'resolved')
      .order('created_at', { ascending: false })
      .limit(10);
    setMaintenanceTickets(data || []);
  };

  const highPriorityTickets = maintenanceTickets.filter(t => t.priority === 'high');
  const attendanceRate = stats.totalEmployees > 0 
    ? ((stats.presentToday / stats.totalEmployees) * 100).toFixed(1) 
    : '0';

  // Employee View
  if (user?.role === 'employee') {
    return (
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto relative overflow-hidden" style={{ background: 'var(--gradient-panel)' }}>
        <svg className="absolute inset-0 w-full h-full opacity-5 z-0" viewBox="0 0 593 470" fill="none" preserveAspectRatio="xMidYMid slice">
          <path d="M8.44398 0.617329H592.052V469.547C592.052 48.6499 274.052 498.547 366.552 250.047C459.052 1.5472 419.436 102.82 419.436 102.82C419.436 102.82 343.17 209.048 201.552 208.547C124.426 208.274 104.783 140.619 188.052 102.82C319.337 43.2233 149.498 31.3712 120.052 23.0472C56.1705 4.98889 22.6081 1.25634 8.44398 0.617329H0.0516663C0.0516663 0.617329 2.59244 0.353338 8.44398 0.617329Z" fill="url(#paint0_linear_emp)" stroke="hsl(var(--border))"/>
          <defs>
            <linearGradient id="paint0_linear_emp" x1="592.659" y1="0.617318" x2="376.315" y2="504.04" gradientUnits="userSpaceOnUse">
              <stop offset="0.0734679" stopColor="hsl(var(--accent))"/>
              <stop offset="0.458691" stopColor="hsl(var(--primary))"/>
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 overflow-hidden rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-sm p-6 md:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Welcome back</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{user?.name}</h1>
          <p className="text-muted-foreground text-base md:text-lg">Here's your overview for today</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 relative z-10">
          {[
            { icon: Calendar, label: 'Leave Balance', value: '—', sub: 'Check attendance' },
            { icon: Clock, label: "Week's Shifts", value: '—', sub: 'View schedule' },
            { icon: TrendingUp, label: 'Training', value: '—', sub: 'View courses' },
            { icon: Calendar, label: 'Requests', value: '—', sub: 'View all' },
          ].map((item, i) => (
            <Card key={i} className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
              <div className="p-4 md:p-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg mb-3 md:mb-4">
                  <item.icon className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">{item.label}</p>
                <p className="text-xl md:text-3xl font-bold text-foreground">{item.value}</p>
                <p className="text-[10px] md:text-xs text-primary mt-1 md:mt-2">{item.sub}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 relative z-10">
          <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-bold text-foreground mb-4 md:mb-6">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {[
                { label: 'Request Leave', path: '/dashboard/attendance' },
                { label: 'View Payslips', path: '/dashboard/payroll' },
                { label: 'My Documents', path: '/dashboard/documents' },
                { label: 'Training', path: '/dashboard/elearning' },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={() => navigate(action.path)}
                  className="bg-gradient-to-br from-primary to-accent text-white p-3 md:p-4 rounded-xl font-semibold transition-all hover:scale-105 hover:shadow-lg text-xs md:text-sm"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-bold text-foreground mb-4 md:mb-6">Recent Activity</h3>
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent activity</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Admin/HR/Manager View
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto relative overflow-hidden" style={{ background: 'var(--gradient-panel)' }}>
      <svg className="absolute inset-0 w-full h-full opacity-5 z-0" viewBox="0 0 593 470" fill="none" preserveAspectRatio="xMidYMid slice">
        <path d="M8.44398 0.617329H592.052V469.547C592.052 48.6499 274.052 498.547 366.552 250.047C459.052 1.5472 419.436 102.82 419.436 102.82C419.436 102.82 343.17 209.048 201.552 208.547C124.426 208.274 104.783 140.619 188.052 102.82C319.337 43.2233 149.498 31.3712 120.052 23.0472C56.1705 4.98889 22.6081 1.25634 8.44398 0.617329H0.0516663C0.0516663 0.617329 2.59244 0.353338 8.44398 0.617329Z" fill="url(#paint0_linear)" stroke="hsl(var(--border))"/>
        <defs>
          <linearGradient id="paint0_linear" x1="592.659" y1="0.617318" x2="376.315" y2="504.04" gradientUnits="userSpaceOnUse">
            <stop offset="0.0734679" stopColor="hsl(var(--accent))"/>
            <stop offset="0.458691" stopColor="hsl(var(--primary))"/>
          </linearGradient>
        </defs>
      </svg>

      {/* Welcome Header */}
      <div className="relative z-10 overflow-hidden rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-sm p-6 md:p-8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Welcome back</span>
        </div>
        <h1 className="text-2xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{user?.name}</h1>
        <p className="text-muted-foreground text-base md:text-lg">Here's your team overview for today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 relative z-10">
        <Card className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">Total Employees</p>
            <p className="text-2xl md:text-3xl font-bold text-foreground">{loading ? '—' : stats.totalEmployees}</p>
            <p className="text-[10px] md:text-xs text-primary mt-1 md:mt-2">Active employees</p>
          </div>
        </Card>

        <Card className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg">
                <Clock className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">Present Today</p>
            <p className="text-2xl md:text-3xl font-bold text-foreground">{loading ? '—' : stats.presentToday}</p>
            <p className="text-[10px] md:text-xs text-accent mt-1 md:mt-2">{attendanceRate}% attendance</p>
          </div>
        </Card>

        <Card className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <UserPlus className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">Pending Approvals</p>
            <p className="text-2xl md:text-3xl font-bold text-foreground">{loading ? '—' : stats.pendingApprovals}</p>
            <p className="text-[10px] md:text-xs text-primary mt-1 md:mt-2">Contracts awaiting</p>
          </div>
        </Card>

        <Card className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg">
                <Calendar className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">Upcoming Events</p>
            <p className="text-2xl md:text-3xl font-bold text-foreground">{loading ? '—' : stats.activeEvents}</p>
            <p className="text-[10px] md:text-xs text-accent mt-1 md:mt-2">This week</p>
          </div>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 relative z-10">
        {/* Document Follow-ups */}
        <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="text-lg md:text-xl font-bold text-foreground">Document Follow-ups</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/documents')} className="text-xs md:text-sm">
                View All
              </Button>
            </div>
            
            {overdueFollowUps.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="destructive" className="text-xs">Overdue</Badge>
                  <span className="text-xs text-muted-foreground">{overdueFollowUps.length} documents</span>
                </div>
                <ScrollArea className="h-24">
                  {overdueFollowUps.slice(0, 3).map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 mb-1">
                      <span className="text-sm font-medium truncate flex-1">{doc.title}</span>
                      <span className="text-xs text-destructive ml-2">{format(new Date(doc.follow_up_date), 'dd MMM')}</span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {upcomingFollowUps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">Upcoming</Badge>
                  <span className="text-xs text-muted-foreground">{upcomingFollowUps.length} documents</span>
                </div>
                <ScrollArea className="h-24">
                  {upcomingFollowUps.slice(0, 3).map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50 mb-1">
                      <span className="text-sm font-medium truncate flex-1">{doc.title}</span>
                      <span className="text-xs text-amber-700 ml-2">{format(new Date(doc.follow_up_date), 'dd MMM')}</span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {overdueFollowUps.length === 0 && upcomingFollowUps.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No document follow-ups</p>
              </div>
            )}
          </div>
        </Card>

        {/* Pending Contract Approvals */}
        <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h3 className="text-lg md:text-xl font-bold text-foreground">New Employee Approvals</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/employees')} className="text-xs md:text-sm">
                View All
              </Button>
            </div>
            <ScrollArea className="h-[180px]">
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No pending approvals</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingApprovals.map(approval => (
                    <div key={approval.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium text-sm">{approval.employee?.first_name} {approval.employee?.last_name}</p>
                        <p className="text-xs text-muted-foreground">{approval.employee?.job_title || 'New Employee'}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">Pending</Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </Card>

        {/* Daily Reports */}
        <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h3 className="text-lg md:text-xl font-bold text-foreground">Daily Reports</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/daily-reports')} className="text-xs md:text-sm">
                View All
              </Button>
            </div>
            <ScrollArea className="h-[180px]">
              {dailyReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No reports submitted</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dailyReports.map(report => (
                    <div key={report.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium text-sm">{report.title}</p>
                        <p className="text-xs text-muted-foreground">{report.branch?.name}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">{report.report_type || 'Report'}</Badge>
                        {report.submitted_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(report.submitted_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </Card>

        {/* Maintenance Tickets */}
        <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                <h3 className="text-lg md:text-xl font-bold text-foreground">Maintenance Tickets</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/maintenance')} className="text-xs md:text-sm">
                View All
              </Button>
            </div>
            <ScrollArea className="h-[180px]">
              {maintenanceTickets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wrench className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No open tickets</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {maintenanceTickets.map(ticket => (
                    <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium text-sm">{ticket.title}</p>
                        <p className="text-xs text-muted-foreground">{ticket.branch?.name}</p>
                      </div>
                      <Badge 
                        variant={ticket.priority === 'high' ? 'destructive' : ticket.priority === 'medium' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {ticket.priority || 'Normal'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </Card>
      </div>
    </div>
  );
}
