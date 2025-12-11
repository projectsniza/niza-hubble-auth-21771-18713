import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Search, AlertTriangle, FileText, CheckCircle, Clock, Plus } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';

export default function NizaSafeHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [riskAssessments, setRiskAssessments] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [currentRiskIndex, setCurrentRiskIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'short', 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [riskRes, incidentRes, taskRes] = await Promise.all([
        supabase.from('risk_assessments').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('incidents').select('*').order('created_at', { ascending: false }),
        supabase.from('safety_tasks').select('*').order('due_date', { ascending: true }),
      ]);

      if (riskRes.data) setRiskAssessments(riskRes.data);
      if (incidentRes.data) setIncidents(incidentRes.data);
      if (taskRes.data) setTasks(taskRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter tasks for current user
  const myTasks = tasks.filter(t => t.assigned_to === user?.id);
  const overdueTasks = myTasks.filter(t => t.status !== 'completed' && t.due_date && isPast(new Date(t.due_date)));
  const upcomingTasks = myTasks.filter(t => 
    t.status !== 'completed' && t.due_date && 
    isWithinInterval(new Date(t.due_date), { start: new Date(), end: addDays(new Date(), 7) })
  );
  const totalPendingTasks = myTasks.filter(t => t.status !== 'completed').length;
  const completedTasks = myTasks.filter(t => t.status === 'completed').length;

  const accidents = incidents.filter(i => i.incident_type === 'accident');
  const nearMisses = incidents.filter(i => i.incident_type === 'near_miss');

  const nextRisk = () => {
    setCurrentRiskIndex((prev) => (prev + 1) % Math.max(riskAssessments.length, 1));
  };

  const prevRisk = () => {
    setCurrentRiskIndex((prev) => (prev - 1 + riskAssessments.length) % Math.max(riskAssessments.length, 1));
  };

  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr' || user?.role === 'manager';

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Hi, {user?.name || 'User'} <span className="text-lg font-normal text-muted-foreground">{today}</span>
        </h1>
      </div>

      <div className="flex gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents, assessments..."
            className="pl-10"
          />
        </div>
        {isAdmin && (
          <Button 
            onClick={() => navigate('/niza-safe/risk-management')}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Report a hazard
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Your tasks */}
        <Card className="p-6 border-border hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Your tasks...</h2>
          <p className="text-sm text-muted-foreground mb-4">Over the next 7 days</p>
          
          <div className="flex items-center justify-center py-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-8 border-primary/20 flex items-center justify-center">
                <span className="text-5xl font-bold text-foreground">{totalPendingTasks}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div 
              className="p-3 rounded-lg bg-destructive/10 cursor-pointer hover:bg-destructive/20 transition-colors"
              onClick={() => navigate('/niza-safe/tasks')}
            >
              <p className="text-sm font-medium text-destructive">⚠ Overdue ({overdueTasks.length})</p>
              <p className="text-sm text-muted-foreground mt-1">
                {overdueTasks.length === 0 ? 'There are no overdue tasks' : `${overdueTasks.length} task(s) need attention`}
              </p>
            </div>
            <div 
              className="p-3 rounded-lg bg-accent/10 cursor-pointer hover:bg-accent/20 transition-colors"
              onClick={() => navigate('/niza-safe/tasks')}
            >
              <p className="text-sm font-medium text-foreground">⏰ Upcoming ({upcomingTasks.length})</p>
              <p className="text-sm text-muted-foreground mt-1">
                {upcomingTasks.length === 0 ? 'There are no upcoming tasks' : `${upcomingTasks.length} task(s) due soon`}
              </p>
            </div>
          </div>

          <Button 
            variant="link" 
            className="mt-4 p-0 text-primary hover:text-primary/80"
            onClick={() => navigate('/niza-safe/tasks')}
          >
            View all →
          </Button>
        </Card>

        {/* Risk assessments */}
        <Card className="p-6 border-border hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="bg-gradient-to-r from-primary to-accent text-white w-8 h-8 rounded-full flex items-center justify-center font-semibold shadow-lg">
                {riskAssessments.length}
              </span>
              <h2 className="text-lg font-semibold text-foreground">Risk assessments</h2>
              <Button 
                variant="link" 
                className="text-primary p-0 hover:text-primary/80"
                onClick={() => navigate('/niza-safe/risk-management')}
              >
                View all →
              </Button>
            </div>
            {isAdmin && (
              <Button 
                onClick={() => navigate('/niza-safe/risk-management')}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg h-8 text-sm"
              >
                Create +
              </Button>
            )}
          </div>

          {riskAssessments.length > 0 ? (
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={prevRisk}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Card className="flex-1 p-4 border-accent/30 bg-gradient-to-br from-accent/10 to-primary/5">
                <h3 className="font-semibold text-foreground">{riskAssessments[currentRiskIndex]?.title}</h3>
                <Badge variant="outline" className="mt-2">{riskAssessments[currentRiskIndex]?.status}</Badge>
                <p className="text-xs text-primary mt-2">
                  {riskAssessments[currentRiskIndex]?.review_date 
                    ? `Review: ${format(new Date(riskAssessments[currentRiskIndex].review_date), 'PPP')}`
                    : 'No review date set'}
                </p>
              </Card>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={nextRisk}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No risk assessments yet</p>
            </div>
          )}

          {/* Incidents section */}
          <div className="mt-8">
            <div className="flex gap-4 border-b border-border mb-4">
              <button 
                className="pb-2 border-b-2 border-primary text-primary font-medium"
                onClick={() => navigate('/niza-safe/incident-management')}
              >
                Accidents ({accidents.length})
              </button>
              <button 
                className="pb-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => navigate('/niza-safe/incident-management')}
              >
                Near Misses ({nearMisses.length})
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-destructive to-destructive/70 text-white w-8 h-8 rounded-full flex items-center justify-center font-semibold shadow-lg">
                  {accidents.length}
                </span>
                <span className="font-semibold text-foreground">Accidents</span>
              </div>
              {isAdmin && (
                <Button 
                  onClick={() => navigate('/niza-safe/incident-management')}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg h-8 text-sm"
                >
                  Report +
                </Button>
              )}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              In the unfortunate event of an accident, you can log the details and allow 'Responsible Persons' to conduct investigations to identify root causes to prevent re-occurrence.
            </p>
          </div>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <Card 
          className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/niza-safe/risk-management')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Risk Assessments</p>
              <p className="text-2xl font-bold text-foreground">{riskAssessments.length}</p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/niza-safe/incident-management')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Incidents</p>
              <p className="text-2xl font-bold text-foreground">{incidents.length}</p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/niza-safe/tasks')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-lg">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Tasks</p>
              <p className="text-2xl font-bold text-foreground">{totalPendingTasks}</p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/niza-safe/tasks')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed Tasks</p>
              <p className="text-2xl font-bold text-foreground">{completedTasks}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
