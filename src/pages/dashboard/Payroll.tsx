import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, DollarSign, Users, Clock } from 'lucide-react';

export default function Payroll() {
  const { user } = useAuth();

  // Employee View - Their own payslips
  if (user?.role === 'employee') {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">My Payslips</h1>
        
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No payslips available</h3>
              <p className="text-muted-foreground">Your payslips will appear here once processed</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Admin/HR/Manager View
  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Payroll Management</h2>
          <p className="text-muted-foreground mt-1">Process and manage employee payroll</p>
        </div>
        <Button className="gap-2">
          <Download className="h-4 w-4" />
          Export Payroll
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">£0</p>
              <p className="text-xs text-muted-foreground">Monthly Payroll</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-xs text-muted-foreground">Employees</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-xs text-muted-foreground">Payslips Generated</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-xs text-muted-foreground">Pending Reviews</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No payroll runs yet</h3>
            <p className="text-muted-foreground mb-4">Process your first payroll to see history here</p>
          </div>
          <Button className="gap-2">
            <DollarSign className="h-4 w-4" />
            Run Payroll
          </Button>
        </div>
      </Card>
    </div>
  );
}
