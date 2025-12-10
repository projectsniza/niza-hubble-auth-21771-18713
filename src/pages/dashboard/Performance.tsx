import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Search, Plus, Download, TrendingUp, Users, Target, Star, Settings, Building2, MapPin, Trophy, Medal, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Performance() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState<'all' | 'company' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [showAddReview, setShowAddReview] = useState(false);
  const [showAddCriteria, setShowAddCriteria] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [newReview, setNewReview] = useState({
    employeeId: '',
    periodStart: '',
    periodEnd: '',
    feedback: '',
    goals: '',
    goalsProgress: 50,
    overallRating: 3
  });

  const [newCriteria, setNewCriteria] = useState({
    name: '',
    description: '',
    weight: 1
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchBranches(selectedOrg);
    } else {
      setBranches([]);
      setSelectedBranch('');
    }
  }, [selectedOrg]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let employeesQuery = supabase
        .from('employees')
        .select('*, branch:branches(id, name, organization_id), organization:organizations(id, name)')
        .eq('status', 'active');

      // Filter employees by scope for HR/Manager
      if (user?.role === 'hr') {
        if (user.hrAccessLevel === 'branch') {
          employeesQuery = employeesQuery.eq('branch_id', user.branchId);
        } else if (user.hrAccessLevel === 'organization') {
          employeesQuery = employeesQuery.eq('organization_id', user.organizationId);
        }
        // 'full' access level sees all employees
      } else if (user?.role === 'manager') {
        employeesQuery = employeesQuery.eq('branch_id', user.branchId);
      }

      const [employeesRes, reviewsRes, criteriaRes, orgsRes] = await Promise.all([
        employeesQuery,
        supabase.from('performance_reviews').select('*').order('created_at', { ascending: false }),
        supabase.from('performance_criteria').select('*').eq('is_active', true),
        supabase.from('organizations').select('*').order('name')
      ]);

      setEmployees(employeesRes.data || []);
      setReviews(reviewsRes.data || []);
      setCriteria(criteriaRes.data || []);
      setOrganizations(orgsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async (orgId: string) => {
    const { data } = await supabase.from('branches').select('*').eq('organization_id', orgId).order('name');
    setBranches(data || []);
  };

  const handleAddReview = async () => {
    if (!newReview.employeeId) {
      toast.error('Please select an employee');
      return;
    }

    try {
      const { error } = await supabase.from('performance_reviews').insert({
        employee_id: newReview.employeeId,
        reviewer_id: user?.id,
        review_period_start: newReview.periodStart || null,
        review_period_end: newReview.periodEnd || null,
        feedback: newReview.feedback || null,
        goals: newReview.goals || null,
        goals_progress: newReview.goalsProgress,
        overall_rating: newReview.overallRating,
        status: 'draft'
      });

      if (error) throw error;

      toast.success('Review added successfully');
      setShowAddReview(false);
      setNewReview({ employeeId: '', periodStart: '', periodEnd: '', feedback: '', goals: '', goalsProgress: 50, overallRating: 3 });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add review');
    }
  };

  const handleAddCriteria = async () => {
    if (!newCriteria.name) {
      toast.error('Please enter a criteria name');
      return;
    }

    try {
      const { error } = await supabase.from('performance_criteria').insert({
        name: newCriteria.name,
        description: newCriteria.description || null,
        weight: newCriteria.weight,
        created_by: user?.id
      });

      if (error) throw error;

      toast.success('Criteria added successfully');
      setShowAddCriteria(false);
      setNewCriteria({ name: '', description: '', weight: 1 });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add criteria');
    }
  };

  // Filter employees based on view mode
  const getFilteredEmployees = () => {
    let filtered = employees;
    
    if (viewMode === 'organization' && selectedOrg) {
      filtered = employees.filter(e => e.organization_id === selectedOrg);
    } else if (viewMode === 'branch' && selectedBranch) {
      filtered = employees.filter(e => e.branch_id === selectedBranch);
    }
    
    return filtered;
  };

  // Get reviews for filtered employees
  const getFilteredReviews = () => {
    const filteredEmployeeIds = getFilteredEmployees().map(e => e.id);
    return reviews.filter(r => filteredEmployeeIds.includes(r.employee_id));
  };

  // Calculate performance rankings
  const getPerformanceRankings = () => {
    const filteredEmployees = getFilteredEmployees();
    const employeeRatings = filteredEmployees.map(emp => {
      const empReviews = reviews.filter(r => r.employee_id === emp.id && r.status === 'completed');
      const avgRating = empReviews.length > 0
        ? empReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / empReviews.length
        : 0;
      const avgGoals = empReviews.length > 0
        ? empReviews.reduce((sum, r) => sum + (r.goals_progress || 0), 0) / empReviews.length
        : 0;
      
      return {
        ...emp,
        avgRating,
        avgGoals,
        reviewCount: empReviews.length,
        score: avgRating * 20 + avgGoals * 0.3 // Combined score
      };
    }).filter(e => e.reviewCount > 0)
      .sort((a, b) => b.score - a.score);

    return employeeRatings;
  };

  const filteredReviews = getFilteredReviews().filter(review => {
    if (activeTab === 'pending') return review.status === 'draft';
    if (activeTab === 'completed') return review.status === 'completed';
    return true;
  });

  const currentReviews = getFilteredReviews();
  const averageRating = currentReviews.length > 0 
    ? (currentReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / currentReviews.length).toFixed(1)
    : '0.0';

  const completedReviews = currentReviews.filter(r => r.status === 'completed').length;
  const avgGoalsProgress = currentReviews.length > 0
    ? Math.round(currentReviews.reduce((sum, r) => sum + (r.goals_progress || 0), 0) / currentReviews.length)
    : 0;

  const rankings = getPerformanceRankings();
  const topPerformers = rankings.slice(0, 5);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-medium">#{index + 1}</span>;
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Performance Management</h1>
          <p className="text-muted-foreground">Track and manage employee performance reviews and goals.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Dialog open={showAddReview} onOpenChange={setShowAddReview}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Review
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Performance Review</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Employee *</Label>
                    <Select value={newReview.employeeId} onValueChange={(v) => setNewReview({ ...newReview, employeeId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Period Start</Label>
                      <Input 
                        type="date"
                        value={newReview.periodStart}
                        onChange={(e) => setNewReview({ ...newReview, periodStart: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Period End</Label>
                      <Input 
                        type="date"
                        value={newReview.periodEnd}
                        onChange={(e) => setNewReview({ ...newReview, periodEnd: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Overall Rating (1-5)</Label>
                    <Select 
                      value={newReview.overallRating.toString()} 
                      onValueChange={(v) => setNewReview({ ...newReview, overallRating: parseInt(v) })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n} Star{n > 1 ? 's' : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Goals</Label>
                    <Textarea 
                      value={newReview.goals}
                      onChange={(e) => setNewReview({ ...newReview, goals: e.target.value })}
                      placeholder="Employee goals..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Goals Progress (%)</Label>
                    <Input 
                      type="number"
                      min="0"
                      max="100"
                      value={newReview.goalsProgress}
                      onChange={(e) => setNewReview({ ...newReview, goalsProgress: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Feedback</Label>
                    <Textarea 
                      value={newReview.feedback}
                      onChange={(e) => setNewReview({ ...newReview, feedback: e.target.value })}
                      placeholder="Manager feedback..."
                    />
                  </div>
                  <Button onClick={handleAddReview} className="w-full">Save Review</Button>
                </div>
              </DialogContent>
            </Dialog>
            
            {user?.role === 'super_admin' && (
              <Dialog open={showAddCriteria} onOpenChange={setShowAddCriteria}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Manage Criteria
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Performance Criteria</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Criteria Name *</Label>
                      <Input 
                        value={newCriteria.name}
                        onChange={(e) => setNewCriteria({ ...newCriteria, name: e.target.value })}
                        placeholder="e.g., Technical Skills"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea 
                        value={newCriteria.description}
                        onChange={(e) => setNewCriteria({ ...newCriteria, description: e.target.value })}
                        placeholder="Criteria description..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Weight</Label>
                      <Input 
                        type="number"
                        step="0.1"
                        value={newCriteria.weight}
                        onChange={(e) => setNewCriteria({ ...newCriteria, weight: parseFloat(e.target.value) })}
                      />
                    </div>
                    <Button onClick={handleAddCriteria} className="w-full">Add Criteria</Button>
                    
                    {criteria.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Existing Criteria</h4>
                        <div className="space-y-2">
                          {criteria.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-2 bg-muted rounded">
                              <span>{c.name}</span>
                              <Badge variant="secondary">Weight: {c.weight}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* View Mode Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Label className="font-medium">View By:</Label>
          <div className="flex gap-2">
            <Button 
              variant={viewMode === 'all' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => { setViewMode('all'); setSelectedOrg(''); setSelectedBranch(''); }}
            >
              All Company
            </Button>
            <Button 
              variant={viewMode === 'organization' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setViewMode('organization')}
            >
              <Building2 className="h-4 w-4 mr-1" />
              By Organization
            </Button>
            <Button 
              variant={viewMode === 'branch' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setViewMode('branch')}
            >
              <MapPin className="h-4 w-4 mr-1" />
              By Branch
            </Button>
          </div>

          {(viewMode === 'organization' || viewMode === 'branch') && (
            <Select value={selectedOrg} onValueChange={(v) => { setSelectedOrg(v); setSelectedBranch(''); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select Organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {viewMode === 'branch' && selectedOrg && (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Rating
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{averageRating}</span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star 
                    key={n} 
                    className={`h-4 w-4 ${n <= parseFloat(averageRating) ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} 
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {currentReviews.length} reviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reviews Completed
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completedReviews} / {currentReviews.length}</div>
            <Progress value={currentReviews.length > 0 ? (completedReviews / currentReviews.length) * 100 : 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Goals Progress
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgGoalsProgress}%</div>
            <Progress value={avgGoalsProgress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Employees Reviewed
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{rankings.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Out of {getFilteredEmployees().length} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top Performers
              {viewMode !== 'all' && (
                <Badge variant="secondary" className="ml-2">
                  {viewMode === 'organization' && selectedOrg 
                    ? organizations.find(o => o.id === selectedOrg)?.name
                    : viewMode === 'branch' && selectedBranch
                    ? branches.find(b => b.id === selectedBranch)?.name
                    : 'All'
                  }
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPerformers.map((emp, index) => (
                <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="w-8 flex justify-center">
                      {getRankIcon(index)}
                    </div>
                    <div>
                      <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {emp.organization?.name} • {emp.branch?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{emp.avgRating.toFixed(1)}</span>
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      </div>
                      <p className="text-xs text-muted-foreground">{emp.reviewCount} reviews</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{emp.avgGoals.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Goals</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Reviews List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Reviews ({currentReviews.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({currentReviews.filter(r => r.status === 'draft').length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedReviews})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredReviews.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Star className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">No performance reviews</h3>
                  <p className="text-muted-foreground mb-4">Create your first performance review to track employee progress</p>
                </div>
                <Button onClick={() => setShowAddReview(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add First Review
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Goals Progress</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviews.map(review => {
                    const employee = employees.find(e => e.id === review.employee_id);
                    return (
                      <TableRow key={review.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{employee?.first_name} {employee?.last_name}</p>
                            <p className="text-sm text-muted-foreground">{employee?.job_title}</p>
                          </div>
                        </TableCell>
                        <TableCell>{employee?.organization?.name || '-'}</TableCell>
                        <TableCell>{employee?.branch?.name || '-'}</TableCell>
                        <TableCell>
                          {review.review_period_start && review.review_period_end 
                            ? `${format(new Date(review.review_period_start), 'MMM yyyy')} - ${format(new Date(review.review_period_end), 'MMM yyyy')}`
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(n => (
                              <Star 
                                key={n} 
                                className={`h-4 w-4 ${n <= (review.overall_rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} 
                              />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={review.goals_progress || 0} className="w-20" />
                            <span className="text-sm">{review.goals_progress || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={review.status === 'completed' ? 'default' : 'secondary'}>
                            {review.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}