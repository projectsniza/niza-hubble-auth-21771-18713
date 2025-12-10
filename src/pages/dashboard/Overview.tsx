import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, Clock, TrendingUp, Calendar, ArrowUpRight, Sparkles, Bell, FileText, AlertCircle, UserPlus, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

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

export default function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [overdueFollowUps, setOverdueFollowUps] = useState<DocumentFollowUp[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<DocumentFollowUp[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchDocumentFollowUps();
      fetchPendingApprovals();

      // Real-time subscription for documents
      const documentsChannel = supabase
        .channel('documents-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'documents' },
          () => fetchDocumentFollowUps()
        )
        .subscribe();

      // Real-time subscription for contract approvals
      const approvalsChannel = supabase
        .channel('approvals-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'contract_approvals' },
          () => fetchPendingApprovals()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(documentsChannel);
        supabase.removeChannel(approvalsChannel);
      };
    }
  }, [user?.role]);

  const fetchDocumentFollowUps = async () => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    // Fetch overdue documents
    const { data: overdue } = await supabase
      .from('documents')
      .select('id, title, file_name, follow_up_date, employee:employees(first_name, last_name)')
      .not('follow_up_date', 'is', null)
      .lt('follow_up_date', today.toISOString().split('T')[0])
      .order('follow_up_date', { ascending: true })
      .limit(10);

    // Fetch upcoming documents (within 30 days)
    const { data: upcoming } = await supabase
      .from('documents')
      .select('id, title, file_name, follow_up_date, employee:employees(first_name, last_name)')
      .not('follow_up_date', 'is', null)
      .gte('follow_up_date', today.toISOString().split('T')[0])
      .lte('follow_up_date', thirtyDaysFromNow.toISOString().split('T')[0])
      .order('follow_up_date', { ascending: true })
      .limit(10);

    setOverdueFollowUps(overdue || []);
    setUpcomingFollowUps(upcoming || []);
  };

  const fetchPendingApprovals = async () => {
    const { data } = await supabase
      .from('contract_approvals')
      .select(`
        id,
        employee_id,
        submitted_at,
        employee:employees(first_name, last_name, job_title, join_date)
      `)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(10);

    setPendingApprovals(data || []);
  };

  // Employee View
  if (user?.role === 'employee') {
    return (
      <div className="p-8 space-y-8 max-w-7xl mx-auto relative overflow-hidden" style={{ background: 'var(--gradient-panel)' }}>
        <svg className="absolute inset-0 w-full h-full opacity-5 z-0" viewBox="0 0 593 470" fill="none" preserveAspectRatio="xMidYMid slice">
          <path d="M8.44398 0.617329H592.052V469.547C592.052 48.6499 274.052 498.547 366.552 250.047C459.052 1.5472 419.436 102.82 419.436 102.82C419.436 102.82 343.17 209.048 201.552 208.547C124.426 208.274 104.783 140.619 188.052 102.82C319.337 43.2233 149.498 31.3712 120.052 23.0472C56.1705 4.98889 22.6081 1.25634 8.44398 0.617329H0.0516663C0.0516663 0.617329 2.59244 0.353338 8.44398 0.617329Z" fill="url(#paint0_linear_emp)" stroke="hsl(var(--border))"/>
          <defs>
            <linearGradient id="paint0_linear_emp" x1="592.659" y1="0.617318" x2="376.315" y2="504.04" gradientUnits="userSpaceOnUse">
              <stop offset="0.0734679" stopColor="hsl(var(--accent))"/>
              <stop offset="0.458691" stopColor="hsl(var(--primary))"/>
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 overflow-hidden rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-sm p-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Welcome back</span>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{user?.name}</h1>
          <p className="text-muted-foreground text-lg">Here's your overview for today</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          <Card className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">My Leave Balance</p>
              <p className="text-3xl font-bold text-foreground">13 days</p>
              <p className="text-xs text-primary mt-2">Remaining this year</p>
            </div>
          </Card>

          <Card className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg">
                  <Clock className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">This Week's Shifts</p>
              <p className="text-3xl font-bold text-foreground">5</p>
              <p className="text-xs text-accent mt-2">38 hours scheduled</p>
            </div>
          </Card>

          <Card className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Training Progress</p>
              <p className="text-3xl font-bold text-foreground">60%</p>
              <p className="text-xs text-primary mt-2">1 course pending</p>
            </div>
          </Card>

          <Card className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Pending Requests</p>
              <p className="text-3xl font-bold text-foreground">2</p>
              <p className="text-xs text-accent mt-2">Awaiting approval</p>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
          <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-foreground">Upcoming Shifts</h3>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                  View All
                </Button>
              </div>
              <div className="space-y-4">
                {[
                  { shift: 'Morning Shift', date: 'Tomorrow', time: '08:00 - 16:00', location: 'Store A' },
                  { shift: 'Afternoon Shift', date: '30/12/2024', time: '12:00 - 20:00', location: 'Store A' },
                  { shift: 'Morning Shift', date: '31/12/2024', time: '08:00 - 16:00', location: 'Store B' },
                ].map((shift, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium text-foreground">{shift.shift}</p>
                      <p className="text-sm text-muted-foreground">{shift.date} • {shift.time}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{shift.location}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-foreground mb-6">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Request Leave', gradient: 'from-primary to-accent' },
                  { label: 'View Payslips', gradient: 'from-accent to-primary' },
                  { label: 'My Documents', gradient: 'from-primary to-accent' },
                  { label: 'Training Courses', gradient: 'from-accent to-primary' },
                ].map((action, i) => (
                  <button
                    key={i}
                    className={`relative overflow-hidden bg-gradient-to-br ${action.gradient} text-white p-4 rounded-xl font-semibold transition-all hover:scale-105 hover:shadow-lg group`}
                  >
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
                    <span className="relative">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Admin/HR/Manager View
  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto relative overflow-hidden" style={{ background: 'var(--gradient-panel)' }}>
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

      {/* Welcome Header */}
      <div className="relative z-10 overflow-hidden rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-sm p-8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Welcome back</span>
        </div>
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{user?.name}</h1>
        <p className="text-muted-foreground text-lg">Here's your team overview for today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        <Card className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Total Employees</p>
            <p className="text-3xl font-bold text-foreground">248</p>
            <p className="text-xs text-primary mt-2">+12 this month</p>
          </div>
        </Card>

        <Card className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Present Today</p>
            <p className="text-3xl font-bold text-foreground">235</p>
            <p className="text-xs text-accent mt-2">94.8% attendance</p>
          </div>
        </Card>

        <Card className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Performance</p>
            <p className="text-3xl font-bold text-foreground">94%</p>
            <p className="text-xs text-primary mt-2">Above target</p>
          </div>
        </Card>

        <Card className="group relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Events</p>
            <p className="text-3xl font-bold text-foreground">12</p>
            <p className="text-xs text-accent mt-2">This week</p>
          </div>
        </Card>
      </div>

      {/* Updates Section - Super Admin */}
      {user?.role === 'super_admin' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
          {/* Document Management */}
          <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Document Management
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">To-do list</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/dashboard/documents/todo')}
                  className="text-primary hover:text-primary"
                >
                  View all ({overdueFollowUps.length + upcomingFollowUps.length})
                </Button>
              </div>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                  {overdueFollowUps.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-orange-500">Overdue follow ups ({overdueFollowUps.length})</span>
                      </h4>
                      <div className="space-y-2 ml-4">
                        {overdueFollowUps.map((doc) => (
                          <div key={doc.id} className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/15 transition-colors cursor-pointer">
                            <p className="text-sm font-medium">
                              {doc.employee ? `${doc.employee.first_name} ${doc.employee.last_name}` : 'Unknown'} 
                              {doc.follow_up_date && ` - (${format(new Date(doc.follow_up_date), 'dd-MM-yyyy')})`}
                            </p>
                            <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {upcomingFollowUps.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-blue-500">Follow ups due within 30 days ({upcomingFollowUps.length})</span>
                      </h4>
                      <div className="space-y-2 ml-4">
                        {upcomingFollowUps.map((doc) => (
                          <div key={doc.id} className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 transition-colors cursor-pointer">
                            <p className="text-sm font-medium">
                              {doc.employee ? `${doc.employee.first_name} ${doc.employee.last_name}` : 'Unknown'}
                              {doc.follow_up_date && ` - (${format(new Date(doc.follow_up_date), 'dd-MM-yyyy')})`}
                            </p>
                            <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {overdueFollowUps.length === 0 && upcomingFollowUps.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No pending follow-ups</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </Card>

          {/* Daily Reports & Invoices */}
          <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Daily Reports & Invoices
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">From managers</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/dashboard/daily-reports')}
                  className="text-primary hover:text-primary"
                >
                  View all (5)
                </Button>
              </div>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-green-500">New Reports (3)</span>
                    </h4>
                    <div className="space-y-2 ml-4">
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 transition-colors cursor-pointer">
                        <p className="text-sm font-medium">Branch Sales Report - Niza Forecourt</p>
                        <p className="text-xs text-muted-foreground">Submitted by Department Manager • Today</p>
                      </div>
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 transition-colors cursor-pointer">
                        <p className="text-sm font-medium">Inventory Update - Southwater</p>
                        <p className="text-xs text-muted-foreground">Submitted by Department Manager • Today</p>
                      </div>
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 transition-colors cursor-pointer">
                        <p className="text-sm font-medium">Weekly Performance Summary</p>
                        <p className="text-xs text-muted-foreground">Submitted by Department Manager • Yesterday</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-purple-500">Invoices (2)</span>
                    </h4>
                    <div className="space-y-2 ml-4">
                      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15 transition-colors cursor-pointer">
                        <p className="text-sm font-medium">Invoice #INV-2024-1245</p>
                        <p className="text-xs text-muted-foreground">£2,450.00 • Pending review</p>
                      </div>
                      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15 transition-colors cursor-pointer">
                        <p className="text-sm font-medium">Invoice #INV-2024-1246</p>
                        <p className="text-xs text-muted-foreground">£1,890.00 • Pending review</p>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </Card>

          {/* Maintenance Requests */}
          <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-primary" />
                    Maintenance Requests
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Active tickets</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/dashboard/maintenance')}
                  className="text-primary hover:text-primary"
                >
                  View all (4)
                </Button>
              </div>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-red-500">High Priority (2)</span>
                    </h4>
                    <div className="space-y-2 ml-4">
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors cursor-pointer">
                        <p className="text-sm font-medium">HVAC System Failure - Main Office</p>
                        <p className="text-xs text-muted-foreground">Reported by Department Manager • 2 hours ago</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors cursor-pointer">
                        <p className="text-sm font-medium">Water Leak in Storage Area</p>
                        <p className="text-xs text-muted-foreground">Reported by Department Manager • 4 hours ago</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="text-yellow-500">Medium Priority (2)</span>
                    </h4>
                    <div className="space-y-2 ml-4">
                      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/15 transition-colors cursor-pointer">
                        <p className="text-sm font-medium">Parking Lot Light Replacement</p>
                        <p className="text-xs text-muted-foreground">Reported by Department Manager • Yesterday</p>
                      </div>
                      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/15 transition-colors cursor-pointer">
                        <p className="text-sm font-medium">Office Door Lock Repair</p>
                        <p className="text-xs text-muted-foreground">Reported by Department Manager • 2 days ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </Card>

          {/* New Employee Approvals */}
          <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    New Employee Approvals
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Pending approval</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/dashboard/employees?tab=contract-approvals')}
                  className="text-primary hover:text-primary"
                >
                  View all ({pendingApprovals.length})
                </Button>
              </div>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {pendingApprovals.length > 0 ? (
                    pendingApprovals.map((approval) => (
                      <div key={approval.id} className="p-4 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium">
                              {approval.employee?.first_name} {approval.employee?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {approval.employee?.job_title || 'No title'}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                            Pending
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          {approval.employee?.join_date 
                            ? `Start Date: ${format(new Date(approval.employee.join_date), 'dd MMM yyyy')}`
                            : 'Start Date: Not set'}
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => navigate('/dashboard/employees?tab=contract-approvals')}
                          >
                            Review
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No pending approvals</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
          {/* Recent Activities */}
          <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-foreground">Recent Activities</h3>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                  View All
                </Button>
              </div>
              <div className="space-y-4">
                {[
                  { action: 'New employee onboarded', time: '2 hours ago', color: 'bg-primary' },
                  { action: 'Payroll processed', time: '5 hours ago', color: 'bg-accent' },
                  { action: 'Performance review completed', time: '1 day ago', color: 'bg-primary' },
                  { action: 'Team meeting scheduled', time: '2 days ago', color: 'bg-accent' },
                ].map((activity, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className={`w-2 h-2 rounded-full ${activity.color}`} />
                    <div className="flex-1">
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-foreground mb-6">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Add Employee', gradient: 'from-primary to-accent' },
                  { label: 'Process Payroll', gradient: 'from-accent to-primary' },
                  { label: 'Schedule Shift', gradient: 'from-primary to-accent' },
                  { label: 'Create Event', gradient: 'from-accent to-primary' },
                ].map((action, i) => (
                  <button
                    key={i}
                    className={`relative overflow-hidden bg-gradient-to-br ${action.gradient} text-white p-4 rounded-xl font-semibold transition-all hover:scale-105 hover:shadow-lg group`}
                  >
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
                    <span className="relative">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
