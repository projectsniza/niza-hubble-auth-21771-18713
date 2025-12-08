import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UserPlus, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface EmployeeListProps {
  searchQuery: string;
}

export default function EmployeeList({ searchQuery }: EmployeeListProps) {
  const navigate = useNavigate();
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [statusFilter, setStatusFilter] = useState('all');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button className="gap-2">
          <UserPlus className="h-5 w-5" />
          Add employees
        </Button>
        
        <div className="flex gap-3">
          <div className="w-48">
            <Input placeholder="Name, job title" />
          </div>
          <Select value={filterBy} onValueChange={setFilterBy}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Filter by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="department">Department</SelectItem>
              <SelectItem value="role">Role</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">First name (A - Z)</SelectItem>
              <SelectItem value="joinDate">Join Date</SelectItem>
              <SelectItem value="department">Department</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No employees yet</h3>
            <p className="text-muted-foreground mb-4">Add your first employee to get started</p>
          </div>
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add First Employee
          </Button>
        </div>
      </Card>
    </div>
  );
}
