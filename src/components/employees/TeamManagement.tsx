import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Users, Edit, Trash2, UserPlus, Loader2 } from 'lucide-react';
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                  onClick={() => {
                    setSelectedTeam(team);
                    setIsAssignDialogOpen(true);
                  }}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Employees to "{selectedTeam?.name}"</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground text-center py-8">
              Employee assignment functionality will be implemented with full employee data integration.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
