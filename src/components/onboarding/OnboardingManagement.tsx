import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Building, ArrowRight, Plus } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { useAuth } from '@/contexts/AuthContext';
import EmployeeStatusBadge from '@/components/employees/EmployeeStatusBadge';

export default function OnboardingManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const filters: any = { status: 'onboarding' };
  
  if (user?.role === 'manager') {
    filters.branchId = user.branchId;
  } else if (user?.role === 'hr') {
    if (user.hrAccessLevel === 'branch') {
      filters.branchId = user.branchId;
    } else if (user.hrAccessLevel === 'organization') {
      filters.organizationId = user.organizationId;
    }
  }

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Include both onboarding and pending status employees
  const onboardingEmployees = employees.filter(e => 
    e.status === 'onboarding' || (e.status === 'pending' && e.onboarding?.[0]?.current_step > 0)
  );

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