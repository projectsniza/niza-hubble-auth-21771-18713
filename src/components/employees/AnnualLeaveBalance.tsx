import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, Users } from 'lucide-react';

interface AnnualLeaveBalanceProps {
  searchQuery: string;
}

export default function AnnualLeaveBalance({ searchQuery }: AnnualLeaveBalanceProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground">0% of leave unbooked</h3>
              <p className="text-muted-foreground">this leave year</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground">12 months remaining</h3>
              <p className="text-muted-foreground">this leave year</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <Input placeholder="Filter employees" className="mb-6" />
        
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No employees found</h3>
          <p className="text-muted-foreground">Add employees to track their annual leave balance</p>
        </div>
      </Card>
    </div>
  );
}
