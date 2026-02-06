import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Plus, Users, Edit, Trash2, UserPlus, Loader2 } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Team {
  id: string;
  name: string;
  branch_id: string;
  team_leader_id: string | null;
  created_at: string;
  memberCount?: number;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  team_id: string | null;
}

export default function TeamManagement() {
  const { user } = useAuth();
  const { organizations } = useOrganizations();
  const { branches } = useBranches();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  
  // Form states
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamBranch, setNewTeamBranch] = useState('');
  
  // Employee assignment states
  const [branchEmployees, setBranchEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);

  // Fetch teams
  const fetchTeams = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('teams').select('*');
      
      // Apply branch filter for managers
      if (user?.role === 'manager' && user?.branchId) {
        query = query.eq('branch_id', user.branchId);
      } else if (user?.role === 'hr') {
        if (user?.hrAccessLevel === 'branch' && user?.branchId) {
          query = query.eq('branch_id', user.branchId);
        } else if (user?.hrAccessLevel === 'organization' && user?.organizationId) {
          const { data: orgBranches } = await supabase
            .from('branches')
            .select('id')
            .eq('organization_id', user.organizationId);
          
          if (orgBranches) {
            query = query.in('branch_id', orgBranches.map(b => b.id));
          }
        }
      }

      const { data, error } = await query.order('name');
      
      if (error) throw error;
      
      // Get member counts for each team
      const teamsWithCounts = await Promise.all((data || []).map(async (team) => {
        const { count } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id);
        
        return { ...team, memberCount: count || 0 };
      }));
      
      setTeams(teamsWithCounts);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [user]);

  const handleCreateTeam = async () => {
    if (!newTeamName || !newTeamBranch) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const { error } = await supabase.from('teams').insert({
        name: newTeamName,
        branch_id: newTeamBranch,
        created_by: user?.id
      });

      if (error) throw error;

      toast.success('Team created successfully');
      setIsCreateDialogOpen(false);
      setNewTeamName('');
      setNewTeamBranch('');
      fetchTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      toast.error('Failed to create team');
    }
  };

  const handleUpdateTeam = async () => {
    if (!selectedTeam || !newTeamName) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('teams')
        .update({ name: newTeamName })
        .eq('id', selectedTeam.id);

      if (error) throw error;

      toast.success('Team updated successfully');
      setIsEditDialogOpen(false);
      setSelectedTeam(null);
      setNewTeamName('');
      fetchTeams();
    } catch (error) {
      console.error('Error updating team:', error);
      toast.error('Failed to update team');
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? Employees will be unassigned.')) {
      return;
    }

    try {
      // First unassign all employees from this team
      await supabase
        .from('employees')
        .update({ team_id: null })
        .eq('team_id', teamId);

      // Then delete the team
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      toast.success('Team deleted successfully');
      fetchTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      toast.error('Failed to delete team');
    }
  };

  // Fetch employees for a branch when opening assign dialog
  const fetchBranchEmployees = async (branchId: string, teamId: string) => {
    setIsLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, team_id')
        .eq('branch_id', branchId)
        .order('first_name');

      if (error) throw error;

      setBranchEmployees(data || []);
      // Pre-select employees already in this team
      const alreadyAssigned = (data || [])
        .filter(emp => emp.team_id === teamId)
        .map(emp => emp.id);
      setSelectedEmployees(alreadyAssigned);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const handleOpenAssignDialog = (team: Team) => {
    setSelectedTeam(team);
    setEmployeeSearchTerm('');
    setIsAssignDialogOpen(true);
    fetchBranchEmployees(team.branch_id, team.id);
  };

  const handleSaveAssignments = async () => {
    if (!selectedTeam) return;
    
    setIsSavingAssignment(true);
    try {
      // Get employees currently in this team
      const currentlyAssigned = branchEmployees
        .filter(emp => emp.team_id === selectedTeam.id)
        .map(emp => emp.id);

      // Employees to add to team
      const toAdd = selectedEmployees.filter(id => !currentlyAssigned.includes(id));
      // Employees to remove from team
      const toRemove = currentlyAssigned.filter(id => !selectedEmployees.includes(id));

      // Add employees to team
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from('employees')
          .update({ team_id: selectedTeam.id })
          .in('id', toAdd);
        if (addError) throw addError;
      }

      // Remove employees from team
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('employees')
          .update({ team_id: null })
          .in('id', toRemove);
        if (removeError) throw removeError;
      }

      toast.success('Team assignments updated successfully');
      setIsAssignDialogOpen(false);
      fetchTeams();
    } catch (error) {
      console.error('Error saving assignments:', error);
      toast.error('Failed to save assignments');
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const selectAllEmployees = () => {
    setSelectedEmployees(filteredEmployees.map(emp => emp.id));
  };

  const deselectAllEmployees = () => {
    setSelectedEmployees([]);
  };

  const filteredEmployees = branchEmployees.filter(emp =>
    `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || 'Unknown Branch';
  };

  const getOrgName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return '';
    const org = organizations.find(o => o.id === branch.organization_id);
    return org?.name || '';
  };

  const filteredTeams = teams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = selectedBranch === 'all' || team.branch_id === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  // Get available branches for the user
  const availableBranches = branches.filter(branch => {
    if (user?.role === 'super_admin') return true;
    if (user?.role === 'manager') return branch.id === user?.branchId;
    if (user?.role === 'hr') {
      if (user?.hrAccessLevel === 'full') return true;
      if (user?.hrAccessLevel === 'organization') return branch.organization_id === user?.organizationId;
      if (user?.hrAccessLevel === 'branch') return branch.id === user?.branchId;
    }
    return false;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Team Management</h3>
          <p className="text-sm text-muted-foreground">Create and manage teams, assign employees</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Team
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {user?.role === 'super_admin' && (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-4">
        {filteredTeams.map((team) => (
          <Card key={team.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{team.name}</h4>
                    <Badge variant="secondary">{team.memberCount} members</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getOrgName(team.branch_id)} / {getBranchName(team.branch_id)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenAssignDialog(team)}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Assign
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTeam(team);
                    setNewTeamName(team.name);
                    setIsEditDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteTeam(team.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {filteredTeams.length === 0 && (
          <Card className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No teams found</p>
            <Button variant="outline" className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
              Create your first team
            </Button>
          </Card>
        )}
      </div>

      {/* Create Team Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input
                placeholder="e.g., Sales Team, Operations"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={newTeamBranch} onValueChange={setNewTeamBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {availableBranches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTeam}>Create Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateTeam}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Employees Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Employees to "{selectedTeam?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  className="pl-10"
                  value={employeeSearchTerm}
                  onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="link" size="sm" onClick={selectAllEmployees}>Select all</Button>
              <Button variant="link" size="sm" onClick={deselectAllEmployees}>Deselect all</Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Selected</span>
              <Badge>{selectedEmployees.length}</Badge>
              <span className="text-sm text-muted-foreground">of {branchEmployees.length} employees</span>
            </div>

            {isLoadingEmployees ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {branchEmployees.length === 0 
                  ? 'No employees found in this branch' 
                  : 'No employees match your search'}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {filteredEmployees.map((emp) => (
                  <Card
                    key={emp.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedEmployees.includes(emp.id)
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleEmployee(emp.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedEmployees.includes(emp.id)}
                        onCheckedChange={() => toggleEmployee(emp.id)}
                      />
                      <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                      {emp.team_id && emp.team_id !== selectedTeam?.id && (
                        <Badge variant="outline" className="ml-auto text-xs">
                          In another team
                        </Badge>
                      )}
                      {emp.team_id === selectedTeam?.id && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Current member
                        </Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAssignments} disabled={isSavingAssignment}>
              {isSavingAssignment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                `Save (${selectedEmployees.length})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
