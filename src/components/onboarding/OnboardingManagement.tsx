import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Building, ArrowRight, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { useEmployees } from '@/hooks/useEmployees';
import { useAuth } from '@/contexts/AuthContext';
import EmployeeStatusBadge from '@/components/employees/EmployeeStatusBadge';

export default function OnboardingManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const filters = useMemo(() => {
    const f: any = { status: 'onboarding' };
    if (user?.role === 'manager') {
      f.branchId = user.branchId;
    } else if (user?.role === 'hr') {
      if (user.hrAccessLevel === 'branch') {
        f.branchId = user.branchId;
      } else if (user.hrAccessLevel === 'organization') {
        f.organizationId = user.organizationId;
      }
    }
    return f;
  }, [user?.role, user?.branchId, user?.hrAccessLevel, user?.organizationId]);

  const { employees, isLoading } = useEmployees(filters);

  const getStepLabel = (step: number, onboarding: any) => {
    // Enhanced status flow
    if (onboarding?.contract_submitted_for_approval && !onboarding?.contract_approved) {
      return 'Waiting for Super Admin Approval';
    }
    if (onboarding?.contract_approved && !onboarding?.contract_signed) {
      return 'Awaiting Signature';
    }
    if (onboarding?.contract_signed && !onboarding?.right_to_work_completed) {
      return 'Right to Work';
    }
    if (onboarding?.right_to_work_completed && !onboarding?.documents_uploaded) {
      return 'Document Upload';
    }
    
    const steps: Record<number, string> = {
      1: 'Basic Details',
      2: 'Custom Pages',
      3: 'Contract Creation',
      4: 'Submit for Approval',
      5: 'Right to Work',
      6: 'Document Upload'
    };
    return steps[step] || 'In Progress';
  };

  const getProgressPercentage = (step: number, onboarding: any) => {
    if (!onboarding) return (step / 8) * 100;
    
    let progress = step;
    if (onboarding.contract_submitted_for_approval) progress = 4;
    if (onboarding.contract_approved) progress = 5;
    if (onboarding.contract_signed) progress = 6;
    if (onboarding.right_to_work_completed) progress = 7;
    if (onboarding.documents_uploaded) progress = 8;
    
    return (progress / 8) * 100;
  };

  const getInitials = (firstName: string, lastName: string) => 
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <NizaLoaderInline />
      </div>
    );
  }

  // Include both onboarding and pending status employees, exclude approved contracts
  const onboardingEmployees = employees.filter(e => {
    const matchesStatus = e.status === 'onboarding' || (e.status === 'pending' && e.onboarding?.[0]?.current_step > 0);
    if (!matchesStatus) return false;
    // Exclude employees whose contract has been approved
    const onboarding = e.onboarding?.[0];
    if (onboarding?.contract_approved) return false;
    // Also exclude if contract_approvals status is 'approved'
    const contractApproval = e.contract_approval?.[0];
    if (contractApproval?.status === 'approved') return false;
    if (!searchQuery.trim()) return true;
    const fullName = `${e.first_name} ${e.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold mb-1">Onboarding in Progress</h2>
          <p className="text-muted-foreground">Continue the onboarding process for new employees</p>
        </div>
        <Button onClick={() => navigate('/dashboard/add-employee')}>
          <Plus className="h-4 w-4 mr-2" />
          Start New Onboarding
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Status Flow Legend */}
      <Card className="p-4 bg-muted/50">
        <p className="text-sm font-medium mb-2">Onboarding Flow:</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-gray-100 rounded">Pending</span>
          <span>→</span>
          <span className="px-2 py-1 bg-blue-100 rounded">In Progress</span>
          <span>→</span>
          <span className="px-2 py-1 bg-amber-100 rounded">Waiting for Approval</span>
          <span>→</span>
          <span className="px-2 py-1 bg-purple-100 rounded">Awaiting Signature</span>
          <span>→</span>
          <span className="px-2 py-1 bg-orange-100 rounded">Awaiting Documents</span>
          <span>→</span>
          <span className="px-2 py-1 bg-green-100 rounded">Completed</span>
        </div>
      </Card>

      {onboardingEmployees.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="h-12 w-12 mx-auto text-green-500 mb-4 flex items-center justify-center rounded-full bg-green-100">
            ✓
          </div>
          <h3 className="text-lg font-semibold mb-2">No pending onboarding</h3>
          <p className="text-muted-foreground mb-4">All employees have completed onboarding</p>
          <Button onClick={() => navigate('/dashboard/add-employee')}>Add New Employee</Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {onboardingEmployees.map((employee) => {
            const onboarding = employee.onboarding?.[0];
            const currentStep = onboarding?.current_step || 1;
            
            return (
              <Card key={employee.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(employee.first_name, employee.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-lg">{employee.first_name} {employee.last_name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building className="h-4 w-4" />
                        <span>{employee.branch?.name}</span>
                        <span>•</span>
                        <span>{employee.job_title || 'No title'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-muted-foreground">Current Step:</span>
                      </div>
                      <EmployeeStatusBadge status={employee.status || 'pending'} />
                    </div>
                    <div className="w-32">
                      <div className="text-xs text-muted-foreground mb-1 text-right">
                        {getStepLabel(currentStep, onboarding)}
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all" 
                          style={{ width: `${getProgressPercentage(currentStep, onboarding)}%` }} 
                        />
                      </div>
                    </div>
                    <Button onClick={() => navigate(`/dashboard/onboarding/${employee.id}`)}>
                      Continue <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}