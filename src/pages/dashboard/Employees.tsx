import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Search } from 'lucide-react';
import EmployeeList from '@/components/employees/EmployeeList';
import ManageTeams from '@/components/employees/ManageTeams';

import AnnualLeaveBalance from '@/components/employees/AnnualLeaveBalance';
import OnboardingApprovals from '@/components/onboarding/OnboardingApprovals';
import OnboardingManagement from '@/components/onboarding/OnboardingManagement';
import { useAuth } from '@/contexts/AuthContext';

export default function Employees() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // If employee role, redirect to their own profile
    if (user?.role === 'employee') {
      navigate('/dashboard/my-profile');
    }
  }, [user, navigate]);

  // Only Super Admin, HR, and Manager can access employee management
  if (user?.role !== 'super_admin' && user?.role !== 'hr' && user?.role !== 'manager') {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">You don't have permission to access employee management</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">Employee Hub</h2>
        <div className="flex items-center gap-4">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search employees..." 
              className="pl-10" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {(user?.role === 'manager' || user?.role === 'hr' || user?.role === 'super_admin') && (
            <Button onClick={() => navigate('/dashboard/add-employee')}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="teams">Manage teams</TabsTrigger>
          <TabsTrigger value="leave">Annual leave balance</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <EmployeeList searchQuery={searchQuery} />
        </TabsContent>

        <TabsContent value="onboarding">
          {user?.role === 'super_admin' && <OnboardingApprovals />}
          {(user?.role === 'hr' || user?.role === 'manager') && <OnboardingManagement />}
        </TabsContent>

        <TabsContent value="teams">
          <ManageTeams />
        </TabsContent>

        <TabsContent value="leave">
          <AnnualLeaveBalance searchQuery={searchQuery} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
