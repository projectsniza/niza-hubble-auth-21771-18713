import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronRight, User } from 'lucide-react';

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Only Super Admin, HR, and Manager can view employee profiles
  if (user?.role === 'employee') {
    navigate('/dashboard/my-profile');
    return null;
  }

  if (user?.role !== 'super_admin' && user?.role !== 'hr' && user?.role !== 'manager') {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">You don't have permission to view employee profiles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="cursor-pointer hover:text-foreground" onClick={() => navigate('/dashboard')}>
          Home
        </span>
        <ChevronRight className="h-4 w-4" />
        <span className="cursor-pointer hover:text-foreground" onClick={() => navigate('/dashboard/employees')}>
          Employees
        </span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Employee Details</span>
      </div>

      <h1 className="text-3xl font-bold text-foreground">Employee Profile</h1>

      {/* Empty State */}
      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Employee not found</h3>
            <p className="text-muted-foreground mb-4">This employee profile doesn't exist or has been removed</p>
          </div>
          <Button onClick={() => navigate('/dashboard/employees')}>
            Back to Employees
          </Button>
        </div>
      </Card>
    </div>
  );
}
