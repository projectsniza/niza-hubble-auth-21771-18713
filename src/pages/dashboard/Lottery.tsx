import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, Download, Ticket, Calculator, Calendar, TrendingUp, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgBranch } from '@/contexts/OrgBranchContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, addMonths, subMonths } from 'date-fns';

interface LotteryGame {
  id: string;
  game_name: string;
  ticket_price: number;
  is_active: boolean;
  branch_id: string;
  organization_id: string | null;
}

interface DailyRecord {
  id: string;
  game_id: string;
  record_date: string;
  stock_begin: number;
  activated_tickets: number;
  stock_end: number | null;
  tickets_sold: number;
}

interface GameDailyData {
  [date: string]: {
    stockBegin: number;
    activatedTickets: number;
    stockEnd: number | null;
  };
}

export default function Lottery() {
  const { user } = useAuth();
  const { branches } = useOrgBranch();
  const queryClient = useQueryClient();
  
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [showAddGameDialog, setShowAddGameDialog] = useState(false);
  const [newGame, setNewGame] = useState({ name: '', ticketPrice: '1.00' });
  const [editingData, setEditingData] = useState<{ [gameId: string]: GameDailyData }>({});
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [physicalStock, setPhysicalStock] = useState<number | ''>('');
  
  const effectiveBranchId = user?.role === 'manager' ? user?.branchId : selectedBranchId;

  // Fetch lottery games for the branch
  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ['lottery-games', effectiveBranchId],
    queryFn: async () => {
      if (!effectiveBranchId) return [];
      const { data, error } = await supabase
        .from('lottery_games')
        .select('*')
        .eq('branch_id', effectiveBranchId)
        .eq('is_active', true)
        .order('game_name');
      if (error) throw error;
      return data as LotteryGame[];
    },
    enabled: !!effectiveBranchId,
  });

  // Fetch daily records for the month
  const { data: dailyRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['lottery-daily-records', effectiveBranchId, format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (!effectiveBranchId) return [];
      const startDate = format(selectedMonth, 'yyyy-MM-01');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('lottery_daily_records')
        .select('*')
        .eq('branch_id', effectiveBranchId)
        .gte('record_date', startDate)
        .lte('record_date', endDate);
      if (error) throw error;
      return data as DailyRecord[];
    },
    enabled: !!effectiveBranchId,
  });

  // Fetch monthly summary
  const { data: monthlySummary } = useQuery({
    queryKey: ['lottery-monthly-summary', effectiveBranchId, format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (!effectiveBranchId) return null;
      const { data, error } = await supabase
        .from('lottery_monthly_summaries')
        .select('*')
        .eq('branch_id', effectiveBranchId)
        .eq('month_year', format(selectedMonth, 'yyyy-MM-01'))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveBranchId,
  });

  // Get days of the month
  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: selectedMonth,
      end: endOfMonth(selectedMonth)
    });
  }, [selectedMonth]);

  // Organize records by game and date
  const recordsByGameAndDate = useMemo(() => {
    const map: { [gameId: string]: { [date: string]: DailyRecord } } = {};
    dailyRecords.forEach(record => {
      if (!map[record.game_id]) map[record.game_id] = {};
      map[record.game_id][record.record_date] = record;
    });
    return map;
  }, [dailyRecords]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalSalesValue = 0;
    let totalClosingStock = 0;

    games.forEach(game => {
      const gameRecords = recordsByGameAndDate[game.id] || {};
      let gameTotalTicketsSold = 0;
      let lastStockEnd = 0;

      daysInMonth.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const record = gameRecords[dateStr];
        if (record) {
          gameTotalTicketsSold += record.tickets_sold || 0;
          if (record.stock_end !== null) {
            lastStockEnd = record.stock_end;
          }
        }
      });

      totalSalesValue += gameTotalTicketsSold * game.ticket_price;
      totalClosingStock += lastStockEnd;
    });

    return { totalSalesValue, totalClosingStock };
  }, [games, recordsByGameAndDate, daysInMonth]);

  // Add game mutation
  const addGameMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveBranchId) throw new Error('No branch selected');
      
      // Get branch's organization
      const branch = branches.find(b => b.id === effectiveBranchId);
      
      const { error } = await supabase
        .from('lottery_games')
        .insert({
          game_name: newGame.name,
          ticket_price: parseFloat(newGame.ticketPrice),
          branch_id: effectiveBranchId,
          organization_id: branch?.organization_id,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lottery-games'] });
      setShowAddGameDialog(false);
      setNewGame({ name: '', ticketPrice: '1.00' });
      toast.success('Game added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add game: ' + error.message);
    },
  });

  // Save daily record mutation
  const saveRecordMutation = useMutation({
    mutationFn: async ({ gameId, date, stockBegin, activatedTickets, stockEnd }: {
      gameId: string;
      date: string;
      stockBegin: number;
      activatedTickets: number;
      stockEnd: number | null;
    }) => {
      if (!effectiveBranchId) throw new Error('No branch selected');
      
      const { error } = await supabase
        .from('lottery_daily_records')
        .upsert({
          game_id: gameId,
          branch_id: effectiveBranchId,
          record_date: date,
          stock_begin: stockBegin,
          activated_tickets: activatedTickets,
          stock_end: stockEnd,
          created_by: user?.id,
        }, {
          onConflict: 'game_id,record_date'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lottery-daily-records'] });
      toast.success('Record saved');
    },
    onError: (error) => {
      toast.error('Failed to save record: ' + error.message);
    },
  });

  // Delete game mutation
  const deleteGameMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const { error } = await supabase
        .from('lottery_games')
        .update({ is_active: false })
        .eq('id', gameId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lottery-games'] });
      toast.success('Game removed');
    },
  });

  // Save monthly summary mutation
  const saveMonthlySummaryMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveBranchId) throw new Error('No branch selected');
      
      const { error } = await supabase
        .from('lottery_monthly_summaries')
        .upsert({
          branch_id: effectiveBranchId,
          month_year: format(selectedMonth, 'yyyy-MM-01'),
          total_sales_value: totals.totalSalesValue,
          closing_stock_working: totals.totalClosingStock,
          closing_stock_physical: physicalStock === '' ? null : physicalStock,
          created_by: user?.id,
        }, {
          onConflict: 'branch_id,month_year'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lottery-monthly-summary'] });
      toast.success('Monthly summary saved');
    },
  });

  // Handle cell edit
  const handleCellEdit = (gameId: string, date: string, field: 'stockBegin' | 'activatedTickets' | 'stockEnd', value: string) => {
    const numValue = value === '' ? (field === 'stockEnd' ? null : 0) : parseInt(value) || 0;
    
    setEditingData(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [date]: {
          stockBegin: prev[gameId]?.[date]?.stockBegin ?? recordsByGameAndDate[gameId]?.[date]?.stock_begin ?? 0,
          activatedTickets: prev[gameId]?.[date]?.activatedTickets ?? recordsByGameAndDate[gameId]?.[date]?.activated_tickets ?? 0,
          stockEnd: prev[gameId]?.[date]?.stockEnd ?? recordsByGameAndDate[gameId]?.[date]?.stock_end ?? null,
          [field]: numValue,
        }
      }
    }));
  };

  // Save all edited data for a game
  const saveGameData = async (gameId: string) => {
    const gameData = editingData[gameId];
    if (!gameData) return;

    for (const [date, data] of Object.entries(gameData)) {
      await saveRecordMutation.mutateAsync({
        gameId,
        date,
        stockBegin: data.stockBegin,
        activatedTickets: data.activatedTickets,
        stockEnd: data.stockEnd,
      });
    }

    setEditingData(prev => {
      const newData = { ...prev };
      delete newData[gameId];
      return newData;
    });
  };

  // Calculate game row totals
  const getGameTotals = (gameId: string, game: LotteryGame) => {
    const gameRecords = recordsByGameAndDate[gameId] || {};
    const editedData = editingData[gameId] || {};
    
    let totalTicketsSold = 0;
    let initialStock = 0;
    let totalActivated = 0;
    
    daysInMonth.forEach((day, index) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const edited = editedData[dateStr];
      const record = gameRecords[dateStr];
      
      const stockBegin = edited?.stockBegin ?? record?.stock_begin ?? 0;
      const activatedTickets = edited?.activatedTickets ?? record?.activated_tickets ?? 0;
      const stockEnd = edited?.stockEnd ?? record?.stock_end;
      
      if (index === 0) {
        initialStock = stockBegin;
      }
      
      totalActivated += activatedTickets;
      
      const ticketsSold = stockBegin + activatedTickets - (stockEnd ?? 0);
      totalTicketsSold += Math.max(0, ticketsSold);
    });

    return {
      totalTicketsSold,
      totalSalesValue: totalTicketsSold * game.ticket_price,
      initialStock,
      totalActivated,
    };
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Game', 'Price', ...daysInMonth.map(d => format(d, 'dd')), 'Total Sold', 'Sales Value'];
    const rows = games.map(game => {
      const gameTotals = getGameTotals(game.id, game);
      const dailyData = daysInMonth.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const record = recordsByGameAndDate[game.id]?.[dateStr];
        return record?.tickets_sold || 0;
      });
      
      return [
        game.game_name,
        `£${game.ticket_price.toFixed(2)}`,
        ...dailyData,
        gameTotals.totalTicketsSold,
        `£${gameTotals.totalSalesValue.toFixed(2)}`,
      ];
    });

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lottery-reconciliation-${format(selectedMonth, 'yyyy-MM')}.csv`;
    a.click();
  };

  if (!user) return null;

  const canAccess = user.role === 'super_admin' || user.role === 'hr' || user.role === 'manager';
  if (!canAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">You don't have access to this feature.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily Lottery Reconciliation</h1>
          <p className="text-muted-foreground">Track scratchcard inventory and sales</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Branch selector for HR/Super Admin */}
          {(user?.role === 'super_admin' || user?.role === 'hr') && (
            <Select
              value={selectedBranchId || ''}
              onValueChange={(value) => setSelectedBranchId(value || null)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
            Previous
          </Button>
          <span className="font-medium px-4">{format(selectedMonth, 'MMMM yyyy')}</span>
          <Button variant="outline" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
            Next
          </Button>
        </div>
      </div>
      {/* No Branch Selected Message */}
      {!effectiveBranchId && (user?.role === 'super_admin' || user?.role === 'hr') && (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Ticket className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Select a Branch</h3>
              <p className="text-muted-foreground">Please select a branch from the dropdown above to view lottery data.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Summary Cards - Only show when branch is selected */}
      {effectiveBranchId && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Ticket className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Games</p>
                    <p className="text-2xl font-bold">{games.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Sales</p>
                    <p className="text-2xl font-bold">£{totals.totalSalesValue.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <Package className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Working Stock</p>
                    <p className="text-2xl font-bold">{totals.totalClosingStock}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <Calculator className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stock Difference</p>
                    <p className="text-2xl font-bold">
                      {monthlySummary ? totals.totalClosingStock - (monthlySummary.closing_stock_physical ?? 0) : '-'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Daily Records</TabsTrigger>
          <TabsTrigger value="summary">Monthly Summary</TabsTrigger>
          <TabsTrigger value="games">Manage Games</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Scratchcard Daily Tracking</CardTitle>
                <CardDescription>Enter daily stock and sales data for each game</CardDescription>
              </div>
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {gamesLoading || recordsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : games.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No games configured. Add your first game to start tracking.</p>
                  <Button onClick={() => setShowAddGameDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Game
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {games.map((game) => {
                    const gameTotals = getGameTotals(game.id, game);
                    const hasUnsavedChanges = !!editingData[game.id];
                    
                    return (
                      <div key={game.id} className="mb-8 border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold">{game.game_name}</h4>
                            <Badge variant="outline">£{game.ticket_price.toFixed(2)}</Badge>
                            {hasUnsavedChanges && (
                              <Badge variant="secondary">Unsaved changes</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-muted-foreground">
                              Total: {gameTotals.totalTicketsSold} sold = <strong>£{gameTotals.totalSalesValue.toFixed(2)}</strong>
                            </div>
                            {hasUnsavedChanges && (
                              <Button size="sm" onClick={() => saveGameData(game.id)}>
                                <Save className="h-4 w-4 mr-1" />
                                Save
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-32">Field</TableHead>
                              {daysInMonth.map(day => (
                                <TableHead key={day.toISOString()} className="text-center min-w-[60px]">
                                  {format(day, 'dd')}
                                </TableHead>
                              ))}
                              <TableHead className="text-center">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {/* Stock Begin Row */}
                            <TableRow>
                              <TableCell className="font-medium text-sm">Stock Begin</TableCell>
                              {daysInMonth.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const edited = editingData[game.id]?.[dateStr];
                                const record = recordsByGameAndDate[game.id]?.[dateStr];
                                const value = edited?.stockBegin ?? record?.stock_begin ?? '';
                                
                                return (
                                  <TableCell key={dateStr} className="p-1">
                                    <Input
                                      type="number"
                                      className="h-8 w-full text-center text-sm"
                                      value={value}
                                      onChange={(e) => handleCellEdit(game.id, dateStr, 'stockBegin', e.target.value)}
                                    />
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-medium">{gameTotals.initialStock}</TableCell>
                            </TableRow>
                            
                            {/* Activated Tickets Row */}
                            <TableRow>
                              <TableCell className="font-medium text-sm">Activated</TableCell>
                              {daysInMonth.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const edited = editingData[game.id]?.[dateStr];
                                const record = recordsByGameAndDate[game.id]?.[dateStr];
                                const value = edited?.activatedTickets ?? record?.activated_tickets ?? '';
                                
                                return (
                                  <TableCell key={dateStr} className="p-1">
                                    <Input
                                      type="number"
                                      className="h-8 w-full text-center text-sm"
                                      value={value}
                                      onChange={(e) => handleCellEdit(game.id, dateStr, 'activatedTickets', e.target.value)}
                                    />
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-medium">{gameTotals.totalActivated}</TableCell>
                            </TableRow>
                            
                            {/* Stock End Row */}
                            <TableRow>
                              <TableCell className="font-medium text-sm">Stock End</TableCell>
                              {daysInMonth.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const edited = editingData[game.id]?.[dateStr];
                                const record = recordsByGameAndDate[game.id]?.[dateStr];
                                const value = edited?.stockEnd ?? record?.stock_end ?? '';
                                
                                return (
                                  <TableCell key={dateStr} className="p-1">
                                    <Input
                                      type="number"
                                      className="h-8 w-full text-center text-sm"
                                      value={value === null ? '' : value}
                                      onChange={(e) => handleCellEdit(game.id, dateStr, 'stockEnd', e.target.value)}
                                    />
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-medium">-</TableCell>
                            </TableRow>
                            
                            {/* Tickets Sold Row (calculated) */}
                            <TableRow className="bg-muted/50">
                              <TableCell className="font-medium text-sm">Tickets Sold</TableCell>
                              {daysInMonth.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const edited = editingData[game.id]?.[dateStr];
                                const record = recordsByGameAndDate[game.id]?.[dateStr];
                                
                                const stockBegin = edited?.stockBegin ?? record?.stock_begin ?? 0;
                                const activated = edited?.activatedTickets ?? record?.activated_tickets ?? 0;
                                const stockEnd = edited?.stockEnd ?? record?.stock_end ?? 0;
                                const sold = Math.max(0, stockBegin + activated - stockEnd);
                                
                                return (
                                  <TableCell key={dateStr} className="text-center font-medium text-sm">
                                    {stockBegin || activated || stockEnd ? sold : '-'}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-bold">{gameTotals.totalTicketsSold}</TableCell>
                            </TableRow>
                            
                            {/* Sales Value Row (calculated) */}
                            <TableRow className="bg-green-50 dark:bg-green-950/20">
                              <TableCell className="font-medium text-sm">Sales Value</TableCell>
                              {daysInMonth.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const edited = editingData[game.id]?.[dateStr];
                                const record = recordsByGameAndDate[game.id]?.[dateStr];
                                
                                const stockBegin = edited?.stockBegin ?? record?.stock_begin ?? 0;
                                const activated = edited?.activatedTickets ?? record?.activated_tickets ?? 0;
                                const stockEnd = edited?.stockEnd ?? record?.stock_end ?? 0;
                                const sold = Math.max(0, stockBegin + activated - stockEnd);
                                const value = sold * game.ticket_price;
                                
                                return (
                                  <TableCell key={dateStr} className="text-center text-sm">
                                    {stockBegin || activated || stockEnd ? `£${value.toFixed(2)}` : '-'}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-bold text-green-600">
                                £{gameTotals.totalSalesValue.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Summary - {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
              <CardDescription>Review totals and enter physical stock count</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <Label className="text-sm text-muted-foreground">Total Instant Lottery Sales</Label>
                    <p className="text-3xl font-bold text-green-600">£{totals.totalSalesValue.toFixed(2)}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <Label className="text-sm text-muted-foreground">Closing Stock (As per Working)</Label>
                    <p className="text-3xl font-bold">{totals.totalClosingStock}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg space-y-3">
                    <Label>Closing Stock (Physical Count)</Label>
                    <Input
                      type="number"
                      placeholder="Enter physical stock count"
                      value={physicalStock}
                      onChange={(e) => setPhysicalStock(e.target.value === '' ? '' : parseInt(e.target.value))}
                    />
                  </div>
                  <div className="p-4 border rounded-lg">
                    <Label className="text-sm text-muted-foreground">Stock Difference</Label>
                    <p className={`text-3xl font-bold ${
                      physicalStock !== '' && totals.totalClosingStock - physicalStock !== 0 
                        ? 'text-destructive' 
                        : ''
                    }`}>
                      {physicalStock !== '' ? totals.totalClosingStock - physicalStock : '-'}
                    </p>
                    {physicalStock !== '' && totals.totalClosingStock - physicalStock !== 0 && (
                      <p className="text-sm text-destructive mt-1">
                        {totals.totalClosingStock - physicalStock > 0 ? 'Missing tickets' : 'Extra tickets'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <Button onClick={() => saveMonthlySummaryMutation.mutate()} disabled={saveMonthlySummaryMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Monthly Summary
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="games" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Manage Scratchcard Games</CardTitle>
                <CardDescription>Add or remove games from your lottery tracking</CardDescription>
              </div>
              <Button onClick={() => setShowAddGameDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Game
              </Button>
            </CardHeader>
            <CardContent>
              {games.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No games configured yet. Add your first game to start tracking lottery sales.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Game Name</TableHead>
                      <TableHead>Ticket Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {games.map((game) => (
                      <TableRow key={game.id}>
                        <TableCell className="font-medium">{game.game_name}</TableCell>
                        <TableCell>£{game.ticket_price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={game.is_active ? 'default' : 'secondary'}>
                            {game.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteGameMutation.mutate(game.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </>
      )}

      {/* Add Game Dialog */}
      <Dialog open={showAddGameDialog} onOpenChange={setShowAddGameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Scratchcard Game</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Game Name *</Label>
              <Input
                placeholder="e.g., Lucky 7s, Diamond Fortune"
                value={newGame.name}
                onChange={(e) => setNewGame(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Ticket Price (£) *</Label>
              <Select
                value={newGame.ticketPrice}
                onValueChange={(value) => setNewGame(prev => ({ ...prev, ticketPrice: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.00">£1.00</SelectItem>
                  <SelectItem value="2.00">£2.00</SelectItem>
                  <SelectItem value="3.00">£3.00</SelectItem>
                  <SelectItem value="5.00">£5.00</SelectItem>
                  <SelectItem value="10.00">£10.00</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGameDialog(false)}>Cancel</Button>
            <Button onClick={() => addGameMutation.mutate()} disabled={!newGame.name || addGameMutation.isPending}>
              Add Game
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
