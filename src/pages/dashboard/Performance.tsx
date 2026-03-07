import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Search, Plus, Download, TrendingUp, Users, Target, Star, Settings, Building2, MapPin, Trophy, Medal, Award, Trash2, Pencil, MoreHorizontal } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ReviewFormDialog from '@/components/performance/ReviewFormDialog';

interface CriteriaRating {
  criteriaId: string;
  rating: number;
}

interface ReviewFormData {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  feedback: string;
  goals: string;
  goalsProgress: number;
  overallRating: number;
  criteriaRatings: CriteriaRating[];
}

const initialReviewForm: ReviewFormData = {
  employeeId: '',
  periodStart: '',
  periodEnd: '',
  feedback: '',
  goals: '',
  goalsProgress: 50,
  overallRating: 3,
  criteriaRatings: []
};

export default function Performance() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Array<{
    id: string;
    first_name: string;
    last_name: string;
    branch_id: string;
    organization_id: string;
    job_title?: string | null;
    user_id?: string | null;
    organization?: { name: string } | null;
    branch?: { name: string } | null;
  }>>([]);
  const [reviews, setReviews] = useState<Array<{
    id: string;
    employee_id: string;
    review_period_start: string;
    review_period_end: string;
    overall_rating: number;
    status: string;
    feedback: string | null;
    goals: string | null;
    goals_progress: number | null;
    created_at: string;
    criteria_ratings?: any;
  }>>([]);
  const [criteria, setCriteria] = useState<Array<{ id: string; name: string; description: string | null; weight: number }>>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string; organization_id: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'company' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [showAddReview, setShowAddReview] = useState(false);
  const [showEditReview, setShowEditReview] = useState(false);
  const [showDeleteReview, setShowDeleteReview] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<{ id: string; employeeName: string } | null>(null);
  const [editingReview, setEditingReview] = useState<any>(null);
  const [showAddCriteria, setShowAddCriteria] = useState(false);
  const [showDeleteCriteria, setShowDeleteCriteria] = useState(false);
  const [criteriaToDelete, setCriteriaToDelete] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [reviewForm, setReviewForm] = useState<ReviewFormData>(initialReviewForm);

  const [newCriteria, setNewCriteria] = useState({
    name: '',
    description: '',
    weight: 1
  });

  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr' || user?.role === 'manager';
  const isEmployee = user?.role === 'employee';

  const fetchBranchesMemoized = useCallback(async (orgId: string) => {
    const { data } = await supabase.from('branches').select('*').eq('organization_id', orgId).order('name');
    setBranches(data || []);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchBranchesMemoized(selectedOrg);
    } else {
      setBranches([]);
      setSelectedBranch('');
    }
  }, [selectedOrg, fetchBranchesMemoized]);

  // Initialize criteria ratings when criteria loads or dialog opens
  useEffect(() => {
    if ((showAddReview || showEditReview) && criteria.length > 0) {
      if (!editingReview) {
        setReviewForm(prev => ({
          ...prev,
          criteriaRatings: criteria.map(c => ({ criteriaId: c.id, rating: 3 }))
        }));
      }
    }
  }, [showAddReview, showEditReview, criteria, editingReview]);

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
      } else if (user?.role === 'manager') {
        employeesQuery = employeesQuery.eq('branch_id', user.branchId);
      } else if (user?.role === 'employee') {
        employeesQuery = employeesQuery.eq('user_id', user.id);
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

  const handleSaveReview = async () => {
    if (!reviewForm.employeeId) {
      toast.error('Please select an employee');
      return;
    }

    try {
      // Calculate weighted average from criteria ratings
      let calculatedRating = reviewForm.overallRating;
      if (criteria.length > 0 && reviewForm.criteriaRatings.length > 0) {
        const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
        const weightedSum = reviewForm.criteriaRatings.reduce((sum, cr) => {
          const crit = criteria.find(c => c.id === cr.criteriaId);
          return sum + (cr.rating * (crit?.weight || 1));
        }, 0);
        calculatedRating = Math.round(weightedSum / totalWeight);
      }

      const reviewData = {
        employee_id: reviewForm.employeeId,
        reviewer_id: user?.id,
        review_period_start: reviewForm.periodStart || null,
        review_period_end: reviewForm.periodEnd || null,
        feedback: reviewForm.feedback || null,
        goals: reviewForm.goals || null,
        goals_progress: reviewForm.goalsProgress,
        overall_rating: calculatedRating,
        criteria_ratings: reviewForm.criteriaRatings as any,
        status: 'completed'
      };

      if (editingReview) {
        const { error } = await supabase
          .from('performance_reviews')
          .update(reviewData)
          .eq('id', editingReview.id);
        if (error) throw error;
        toast.success('Review updated successfully');
        setShowEditReview(false);
      } else {
        const { error } = await supabase.from('performance_reviews').insert(reviewData);
        if (error) throw error;
        toast.success('Review added successfully');
        setShowAddReview(false);
      }

      setReviewForm(initialReviewForm);
      setEditingReview(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save review');
    }
  };

  const handleEditReview = (review: any) => {
    const employee = employees.find(e => e.id === review.employee_id);
    setEditingReview(review);
    setReviewForm({
      employeeId: review.employee_id,
      periodStart: review.review_period_start || '',
      periodEnd: review.review_period_end || '',
      feedback: review.feedback || '',
      goals: review.goals || '',
      goalsProgress: review.goals_progress || 50,
      overallRating: review.overall_rating || 3,
      criteriaRatings: review.criteria_ratings || criteria.map(c => ({ criteriaId: c.id, rating: 3 }))
    });
    setShowEditReview(true);
  };

  const handleDeleteReview = async () => {
    if (!reviewToDelete) return;

    try {
      const { error } = await supabase
        .from('performance_reviews')
        .delete()
        .eq('id', reviewToDelete.id);

      if (error) throw error;

      toast.success('Review deleted successfully');
      setReviews(prev => prev.filter(r => r.id !== reviewToDelete.id));
      setShowDeleteReview(false);
      setReviewToDelete(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete review');
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
      setNewCriteria({ name: '', description: '', weight: 1 });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add criteria');
    }
  };

  const handleDeleteCriteria = async () => {
    if (!criteriaToDelete) return;

    try {
      const { error } = await supabase
        .from('performance_criteria')
        .update({ is_active: false })
        .eq('id', criteriaToDelete.id);

      if (error) throw error;

      toast.success('Criteria deleted successfully');
      setShowDeleteCriteria(false);
      setCriteriaToDelete(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete criteria');
    }
  };

  const updateCriteriaRating = (criteriaId: string, rating: number) => {
    setReviewForm(prev => ({
      ...prev,
      criteriaRatings: prev.criteriaRatings.map(cr => 
        cr.criteriaId === criteriaId ? { ...cr, rating } : cr
      )
    }));
  };

  const handleExportReport = () => {
    try {
      const dataToExport = filteredReviews.map(review => {
        const employee = employees.find(e => e.id === review.employee_id);
        return {
          'Employee Name': `${employee?.first_name || ''} ${employee?.last_name || ''}`,
          'Organization': employee?.organization?.name || '-',
          'Branch': employee?.branch?.name || '-',
          'Period Start': review.review_period_start ? format(new Date(review.review_period_start), 'dd/MM/yyyy') : '-',
          'Period End': review.review_period_end ? format(new Date(review.review_period_end), 'dd/MM/yyyy') : '-',
          'Overall Rating': review.overall_rating || 0,
          'Goals Progress': `${review.goals_progress || 0}%`,
          'Goals': review.goals || '-',
          'Feedback': review.feedback || '-',
          'Created At': review.created_at ? format(new Date(review.created_at), 'dd/MM/yyyy') : '-'
        };
      });

      if (dataToExport.length === 0) {
        toast.error('No reviews to export');
        return;
      }

      // Create CSV content
      const headers = Object.keys(dataToExport[0]);
      const csvContent = [
        headers.join(','),
        ...dataToExport.map(row => 
          headers.map(header => {
            const value = row[header as keyof typeof row];
            // Escape commas and quotes in values
            const escaped = String(value).replace(/"/g, '""');
            return `"${escaped}"`;
          }).join(',')
        )
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `performance_reviews_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      
      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    }
  };

  // Memoized filter for employees based on view mode
  const filteredEmployees = useMemo(() => {
    let filtered = employees;
    
    if (viewMode === 'organization' && selectedOrg) {
      filtered = employees.filter(e => e.organization_id === selectedOrg);
    } else if (viewMode === 'branch' && selectedBranch) {
      filtered = employees.filter(e => e.branch_id === selectedBranch);
    }
    
    return filtered;
  }, [employees, viewMode, selectedOrg, selectedBranch]);

  // Memoized reviews for filtered employees
  const filteredReviewsAll = useMemo(() => {
    const filteredEmployeeIds = new Set(filteredEmployees.map(e => e.id));
    return reviews.filter(r => filteredEmployeeIds.has(r.employee_id));
  }, [reviews, filteredEmployees]);

  // Memoized performance rankings - expensive calculation
  const rankings = useMemo(() => {
    const employeeRatings = filteredEmployees.map(emp => {
      const empReviews = reviews.filter(r => r.employee_id === emp.id);
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
        score: avgRating * 20 + avgGoals * 0.3
      };
    }).filter(e => e.reviewCount > 0)
      .sort((a, b) => b.score - a.score);

    return employeeRatings;
  }, [filteredEmployees, reviews]);

  const filteredReviews = useMemo(() => {
    let result = filteredReviewsAll;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => {
        const emp = employees.find(e => e.id === r.employee_id);
        return emp && (`${emp.first_name} ${emp.last_name}`.toLowerCase().includes(query));
      });
    }
    
    return result;
  }, [filteredReviewsAll, searchQuery, employees]);

  const { averageRating, avgGoalsProgress } = useMemo(() => {
    const avg = filteredReviewsAll.length > 0 
      ? (filteredReviewsAll.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / filteredReviewsAll.length).toFixed(1)
      : '0.0';
    const goals = filteredReviewsAll.length > 0
      ? Math.round(filteredReviewsAll.reduce((sum, r) => sum + (r.goals_progress || 0), 0) / filteredReviewsAll.length)
      : 0;
    return { averageRating: avg, avgGoalsProgress: goals };
  }, [filteredReviewsAll]);

  const topPerformers = useMemo(() => rankings.slice(0, 5), [rankings]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-medium">#{index + 1}</span>;
  };

  // ReviewFormDialog is now imported from @/components/performance/ReviewFormDialog

  // Employee view - simplified UI showing only their reviews
  if (isEmployee) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Performance Reviews</h1>
          <p className="text-muted-foreground">View your performance reviews and progress.</p>
        </div>

        {/* Employee Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Rating
              </CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Reviews
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{filteredReviewsAll.length}</div>
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
        </div>

        {/* My Reviews List */}
        <Card>
          <CardHeader>
            <CardTitle>My Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <NizaLoaderInline />
              </div>
            ) : filteredReviewsAll.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Star className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No reviews yet</h3>
                <p className="text-muted-foreground">Your performance reviews will appear here.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Goals Progress</TableHead>
                    <TableHead>Feedback</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviewsAll.map(review => (
                    <TableRow key={review.id}>
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
                      <TableCell className="max-w-xs truncate">
                        {review.feedback || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin/Manager/HR view
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
            <Button className="gap-2" onClick={() => { setReviewForm(initialReviewForm); setEditingReview(null); setShowAddReview(true); }}>
              <Plus className="h-4 w-4" />
              Add Review
            </Button>
            
            {(user?.role === 'super_admin' || user?.role === 'hr') && (
              <Dialog open={showAddCriteria} onOpenChange={setShowAddCriteria}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Manage Criteria
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Manage Performance Criteria</DialogTitle>
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
                        min="0.1"
                        value={newCriteria.weight}
                        onChange={(e) => setNewCriteria({ ...newCriteria, weight: parseFloat(e.target.value) })}
                      />
                    </div>
                    <Button onClick={handleAddCriteria} className="w-full" disabled={!newCriteria.name}>
                      Add Criteria
                    </Button>
                    
                    {criteria.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Existing Criteria</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {criteria.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div>
                                <p className="font-medium">{c.name}</p>
                                {c.description && (
                                  <p className="text-xs text-muted-foreground">{c.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">Weight: {c.weight}</Badge>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setCriteriaToDelete({ id: c.id, name: c.name });
                                    setShowDeleteCriteria(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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
          <Button variant="outline" className="gap-2" onClick={handleExportReport}>
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Add Review Dialog */}
      <ReviewFormDialog 
        isOpen={showAddReview} 
        onClose={() => { setShowAddReview(false); setReviewForm(initialReviewForm); }}
        reviewForm={reviewForm}
        onFormChange={setReviewForm}
        employees={employees}
        criteria={criteria}
        onSave={handleSaveReview}
      />

      {/* Edit Review Dialog */}
      <ReviewFormDialog 
        isOpen={showEditReview} 
        onClose={() => { setShowEditReview(false); setReviewForm(initialReviewForm); setEditingReview(null); }} 
        isEdit
        reviewForm={reviewForm}
        onFormChange={setReviewForm}
        employees={employees}
        criteria={criteria}
        onSave={handleSaveReview}
      />

      {/* Delete Review Confirmation */}
      <Dialog open={showDeleteReview} onOpenChange={setShowDeleteReview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Review</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the review for "{reviewToDelete?.employeeName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteReview(false); setReviewToDelete(null); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteReview}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Criteria Confirmation */}
      <Dialog open={showDeleteCriteria} onOpenChange={setShowDeleteCriteria}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Criteria</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{criteriaToDelete?.name}"? This will not affect existing reviews.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteCriteria(false); setCriteriaToDelete(null); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCriteria}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Mode Filters */}
      {user?.role === 'super_admin' && (
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
      )}

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
              Based on {filteredReviewsAll.length} reviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Reviews
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{filteredReviewsAll.length}</div>
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
              Out of {filteredEmployees.length} total
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
      <Card>
        <CardHeader>
          <CardTitle>All Reviews ({filteredReviews.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <NizaLoaderInline />
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No performance reviews</h3>
              <p className="text-muted-foreground mb-4">Create your first performance review to track employee progress</p>
              <Button onClick={() => setShowAddReview(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add First Review
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Goals Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditReview(review)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => {
                                setReviewToDelete({ 
                                  id: review.id, 
                                  employeeName: `${employee?.first_name} ${employee?.last_name}` 
                                });
                                setShowDeleteReview(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
