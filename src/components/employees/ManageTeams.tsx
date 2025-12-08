import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

const mockTeams = [
  { id: 1, name: 'Executive Team', members: 2 },
  { id: 2, name: 'HR Department', members: 3 },
  { id: 3, name: 'Retail Operations', members: 4 },
  { id: 4, name: 'Construction Team', members: 2 },
];

const mockEmployees = [
  { id: 1, name: 'chandran Manoharan', team: null },
  { id: 2, name: 'Ragunathan Visvanathan', team: null },
];

export default function ManageTeams() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);

  const handleAssignEmployees = (teamName: string) => {
    setSelectedTeam(teamName);
    setIsAssignDialogOpen(true);
  };

  const toggleEmployee = (empId: number) => {
    setSelectedEmployees(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button>Add a new team</Button>
        <Input
          placeholder="Team name"
          className="w-64"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-4">
        {mockTeams.map((team) => (
          <Card key={team.id} className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg text-foreground">{team.name}</h3>
                <p className="text-sm text-muted-foreground">{team.members} members</p>
              </div>
              <Button 
                variant="outline"
                onClick={() => handleAssignEmployees(team.name)}
              >
                Assign Employees
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign employees to "{selectedTeam}"</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Enter name" className="pl-10" />
              </div>
              <Button variant="link">Select all</Button>
              <Button variant="link">Deselect all</Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Selected</span>
                <Badge>{selectedEmployees.length}</Badge>
              </div>

              <div className="space-y-2">
                <div className="font-medium text-muted-foreground">
                  No group <Badge variant="secondary">{mockEmployees.length}</Badge>
                </div>
                <div className="flex gap-2 items-center mb-2">
                  <Button variant="link" size="sm">Select group</Button>
                  <Button variant="link" size="sm">Deselect group</Button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {mockEmployees.map((emp) => (
                    <Card
                      key={emp.id}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedEmployees.includes(emp.id)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleEmployee(emp.id)}
                    >
                      <p className="font-medium text-center">{emp.name}</p>
                    </Card>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Back
              </Button>
              <Button onClick={() => setIsAssignDialogOpen(false)}>
                Save ({selectedEmployees.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
