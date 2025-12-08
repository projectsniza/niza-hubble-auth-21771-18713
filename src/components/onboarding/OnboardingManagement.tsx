import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Building, Clock, CheckCircle, ArrowRight, Plus } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { useAuth } from '@/contexts/AuthContext';

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

  const getStepLabel = (step: number) => {
    const steps: Record<number, string> = {
      1: 'Basic Details', 2: 'Contract Upload', 3: 'Awaiting Approval',
      4: 'Collect Signature', 5: 'Right to Work', 6: 'Documents'
    };
    return steps[step] || 'Unknown';
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

  const onboardingEmployees = employees.filter(e => e.status === 'onboarding');

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

      {onboardingEmployees.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
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
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Step {currentStep}/6</span>
                      </div>
                      <Badge variant="secondary">{getStepLabel(currentStep)}</Badge>
                    </div>
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(currentStep / 6) * 100}%` }} />
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
