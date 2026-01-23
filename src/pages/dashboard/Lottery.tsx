import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, Trash2, Save, Download, Ticket, Calculator, Calendar, TrendingUp, 
  Package, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, X, Edit2,
  LayoutGrid, CalendarDays, FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgBranch } from '@/contexts/OrgBranchContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, addDays, subDays, isToday } from 'date-fns';

// Types
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
  tickets_sold: number | null;
}

interface GameDailyData {
  stockBegin: number;
  activatedTickets: number;
  stockEnd: number | null;
}

interface EditingState {
  [gameId: string]: {
    [date: string]: GameDailyData;
  };
}

// Sheet types for the two Excel formats
type SheetType = 'monthly' | 'daily';

// Sub-components for cleaner code
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  iconColor = 'text-primary',
  iconBg = 'bg-primary/10',
  valueColor = ''
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconColor?: string;
  iconBg?: string;
  valueColor?: string;
}) => (
  <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/80">
    <CardContent className="p-5">
      <div className="flex items-center gap-4">
        <div className={`p-3.5 ${iconBg} rounded-xl shadow-sm`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function Lottery() {
  const { user } = useAuth();
  const { organizations, branches } = useOrgBranch();
  const queryClient = useQueryClient();
  
  // Sheet selection state
  const [activeSheet, setActiveSheet] = useState<SheetType>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date()); // For daily view
  const [showAddGameDialog, setShowAddGameDialog] = useState(false);
  const [showEditGameDialog, setShowEditGameDialog] = useState(false);
  const [editingGame, setEditingGame] = useState<LotteryGame | null>(null);
  const [newGame, setNewGame] = useState({ name: '', ticketPrice: '1' });
  const [editingData, setEditingData] = useState<EditingState>({});
  const [physicalStock, setPhysicalStock] = useState<{ [date: string]: number | '' }>({});
  const [activeTab, setActiveTab] = useState<'records' | 'summary' | 'games'>('records');
  
  // Org/Branch filter state
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  // For managers, lock to their branch
  const isManager = user?.role === 'manager';
  const effectiveBranchId = isManager ? user?.branchId : (viewMode === 'branch' && selectedBranch ? selectedBranch : null);
  const effectiveOrgId = viewMode === 'organization' && selectedOrg ? selectedOrg : null;
  
  // Check if editing is allowed (only when single branch is selected)
  const isSingleBranchSelected = isManager || (viewMode === 'branch' && !!selectedBranch);
  
  // Get filtered branch IDs for "all" or "organization" mode
  const filteredBranchIds = useMemo(() => {
    if (isManager) return user?.branchId ? [user.branchId] : [];
    if (viewMode === 'branch' && selectedBranch) return [selectedBranch];
    if (viewMode === 'organization' && selectedOrg) {
      return branches.filter(b => b.organization_id === selectedOrg).map(b => b.id);
    }
    // "all" mode - return all branch IDs
    return branches.map(b => b.id);
  }, [isManager, user?.branchId, viewMode, selectedBranch, selectedOrg, branches]);

  // Get days of the month
  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: selectedMonth,
      end: endOfMonth(selectedMonth)
    });
  }, [selectedMonth]);

  // Fetch lottery games for the selected scope
  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ['lottery-games', filteredBranchIds, viewMode],
    queryFn: async () => {
      if (filteredBranchIds.length === 0) return [];
      const { data, error } = await supabase
        .from('lottery_games')
        .select('*')
        .in('branch_id', filteredBranchIds)
        .eq('is_active', true)
        .order('game_name');
      if (error) throw error;
      return data as LotteryGame[];
    },
    enabled: filteredBranchIds.length > 0,
  });

  // Fetch daily records for the month
  const { data: dailyRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['lottery-daily-records', filteredBranchIds, viewMode, format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (filteredBranchIds.length === 0) return [];
      const startDate = format(selectedMonth, 'yyyy-MM-01');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('lottery_daily_records')
        .select('*')
        .in('branch_id', filteredBranchIds)
        .gte('record_date', startDate)
        .lte('record_date', endDate);
      if (error) throw error;
      return data as DailyRecord[];
    },
    enabled: filteredBranchIds.length > 0,
  });

  // Fetch monthly summary (only when single branch is selected)
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

  // Organize records by game and date
  const recordsByGameAndDate = useMemo(() => {
    const map: { [gameId: string]: { [date: string]: DailyRecord } } = {};
    dailyRecords.forEach(record => {
      if (!map[record.game_id]) map[record.game_id] = {};
      map[record.game_id][record.record_date] = record;
    });
    return map;
  }, [dailyRecords]);

  // Get value for a cell (edited or from DB)
  const getCellValue = useCallback((gameId: string, dateStr: string, field: keyof GameDailyData) => {
    const edited = editingData[gameId]?.[dateStr];
    const record = recordsByGameAndDate[gameId]?.[dateStr];
    
    if (edited && edited[field] !== undefined) {
      return edited[field];
    }
    
    switch (field) {
      case 'stockBegin': return record?.stock_begin ?? null;
      case 'activatedTickets': return record?.activated_tickets ?? null;
      case 'stockEnd': return record?.stock_end ?? null;
      default: return null;
    }
  }, [editingData, recordsByGameAndDate]);

  // Calculate derived values for a day
  const getDayCalculations = useCallback((gameId: string, dateStr: string, game: LotteryGame) => {
    const stockBegin = getCellValue(gameId, dateStr, 'stockBegin') ?? 0;
    const activated = getCellValue(gameId, dateStr, 'activatedTickets') ?? 0;
    const stockEnd = getCellValue(gameId, dateStr, 'stockEnd');
    
    // Total = Stock Begin + Activated
    const totalStock = stockBegin + activated;
    
    // Tickets Sold = Stock Begin + Activated - Stock End
    // Only calculate if stock_end is entered
    const ticketsSold = stockEnd !== null ? Math.max(0, totalStock - stockEnd) : null;
    
    // Sales Value = Tickets Sold × Ticket Price
    const salesValue = ticketsSold !== null ? ticketsSold * game.ticket_price : null;
    
    return { stockBegin, activated, totalStock, stockEnd, ticketsSold, salesValue };
  }, [getCellValue]);

  // Calculate game totals across all days
  const getGameTotals = useCallback((gameId: string, game: LotteryGame) => {
    let totalTicketsSold = 0;
    let totalSalesValue = 0;
    let initialStock = 0;
    let totalActivated = 0;
    let lastStockEnd = 0;
    let hasData = false;
    
    daysInMonth.forEach((day, index) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const calc = getDayCalculations(gameId, dateStr, game);
      
      if (calc.stockBegin || calc.activated || calc.stockEnd !== null) {
        hasData = true;
      }
      
      if (index === 0 && calc.stockBegin) {
        initialStock = calc.stockBegin;
      }
      
      totalActivated += calc.activated;
      
      if (calc.ticketsSold !== null) {
        totalTicketsSold += calc.ticketsSold;
      }
      
      if (calc.stockEnd !== null) {
        lastStockEnd = calc.stockEnd;
      }
    });
    
    totalSalesValue = totalTicketsSold * game.ticket_price;
    
    return {
      initialStock,
      totalActivated,
      totalTicketsSold,
      totalSalesValue,
      closingStock: lastStockEnd,
      hasData
    };
  }, [daysInMonth, getDayCalculations]);

  // Calculate grand totals across all games
  const grandTotals = useMemo(() => {
    let totalSalesValue = 0;
    let totalClosingStock = 0;
    
    games.forEach(game => {
      const gameTotals = getGameTotals(game.id, game);
      totalSalesValue += gameTotals.totalSalesValue;
      totalClosingStock += gameTotals.closingStock;
    });
    
    return { totalSalesValue, totalClosingStock };
  }, [games, getGameTotals]);

  // Calculate daily totals across all games for the summary section
  const dailyTotals = useMemo(() => {
    const totals: { [date: string]: { closingStock: number; salesValue: number } } = {};
    
    daysInMonth.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      let dayClosingStock = 0;
      let daySalesValue = 0;
      
      games.forEach(game => {
        const calc = getDayCalculations(game.id, dateStr, game);
        if (calc.stockEnd !== null) {
          dayClosingStock += calc.stockEnd;
        }
        if (calc.salesValue !== null) {
          daySalesValue += calc.salesValue;
        }
      });
      
      totals[dateStr] = { closingStock: dayClosingStock, salesValue: daySalesValue };
    });
    
    return totals;
  }, [daysInMonth, games, getDayCalculations]);

  // Add game mutation
  const addGameMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveBranchId) throw new Error('No branch selected');
      const branch = branches.find(b => b.id === effectiveBranchId);
      
      const { error } = await supabase
        .from('lottery_games')
        .insert({
          game_name: newGame.name.trim(),
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
      setNewGame({ name: '', ticketPrice: '1' });
      toast.success('Game added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add game: ' + error.message);
    },
  });

  // Update game mutation
  const updateGameMutation = useMutation({
    mutationFn: async () => {
      if (!editingGame) throw new Error('No game selected');
      
      const { error } = await supabase
        .from('lottery_games')
        .update({
          game_name: newGame.name.trim(),
          ticket_price: parseFloat(newGame.ticketPrice),
        })
        .eq('id', editingGame.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lottery-games'] });
      setShowEditGameDialog(false);
      setEditingGame(null);
      setNewGame({ name: '', ticketPrice: '1' });
      toast.success('Game updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update game: ' + error.message);
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
      
      // Note: tickets_sold is a generated column in the database, calculated automatically
      // Formula: tickets_sold = GREATEST(0, stock_begin + activated_tickets - COALESCE(stock_end, 0))
      
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
    },
    onError: (error) => {
      toast.error('Failed to save: ' + error.message);
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
      
      const lastDayPhysical = physicalStock[format(endOfMonth(selectedMonth), 'yyyy-MM-dd')];
      
      const { error } = await supabase
        .from('lottery_monthly_summaries')
        .upsert({
          branch_id: effectiveBranchId,
          month_year: format(selectedMonth, 'yyyy-MM-01'),
          total_sales_value: grandTotals.totalSalesValue,
          closing_stock_working: grandTotals.totalClosingStock,
          closing_stock_physical: lastDayPhysical === '' ? null : lastDayPhysical,
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
  const handleCellEdit = useCallback((
    gameId: string, 
    date: string, 
    field: keyof GameDailyData, 
    value: string
  ) => {
    const numValue = value === '' ? null : parseInt(value) || 0;
    
    setEditingData(prev => {
      const record = recordsByGameAndDate[gameId]?.[date];
      const existing = prev[gameId]?.[date];
      
      return {
        ...prev,
        [gameId]: {
          ...prev[gameId],
          [date]: {
            stockBegin: existing?.stockBegin ?? record?.stock_begin ?? 0,
            activatedTickets: existing?.activatedTickets ?? record?.activated_tickets ?? 0,
            stockEnd: existing?.stockEnd ?? record?.stock_end ?? null,
            [field]: numValue,
          }
        }
      };
    });
  }, [recordsByGameAndDate]);

  // Save all edited data for a game
  const saveGameData = async (gameId: string) => {
    const gameData = editingData[gameId];
    if (!gameData) return;

    try {
      for (const [date, data] of Object.entries(gameData)) {
        await saveRecordMutation.mutateAsync({
          gameId,
          date,
          stockBegin: data.stockBegin ?? 0,
          activatedTickets: data.activatedTickets ?? 0,
          stockEnd: data.stockEnd,
        });
      }

      setEditingData(prev => {
        const newData = { ...prev };
        delete newData[gameId];
        return newData;
      });
      
      toast.success('Data saved successfully');
    } catch {
      // Error already handled in mutation
    }
  };

  // Export to CSV - Excel-like format
  const exportToCSV = () => {
    const monthStr = format(selectedMonth, 'MMMM yyyy');
    const branchName = branches.find(b => b.id === effectiveBranchId)?.name || 'Branch';
    
    const lines: string[] = [];
    lines.push('Niza Group of Companies');
    lines.push('Daily Lottery Reconciliation Form');
    lines.push(`For the month of ${monthStr}`);
    lines.push(`Branch: ${branchName}`);
    lines.push('');
    
    // Headers
    const dateHeaders = daysInMonth.map(d => format(d, 'dd/MM'));
    lines.push(['', 'Scratchcards', '', '', ...dateHeaders, 'Total'].join(','));
    lines.push('');
    
    games.forEach(game => {
      const gameTotals = getGameTotals(game.id, game);
      
      // Stock Begin row
      const stockBeginValues = daysInMonth.map(day => {
        const val = getCellValue(game.id, format(day, 'yyyy-MM-dd'), 'stockBegin');
        return val ?? '-';
      });
      lines.push(['', game.game_name, '', 'Instant Stock to begin', ...stockBeginValues, gameTotals.initialStock].join(','));
      
      // Activated row
      const activatedValues = daysInMonth.map(day => {
        const val = getCellValue(game.id, format(day, 'yyyy-MM-dd'), 'activatedTickets');
        return val ?? '-';
      });
      lines.push(['', '', '', 'Activated Tickets', ...activatedValues, gameTotals.totalActivated].join(','));
      
      // Total row
      const totalValues = daysInMonth.map(day => {
        const calc = getDayCalculations(game.id, format(day, 'yyyy-MM-dd'), game);
        return calc.totalStock || '-';
      });
      lines.push(['', '', '', 'Total', ...totalValues, gameTotals.initialStock + gameTotals.totalActivated].join(','));
      
      // Stock End row
      const stockEndValues = daysInMonth.map(day => {
        const val = getCellValue(game.id, format(day, 'yyyy-MM-dd'), 'stockEnd');
        return val ?? '-';
      });
      lines.push(['', '', '', 'Instant Stock End', ...stockEndValues, gameTotals.closingStock].join(','));
      
      // Tickets Sold row
      const soldValues = daysInMonth.map(day => {
        const calc = getDayCalculations(game.id, format(day, 'yyyy-MM-dd'), game);
        return calc.ticketsSold ?? '-';
      });
      lines.push(['', '', `£${game.ticket_price}`, 'No of Tickets Sold', ...soldValues, gameTotals.totalTicketsSold].join(','));
      
      // Sales Value row
      const salesValues = daysInMonth.map(day => {
        const calc = getDayCalculations(game.id, format(day, 'yyyy-MM-dd'), game);
        return calc.salesValue !== null ? `£${calc.salesValue.toFixed(2)}` : '-';
      });
      lines.push(['', '', '', 'Tickets Sale Value', ...salesValues, `£${gameTotals.totalSalesValue.toFixed(2)}`].join(','));
      
      lines.push('');
    });
    
    // Summary
    lines.push('');
    lines.push(['', 'Total Instant Lottery Sales', '', '', ...Array(daysInMonth.length).fill(''), `£${grandTotals.totalSalesValue.toFixed(2)}`].join(','));
    lines.push('');
    
    // Daily closing stocks
    const dailyClosingStocks = daysInMonth.map(day => dailyTotals[format(day, 'yyyy-MM-dd')]?.closingStock || '-');
    lines.push(['', 'Closing Instant Lottery Stock -- As per the Working', '', '', ...dailyClosingStocks, grandTotals.totalClosingStock].join(','));
    
    // Physical stock
    const physicalStockValues = daysInMonth.map(day => {
      const val = physicalStock[format(day, 'yyyy-MM-dd')];
      return val !== undefined && val !== '' ? val : '-';
    });
    lines.push(['', 'Closing Instant Lottery Stock -- Physically (Number of Tickets)', '', '', ...physicalStockValues, ''].join(','));
    
    // Differences
    const differenceValues = daysInMonth.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const working = dailyTotals[dateStr]?.closingStock || 0;
      const physical = physicalStock[dateStr];
      if (physical !== undefined && physical !== '') {
        return working - physical;
      }
      return '-';
    });
    lines.push(['', 'Differences', '', '', ...differenceValues, ''].join(','));
    
    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lottery-reconciliation-${format(selectedMonth, 'yyyy-MM')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Open edit game dialog
  const openEditGame = (game: LotteryGame) => {
    setEditingGame(game);
    setNewGame({ name: game.game_name, ticketPrice: game.ticket_price.toString() });
    setShowEditGameDialog(true);
  };

  if (!user) return null;

  const canAccess = user.role === 'super_admin' || user.role === 'hr' || user.role === 'manager';
  if (!canAccess) {
    return (
      <div className="p-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <X className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">You don't have permission to access this feature.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = gamesLoading || recordsLoading;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Daily Lottery Reconciliation
          </h1>
          <p className="text-muted-foreground mt-1">Track scratchcard inventory, sales, and reconciliation</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Month Navigation */}
          <div className="flex items-center gap-1 bg-card rounded-xl p-1 shadow-sm border border-primary/10">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9 rounded-lg hover:bg-primary/10"
              onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-4 py-2 min-w-[140px] text-center">
              <span className="font-semibold">{format(selectedMonth, 'MMMM yyyy')}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9 rounded-lg hover:bg-primary/10"
              onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
              disabled={isSameMonth(selectedMonth, new Date())}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Org/Branch Filter for Super Admin/HR */}
      {!isManager && (
        <OrgBranchFilter
          organizations={organizations}
          branches={branches}
          viewMode={viewMode}
          selectedOrg={selectedOrg}
          selectedBranch={selectedBranch}
          onViewModeChange={setViewMode}
          onOrgChange={setSelectedOrg}
          onBranchChange={setSelectedBranch}
        />
      )}

      {filteredBranchIds.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              icon={Ticket} 
              label="Active Games" 
              value={games.length}
              iconColor="text-primary"
              iconBg="bg-primary/10"
            />
            <StatCard 
              icon={TrendingUp} 
              label="Total Sales" 
              value={`£${grandTotals.totalSalesValue.toFixed(2)}`}
              iconColor="text-green-600"
              iconBg="bg-green-500/10"
              valueColor="text-green-600"
            />
            <StatCard 
              icon={Package} 
              label="Working Stock" 
              value={grandTotals.totalClosingStock}
              iconColor="text-blue-600"
              iconBg="bg-blue-500/10"
            />
            <StatCard 
              icon={Calculator} 
              label="Stock Difference" 
              value={monthlySummary?.closing_stock_physical !== null 
                ? grandTotals.totalClosingStock - (monthlySummary?.closing_stock_physical ?? 0)
                : '—'}
              iconColor={monthlySummary?.stock_difference !== 0 ? 'text-amber-600' : 'text-green-600'}
              iconBg={monthlySummary?.stock_difference !== 0 ? 'bg-amber-500/10' : 'bg-green-500/10'}
            />
          </div>

          {/* Sheet Type Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2 p-1 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl shadow-sm border border-primary/20">
              <Button
                variant={activeSheet === 'monthly' ? 'default' : 'ghost'}
                size="sm"
                className={`gap-2 rounded-lg ${activeSheet === 'monthly' ? '' : 'hover:bg-card'}`}
                onClick={() => setActiveSheet('monthly')}
              >
                <LayoutGrid className="h-4 w-4" />
                <span>Sheet 1: Monthly</span>
              </Button>
              <Button
                variant={activeSheet === 'daily' ? 'default' : 'ghost'}
                size="sm"
                className={`gap-2 rounded-lg ${activeSheet === 'daily' ? '' : 'hover:bg-card'}`}
                onClick={() => setActiveSheet('daily')}
              >
                <CalendarDays className="h-4 w-4" />
                <span>Sheet 2: Daily</span>
              </Button>
            </div>

            {/* Sub-tabs for each sheet */}
            <div className="flex items-center gap-2 p-1 bg-card rounded-xl shadow-sm border border-primary/10 w-fit">
              {[
                { id: 'records', label: activeSheet === 'monthly' ? 'Monthly Records' : 'Daily Entry', icon: FileSpreadsheet },
                { id: 'summary', label: 'Summary', icon: Calculator },
                { id: 'games', label: 'Manage Games', icon: Ticket },
              ].map(tab => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'ghost'}
                  size="sm"
                  className={`gap-2 rounded-lg ${activeTab === tab.id ? '' : 'hover:bg-primary/10'}`}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* SHEET 1: MONTHLY RECONCILIATION - Records Tab */}
          {activeSheet === 'monthly' && activeTab === 'records' && (
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">Scratchcard Daily Tracking</CardTitle>
                    <CardDescription>Enter daily stock and sales data for each game</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                    {isSingleBranchSelected && (
                      <Button size="sm" onClick={() => setShowAddGameDialog(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Game
                      </Button>
                    )}
                  </div>
                </div>
                {!isSingleBranchSelected && (
                  <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-700 dark:text-amber-400">
                      Select a specific branch to add/edit games and records
                    </span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : games.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                      <Ticket className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Games Configured</h3>
                    <p className="text-muted-foreground mb-4">
                      {isSingleBranchSelected ? 'Add your first scratchcard game to start tracking.' : 'Select a specific branch to manage games.'}
                    </p>
                    {isSingleBranchSelected && (
                      <Button onClick={() => setShowAddGameDialog(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add First Game
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y">
                    {games.map((game) => {
                      const gameTotals = getGameTotals(game.id, game);
                      const hasUnsavedChanges = !!editingData[game.id];
                      
                      return (
                        <div key={game.id} className="p-4">
                          {/* Game Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shadow-lg">
                                £{game.ticket_price}
                              </div>
                              <div>
                                <h4 className="font-semibold text-lg">{game.game_name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {gameTotals.totalTicketsSold} tickets sold
                                </p>
                              </div>
                              {hasUnsavedChanges && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Unsaved
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-2xl font-bold text-green-600">
                                  £{gameTotals.totalSalesValue.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">Total Sales</p>
                              </div>
                              {hasUnsavedChanges && isSingleBranchSelected && (
                                <Button 
                                  size="sm" 
                                  onClick={() => saveGameData(game.id)}
                                  className="gap-2"
                                >
                                  <Save className="h-4 w-4" />
                                  Save
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {/* Excel-like Grid */}
                          <ScrollArea className="w-full">
                            <div className="min-w-max">
                              <table className="w-full border-collapse text-sm">
                                <thead>
                                  <tr className="bg-muted/50">
                                    <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-semibold min-w-[140px] border-r">
                                      Field
                                    </th>
                                    {daysInMonth.map(day => (
                                      <th key={day.toISOString()} className="px-1 py-2 text-center font-medium min-w-[56px] border-r border-b">
                                        <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                                        <div className="font-semibold">{format(day, 'dd')}</div>
                                      </th>
                                    ))}
                                    <th className="px-3 py-2 text-center font-semibold min-w-[80px] bg-primary/5">
                                      Total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Instant Stock to Begin */}
                                  <tr className="border-b hover:bg-muted/30">
                                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium border-r">
                                      Instant Stock to begin
                                    </td>
                                    {daysInMonth.map(day => {
                                      const dateStr = format(day, 'yyyy-MM-dd');
                                      const value = getCellValue(game.id, dateStr, 'stockBegin');
                                      return (
                                        <td key={dateStr} className="px-0.5 py-0.5 border-r">
                                          <Input
                                            type="number"
                                            className="h-8 w-full text-center text-sm border-0 bg-transparent hover:bg-muted/50 focus:bg-card"
                                            value={value ?? ''}
                                            onChange={(e) => handleCellEdit(game.id, dateStr, 'stockBegin', e.target.value)}
                                            placeholder="-"
                                            disabled={!isSingleBranchSelected}
                                          />
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-1.5 text-center font-semibold bg-primary/5">
                                      {gameTotals.initialStock}
                                    </td>
                                  </tr>
                                  
                                  {/* Activated Tickets */}
                                  <tr className="border-b hover:bg-muted/30">
                                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium border-r">
                                      Activated Tickets
                                    </td>
                                    {daysInMonth.map(day => {
                                      const dateStr = format(day, 'yyyy-MM-dd');
                                      const value = getCellValue(game.id, dateStr, 'activatedTickets');
                                      return (
                                        <td key={dateStr} className="px-0.5 py-0.5 border-r">
                                          <Input
                                            type="number"
                                            className="h-8 w-full text-center text-sm border-0 bg-transparent hover:bg-muted/50 focus:bg-card"
                                            value={value ?? ''}
                                            onChange={(e) => handleCellEdit(game.id, dateStr, 'activatedTickets', e.target.value)}
                                            placeholder="-"
                                            disabled={!isSingleBranchSelected}
                                          />
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-1.5 text-center font-semibold bg-primary/5">
                                      {gameTotals.totalActivated}
                                    </td>
                                  </tr>
                                  
                                  {/* Total (calculated) */}
                                  <tr className="border-b bg-blue-50/50 dark:bg-blue-950/20">
                                    <td className="sticky left-0 z-10 bg-blue-50/50 dark:bg-blue-950/20 px-3 py-1.5 font-medium border-r">
                                      Total
                                    </td>
                                    {daysInMonth.map(day => {
                                      const dateStr = format(day, 'yyyy-MM-dd');
                                      const calc = getDayCalculations(game.id, dateStr, game);
                                      return (
                                        <td key={dateStr} className="px-1 py-1.5 text-center font-medium border-r">
                                          {calc.stockBegin || calc.activated ? calc.totalStock : '-'}
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-1.5 text-center font-bold bg-primary/5">
                                      {gameTotals.initialStock + gameTotals.totalActivated}
                                    </td>
                                  </tr>
                                  
                                  {/* Instant Stock End */}
                                  <tr className="border-b hover:bg-muted/30">
                                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium border-r">
                                      Instant Stock End
                                    </td>
                                    {daysInMonth.map(day => {
                                      const dateStr = format(day, 'yyyy-MM-dd');
                                      const value = getCellValue(game.id, dateStr, 'stockEnd');
                                      return (
                                        <td key={dateStr} className="px-0.5 py-0.5 border-r">
                                          <Input
                                            type="number"
                                            className="h-8 w-full text-center text-sm border-0 bg-transparent hover:bg-muted/50 focus:bg-card"
                                            value={value ?? ''}
                                            onChange={(e) => handleCellEdit(game.id, dateStr, 'stockEnd', e.target.value)}
                                            placeholder="-"
                                            disabled={!isSingleBranchSelected}
                                          />
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-1.5 text-center font-semibold bg-primary/5">
                                      {gameTotals.closingStock}
                                    </td>
                                  </tr>
                                  
                                  {/* Tickets Sold (calculated) */}
                                  <tr className="border-b bg-amber-50/50 dark:bg-amber-950/20">
                                    <td className="sticky left-0 z-10 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-1.5 font-medium border-r">
                                      <span className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs px-1.5">£{game.ticket_price}</Badge>
                                        No of Tickets Sold
                                      </span>
                                    </td>
                                    {daysInMonth.map(day => {
                                      const dateStr = format(day, 'yyyy-MM-dd');
                                      const calc = getDayCalculations(game.id, dateStr, game);
                                      return (
                                        <td key={dateStr} className="px-1 py-1.5 text-center font-medium border-r">
                                          {calc.ticketsSold !== null ? calc.ticketsSold : '-'}
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-1.5 text-center font-bold bg-primary/5">
                                      {gameTotals.totalTicketsSold}
                                    </td>
                                  </tr>
                                  
                                  {/* Sales Value (calculated) */}
                                  <tr className="bg-green-50/70 dark:bg-green-950/30">
                                    <td className="sticky left-0 z-10 bg-green-50/70 dark:bg-green-950/30 px-3 py-1.5 font-medium border-r">
                                      Tickets Sale Value
                                    </td>
                                    {daysInMonth.map(day => {
                                      const dateStr = format(day, 'yyyy-MM-dd');
                                      const calc = getDayCalculations(game.id, dateStr, game);
                                      return (
                                        <td key={dateStr} className="px-1 py-1.5 text-center font-medium text-green-700 dark:text-green-400 border-r">
                                          {calc.salesValue !== null ? `£${calc.salesValue.toFixed(2)}` : '-'}
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-1.5 text-center font-bold text-green-700 dark:text-green-400 bg-green-100/50 dark:bg-green-900/30">
                                      £{gameTotals.totalSalesValue.toFixed(2)}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            <ScrollBar orientation="horizontal" />
                          </ScrollArea>
                        </div>
                      );
                    })}
                    
                    {/* Summary Section */}
                    {games.length > 0 && (
                      <div className="p-4 bg-gradient-to-r from-primary/5 to-accent/5">
                        <h4 className="font-semibold text-lg mb-4">Month End Summary</h4>
                        <ScrollArea className="w-full">
                          <div className="min-w-max">
                            <table className="w-full border-collapse text-sm">
                              <thead>
                                <tr className="bg-muted/50">
                                  <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-semibold min-w-[280px] border-r">
                                    Summary
                                  </th>
                                  {daysInMonth.map(day => (
                                    <th key={day.toISOString()} className="px-1 py-2 text-center font-medium min-w-[56px] border-r">
                                      {format(day, 'dd')}
                                    </th>
                                  ))}
                                  <th className="px-3 py-2 text-center font-semibold min-w-[80px] bg-primary/5">
                                    Total
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* Total Sales */}
                                <tr className="border-b bg-green-50/50 dark:bg-green-950/20">
                                  <td className="sticky left-0 z-10 bg-green-50/50 dark:bg-green-950/20 px-3 py-2 font-semibold border-r">
                                    Total Instant Lottery Sales
                                  </td>
                                  {daysInMonth.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const val = dailyTotals[dateStr]?.salesValue || 0;
                                    return (
                                      <td key={dateStr} className="px-1 py-2 text-center font-medium text-green-700 dark:text-green-400 border-r">
                                        {val > 0 ? `£${val.toFixed(2)}` : '-'}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-center font-bold text-green-700 dark:text-green-400 bg-green-100/50">
                                    £{grandTotals.totalSalesValue.toFixed(2)}
                                  </td>
                                </tr>
                                
                                {/* Closing Stock - Working */}
                                <tr className="border-b">
                                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium border-r">
                                    Closing Instant Lottery Stock — As per the Working
                                  </td>
                                  {daysInMonth.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const val = dailyTotals[dateStr]?.closingStock || 0;
                                    return (
                                      <td key={dateStr} className="px-1 py-2 text-center border-r">
                                        {val > 0 ? val : '-'}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-center font-bold bg-primary/5">
                                    {grandTotals.totalClosingStock}
                                  </td>
                                </tr>
                                
                                {/* Closing Stock - Physical */}
                                <tr className="border-b hover:bg-muted/30">
                                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium border-r">
                                    Closing Instant Lottery Stock — Physically (Number of Tickets)
                                  </td>
                                  {daysInMonth.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const value = physicalStock[dateStr];
                                    return (
                                      <td key={dateStr} className="px-0.5 py-0.5 border-r">
                                        <Input
                                          type="number"
                                          className="h-8 w-full text-center text-sm border-0 bg-transparent hover:bg-muted/50 focus:bg-card"
                                          value={value ?? ''}
                                          onChange={(e) => setPhysicalStock(prev => ({
                                            ...prev,
                                            [dateStr]: e.target.value === '' ? '' : parseInt(e.target.value) || 0
                                          }))}
                                          placeholder="-"
                                          disabled={!isSingleBranchSelected}
                                        />
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-center font-semibold bg-primary/5">
                                    {physicalStock[format(endOfMonth(selectedMonth), 'yyyy-MM-dd')] || '-'}
                                  </td>
                                </tr>
                                
                                {/* Differences */}
                                <tr className="bg-amber-50/50 dark:bg-amber-950/20">
                                  <td className="sticky left-0 z-10 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 font-semibold border-r">
                                    Differences
                                  </td>
                                  {daysInMonth.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const working = dailyTotals[dateStr]?.closingStock || 0;
                                    const physical = physicalStock[dateStr];
                                    const diff = physical !== undefined && physical !== '' ? working - physical : null;
                                    const hasError = diff !== null && diff !== 0;
                                    return (
                                      <td key={dateStr} className={`px-1 py-2 text-center font-medium border-r ${hasError ? 'text-destructive' : ''}`}>
                                        {diff !== null ? (diff > 0 ? `-${diff}` : diff < 0 ? `+${Math.abs(diff)}` : '0') : '-'}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-center font-bold bg-amber-100/50">
                                    {(() => {
                                      const lastDay = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
                                      const physical = physicalStock[lastDay];
                                      if (physical !== undefined && physical !== '') {
                                        const diff = grandTotals.totalClosingStock - physical;
                                        return diff !== 0 ? (
                                          <span className="text-destructive">{diff > 0 ? `-${diff}` : `+${Math.abs(diff)}`}</span>
                                        ) : (
                                          <span className="text-green-600">0</span>
                                        );
                                      }
                                      return '-';
                                    })()}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                        
                        {isSingleBranchSelected && (
                          <div className="mt-4 flex justify-end">
                            <Button 
                              onClick={() => saveMonthlySummaryMutation.mutate()} 
                              disabled={saveMonthlySummaryMutation.isPending}
                              className="gap-2"
                            >
                              <Save className="h-4 w-4" />
                              Save Monthly Summary
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* SHEET 2: SIMPLE DAILY RECONCILIATION - Records Tab */}
          {activeSheet === 'daily' && activeTab === 'records' && (
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-br from-accent/10 to-primary/5 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-accent" />
                      Simple Daily Reconciliation
                    </CardTitle>
                    <CardDescription>Quick daily entry for single-day tracking (Sheet 2)</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Date Navigation */}
                    <div className="flex items-center gap-1 bg-card rounded-xl p-1 shadow-sm border border-primary/10">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9 rounded-lg hover:bg-primary/10"
                        onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="px-4 py-2 min-w-[160px] text-center">
                        <span className={`font-semibold ${isToday(selectedDate) ? 'text-primary' : ''}`}>
                          {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEE, dd MMM yyyy')}
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9 rounded-lg hover:bg-primary/10"
                        onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                        disabled={isToday(selectedDate)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    {isSingleBranchSelected && (
                      <Button size="sm" onClick={() => setShowAddGameDialog(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Game
                      </Button>
                    )}
                  </div>
                </div>
                {!isSingleBranchSelected && (
                  <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-700 dark:text-amber-400">
                      Select a specific branch to add/edit games and records
                    </span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : games.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                      <Ticket className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Games Configured</h3>
                    <p className="text-muted-foreground mb-4">
                      {isSingleBranchSelected ? 'Add your first scratchcard game to start tracking.' : 'Select a specific branch to manage games.'}
                    </p>
                    {isSingleBranchSelected && (
                      <Button onClick={() => setShowAddGameDialog(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add First Game
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Daily Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {(() => {
                        const dateStr = format(selectedDate, 'yyyy-MM-dd');
                        let totalSales = 0;
                        let totalSold = 0;
                        let totalStock = 0;
                        games.forEach(game => {
                          const calc = getDayCalculations(game.id, dateStr, game);
                          if (calc.salesValue) totalSales += calc.salesValue;
                          if (calc.ticketsSold) totalSold += calc.ticketsSold;
                          if (calc.stockEnd) totalStock += calc.stockEnd;
                        });
                        return (
                          <>
                            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200/50">
                              <p className="text-sm text-green-700 dark:text-green-400 font-medium">Day's Sales</p>
                              <p className="text-3xl font-bold text-green-700 dark:text-green-400">£{totalSales.toFixed(2)}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50">
                              <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">Tickets Sold</p>
                              <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{totalSold}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50">
                              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">Closing Stock</p>
                              <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{totalStock}</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Game Cards - Vertical Layout for Daily Entry */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {games.map((game) => {
                        const dateStr = format(selectedDate, 'yyyy-MM-dd');
                        const calc = getDayCalculations(game.id, dateStr, game);
                        const hasUnsavedChanges = !!editingData[game.id]?.[dateStr];
                        
                        return (
                          <Card key={game.id} className={`overflow-hidden transition-all ${hasUnsavedChanges ? 'ring-2 ring-amber-400' : ''}`}>
                            <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-accent/5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-lg font-bold shadow-lg">
                                    £{game.ticket_price}
                                  </div>
                                  <div>
                                    <CardTitle className="text-lg">{game.game_name}</CardTitle>
                                    <CardDescription>£{game.ticket_price.toFixed(2)} per ticket</CardDescription>
                                  </div>
                                </div>
                                {hasUnsavedChanges && isSingleBranchSelected && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => saveGameData(game.id)}
                                    className="gap-1"
                                  >
                                    <Save className="h-3 w-3" />
                                    Save
                                  </Button>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                              {/* Input Fields */}
                              <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">Stock Begin</Label>
                                  <Input
                                    type="number"
                                    className="h-10 text-center font-semibold"
                                    value={getCellValue(game.id, dateStr, 'stockBegin') ?? ''}
                                    onChange={(e) => handleCellEdit(game.id, dateStr, 'stockBegin', e.target.value)}
                                    placeholder="0"
                                    disabled={!isSingleBranchSelected}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">Activated</Label>
                                  <Input
                                    type="number"
                                    className="h-10 text-center font-semibold"
                                    value={getCellValue(game.id, dateStr, 'activatedTickets') ?? ''}
                                    onChange={(e) => handleCellEdit(game.id, dateStr, 'activatedTickets', e.target.value)}
                                    placeholder="0"
                                    disabled={!isSingleBranchSelected}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">Stock End</Label>
                                  <Input
                                    type="number"
                                    className="h-10 text-center font-semibold"
                                    value={getCellValue(game.id, dateStr, 'stockEnd') ?? ''}
                                    onChange={(e) => handleCellEdit(game.id, dateStr, 'stockEnd', e.target.value)}
                                    placeholder="0"
                                    disabled={!isSingleBranchSelected}
                                  />
                                </div>
                              </div>
                              
                              {/* Calculated Values */}
                              <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                                <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                                  <p className="text-xs text-blue-600 dark:text-blue-400">Total Stock</p>
                                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                                    {calc.totalStock || '-'}
                                  </p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                                  <p className="text-xs text-amber-600 dark:text-amber-400">Tickets Sold</p>
                                  <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                                    {calc.ticketsSold ?? '-'}
                                  </p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
                                  <p className="text-xs text-green-600 dark:text-green-400">Sales Value</p>
                                  <p className="text-lg font-bold text-green-700 dark:text-green-400">
                                    {calc.salesValue !== null ? `£${calc.salesValue.toFixed(2)}` : '-'}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    
                    {/* Daily Physical Stock & Difference */}
                    <Card className="bg-gradient-to-r from-muted/30 to-muted/10">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Working Stock (Calculated)</Label>
                            <div className="h-10 px-3 rounded-lg bg-card border flex items-center justify-center font-bold text-lg">
                              {dailyTotals[format(selectedDate, 'yyyy-MM-dd')]?.closingStock || 0}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Physical Count</Label>
                            <Input
                              type="number"
                              className="h-10 text-center font-semibold"
                              placeholder="Enter count"
                              value={physicalStock[format(selectedDate, 'yyyy-MM-dd')] ?? ''}
                              onChange={(e) => setPhysicalStock(prev => ({
                                ...prev,
                                [format(selectedDate, 'yyyy-MM-dd')]: e.target.value === '' ? '' : parseInt(e.target.value) || 0
                              }))}
                              disabled={!isSingleBranchSelected}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Difference</Label>
                            {(() => {
                              const dateStr = format(selectedDate, 'yyyy-MM-dd');
                              const working = dailyTotals[dateStr]?.closingStock || 0;
                              const physical = physicalStock[dateStr];
                              const diff = physical !== undefined && physical !== '' ? working - (physical as number) : null;
                              
                              return (
                                <div className={`h-10 px-3 rounded-lg border flex items-center justify-center font-bold text-lg ${
                                  diff === null ? 'bg-muted' :
                                  diff === 0 ? 'bg-green-100 text-green-700 border-green-300' :
                                  'bg-destructive/10 text-destructive border-destructive/30'
                                }`}>
                                  {diff !== null ? (
                                    diff === 0 ? (
                                      <span className="flex items-center gap-1">
                                        <CheckCircle2 className="h-4 w-4" /> 0
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1">
                                        <AlertTriangle className="h-4 w-4" />
                                        {diff > 0 ? `-${diff}` : `+${Math.abs(diff)}`}
                                      </span>
                                    )
                                  ) : '—'}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Summary Tab - Works for both sheets */}
          {activeTab === 'summary' && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b">
                <CardTitle className="text-xl">Monthly Summary — {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
                <CardDescription>Overview of lottery reconciliation for the month</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Calculated Values */}
                  <div className="space-y-4">
                    <div className="p-6 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border border-green-200/50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">Total Instant Lottery Sales</span>
                      </div>
                      <p className="text-4xl font-bold text-green-700 dark:text-green-400">
                        £{grandTotals.totalSalesValue.toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="p-6 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200/50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Closing Stock (As per Working)</span>
                      </div>
                      <p className="text-4xl font-bold text-blue-700 dark:text-blue-400">
                        {grandTotals.totalClosingStock}
                      </p>
                      <p className="text-sm text-blue-600/70 mt-1">tickets remaining</p>
                    </div>
                  </div>
                  
                  {/* Right Column - Physical Count & Difference */}
                  <div className="space-y-4">
                    <div className="p-6 rounded-xl border bg-card">
                      <Label className="text-sm font-medium text-muted-foreground">Closing Stock (Physical Count)</Label>
                      <Input
                        type="number"
                        className="mt-3 text-2xl font-bold h-14"
                        placeholder="Enter physical stock count"
                        value={physicalStock[format(endOfMonth(selectedMonth), 'yyyy-MM-dd')] ?? ''}
                        onChange={(e) => setPhysicalStock(prev => ({
                          ...prev,
                          [format(endOfMonth(selectedMonth), 'yyyy-MM-dd')]: e.target.value === '' ? '' : parseInt(e.target.value) || 0
                        }))}
                        disabled={!isSingleBranchSelected}
                      />
                      <p className="text-sm text-muted-foreground mt-2">Count all physical lottery tickets at month end</p>
                    </div>
                    
                    {(() => {
                      const lastDayPhysical = physicalStock[format(endOfMonth(selectedMonth), 'yyyy-MM-dd')];
                      const hasDifference = lastDayPhysical !== undefined && lastDayPhysical !== '';
                      const difference = hasDifference ? grandTotals.totalClosingStock - (lastDayPhysical as number) : 0;
                      const isNegative = difference > 0; // Working > Physical = Missing
                      const isPositive = difference < 0; // Working < Physical = Extra
                      
                      return (
                        <div className={`p-6 rounded-xl border ${
                          !hasDifference ? 'bg-muted/30' :
                          difference === 0 ? 'bg-green-50 dark:bg-green-950/20 border-green-200' :
                          'bg-amber-50 dark:bg-amber-950/20 border-amber-200'
                        }`}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-lg ${
                              !hasDifference ? 'bg-muted' :
                              difference === 0 ? 'bg-green-500/20' : 'bg-amber-500/20'
                            }`}>
                              {difference === 0 && hasDifference ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <AlertTriangle className={`h-5 w-5 ${hasDifference ? 'text-amber-600' : 'text-muted-foreground'}`} />
                              )}
                            </div>
                            <span className="text-sm font-medium">Stock Difference</span>
                          </div>
                          <p className={`text-4xl font-bold ${
                            !hasDifference ? 'text-muted-foreground' :
                            difference === 0 ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {hasDifference ? (
                              difference === 0 ? '0' : (isNegative ? `-${difference}` : `+${Math.abs(difference)}`)
                            ) : '—'}
                          </p>
                          {hasDifference && difference !== 0 && (
                            <p className="text-sm text-amber-600 mt-1">
                              {isNegative ? `${difference} tickets missing` : `${Math.abs(difference)} extra tickets`}
                            </p>
                          )}
                          {hasDifference && difference === 0 && (
                            <p className="text-sm text-green-600 mt-1">Stock reconciled perfectly!</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                <Separator className="my-6" />
                
                {/* Game-wise Breakdown */}
                <div>
                  <h4 className="font-semibold mb-4">Game-wise Breakdown</h4>
                  <div className="grid gap-3">
                    {games.map(game => {
                      const totals = getGameTotals(game.id, game);
                      return (
                        <div key={game.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary">
                              £{game.ticket_price}
                            </div>
                            <div>
                              <p className="font-medium">{game.game_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {totals.totalTicketsSold} tickets sold
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">£{totals.totalSalesValue.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">Closing: {totals.closingStock}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <Button 
                    onClick={() => saveMonthlySummaryMutation.mutate()} 
                    disabled={saveMonthlySummaryMutation.isPending}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Monthly Summary
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manage Games Tab */}
          {activeTab === 'games' && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Manage Scratchcard Games</CardTitle>
                    <CardDescription>Add, edit or remove games from lottery tracking</CardDescription>
                  </div>
                  {isSingleBranchSelected && (
                    <Button onClick={() => setShowAddGameDialog(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Game
                    </Button>
                  )}
                </div>
                {!isSingleBranchSelected && (
                  <div className="flex items-center gap-2 mt-3 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-700 dark:text-amber-400">
                      Select a specific branch to manage games
                    </span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {games.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                      <Ticket className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Games Configured</h3>
                    <p className="text-muted-foreground mb-4">
                      {isSingleBranchSelected ? 'Add scratchcard games to start tracking lottery sales.' : 'Select a specific branch to manage games.'}
                    </p>
                    {isSingleBranchSelected && (
                      <Button onClick={() => setShowAddGameDialog(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add First Game
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y">
                    {games.map((game) => {
                      const totals = getGameTotals(game.id, game);
                      return (
                        <div key={game.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shadow-lg">
                              £{game.ticket_price}
                            </div>
                            <div>
                              <h4 className="font-semibold">{game.game_name}</h4>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span>£{game.ticket_price.toFixed(2)} per ticket</span>
                                <span>•</span>
                                <span>{totals.totalTicketsSold} sold this month</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right mr-4">
                              <p className="font-bold text-green-600">£{totals.totalSalesValue.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">This month</p>
                            </div>
                            <Badge variant={game.is_active ? 'default' : 'secondary'}>
                              {game.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            {isSingleBranchSelected && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-primary"
                                  onClick={() => openEditGame(game)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteGameMutation.mutate(game.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Add Game Dialog */}
      <Dialog open={showAddGameDialog} onOpenChange={setShowAddGameDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              Add New Scratchcard Game
            </DialogTitle>
            <DialogDescription>
              Add a new lottery game to track sales and inventory.
            </DialogDescription>
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
                  <SelectItem value="1">£1.00</SelectItem>
                  <SelectItem value="2">£2.00</SelectItem>
                  <SelectItem value="3">£3.00</SelectItem>
                  <SelectItem value="5">£5.00</SelectItem>
                  <SelectItem value="10">£10.00</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGameDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => addGameMutation.mutate()} 
              disabled={!newGame.name.trim() || addGameMutation.isPending}
            >
              {addGameMutation.isPending ? 'Adding...' : 'Add Game'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Game Dialog */}
      <Dialog open={showEditGameDialog} onOpenChange={setShowEditGameDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Edit Game
            </DialogTitle>
            <DialogDescription>
              Update game name and ticket price.
            </DialogDescription>
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
                  <SelectItem value="1">£1.00</SelectItem>
                  <SelectItem value="2">£2.00</SelectItem>
                  <SelectItem value="3">£3.00</SelectItem>
                  <SelectItem value="5">£5.00</SelectItem>
                  <SelectItem value="10">£10.00</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditGameDialog(false);
              setEditingGame(null);
              setNewGame({ name: '', ticketPrice: '1' });
            }}>Cancel</Button>
            <Button 
              onClick={() => updateGameMutation.mutate()} 
              disabled={!newGame.name.trim() || updateGameMutation.isPending}
            >
              {updateGameMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
