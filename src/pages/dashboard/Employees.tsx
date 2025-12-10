import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  UserPlus, Search, Upload, FileSignature, Users, Calendar, 
  UserCog, Settings, Briefcase, FileCheck 
} from 'lucide-react';
import EmployeeList from '@/components/employees/EmployeeList';
import TeamManagement from '@/components/employees/TeamManagement';
import AnnualLeaveBalance from '@/components/employees/AnnualLeaveBalance';
import OnboardingManagement from '@/components/onboarding/OnboardingManagement';
import ContractApprovalsTab from '@/components/employees/ContractApprovalsTab';
import ApprovedContractsTab from '@/components/employees/ApprovedContractsTab';
import BulkUploadDialog from '@/components/employees/BulkUploadDialog';
import UserManagement from '@/components/settings/UserManagement';
import OnboardingSettings from '@/components/employees/OnboardingSettings';
import { useAuth } from '@/contexts/AuthContext';

export default function Employees() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [activeTab, setActiveTab] = useState('employees');

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

  const handleBulkUploadSuccess = () => {
    setShowBulkUpload(false);
    setActiveTab('employees');
  };

  // Determine which tabs to show based on role
  const showContractApprovals = user?.role === 'super_admin';
  const showApprovedContracts = user?.role === 'super_admin' || user?.role === 'hr' || user?.role === 'manager';
  const showUserManagement = user?.role === 'super_admin';
  const showOnboardingSettings = user?.role === 'super_admin';

  // Calculate grid columns based on visible tabs
  const getTabsGridCols = () => {
    let count = 5; // Base: Employees, Onboarding, Teams, Leave, Users (always shown for super admin)
    if (showContractApprovals) count++;
    if (showOnboardingSettings) count++;
    return `grid-cols-${count}`;
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Employee Hub</h2>
          <p className="text-muted-foreground mt-1">
            Manage employees, onboarding, teams, users, and settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search employees..." 
              className="pl-10" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {user?.role === 'super_admin' && (
            <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
          )}
          <Button onClick={() => navigate('/dashboard/add-employee')}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start gap-1 h-auto flex-wrap">
          <TabsTrigger value="employees" className="gap-2">
            <Users className="h-4 w-4" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Onboarding
          </TabsTrigger>
          {showContractApprovals && (
            <TabsTrigger value="approvals" className="gap-2">
              <FileSignature className="h-4 w-4" />
              Contract Approvals
            </TabsTrigger>
          )}
          {showApprovedContracts && (
            <TabsTrigger value="approved-contracts" className="gap-2">
              <FileCheck className="h-4 w-4" />
              Approved Contracts
            </TabsTrigger>
          )}
          <TabsTrigger value="teams" className="gap-2">
            <Users className="h-4 w-4" />
            Teams
          </TabsTrigger>
          <TabsTrigger value="leave" className="gap-2">
            <Calendar className="h-4 w-4" />
            Annual Leave
          </TabsTrigger>
          {showUserManagement && (
            <TabsTrigger value="users" className="gap-2">
              <UserCog className="h-4 w-4" />
              User Management
            </TabsTrigger>
          )}
          {showOnboardingSettings && (
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Onboarding Settings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="employees" className="space-y-4 mt-6">
          <EmployeeList searchQuery={searchQuery} />
        </TabsContent>

        <TabsContent value="onboarding" className="mt-6">
          <OnboardingManagement />
        </TabsContent>

        {showContractApprovals && (
          <TabsContent value="approvals" className="mt-6">
            <ContractApprovalsTab />
          </TabsContent>
        )}

        {showApprovedContracts && (
          <TabsContent value="approved-contracts" className="mt-6">
            <ApprovedContractsTab />
          </TabsContent>
        )}

        <TabsContent value="teams" className="mt-6">
          <TeamManagement />
        </TabsContent>

        <TabsContent value="leave" className="mt-6">
          <AnnualLeaveBalance searchQuery={searchQuery} />
        </TabsContent>

        {showUserManagement && (
          <TabsContent value="users" className="mt-6">
            <UserManagement />
          </TabsContent>
        )}

        {showOnboardingSettings && (
          <TabsContent value="settings" className="mt-6">
            <OnboardingSettings />
          </TabsContent>
        )}
      </Tabs>

      <BulkUploadDialog 
        open={showBulkUpload} 
        onOpenChange={setShowBulkUpload}
        onSuccess={handleBulkUploadSuccess}
      />
    </div>
  );
}
