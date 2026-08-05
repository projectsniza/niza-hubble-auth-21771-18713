import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, Trash2, Save, Download, Ticket, Calculator, Calendar as CalendarIcon2, TrendingUp, 
  Package, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, X, Edit2,
  LayoutGrid, CalendarDays, FileSpreadsheet
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
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

interface LotteryPriceHistory {
  id: string;
  game_id: string;
  branch_id: string;
  ticket_price: number;
  effective_date: string;
  notes: string | null;
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
        .eq('is_active', true);
      if (error) throw error;
      // Natural numeric sort: "game 1", "game 2", ..., "game 10"
      return (data as LotteryGame[]).sort((a, b) => {
        const an = Number(a.game_name.match(/\d+/)?.[0] ?? 0);
        const bn = Number(b.game_name.match(/\d+/)?.[0] ?? 0);
        return an - bn || a.game_name.localeCompare(b.game_name);
      });
    },
    enabled: filteredBranchIds.length > 0,
  });

  // Fetch daily records for the month (plus the previous-month boundary day, so
  // closing stock carries forward into day 1 of the new month).
  const { data: dailyRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['lottery-daily-records', filteredBranchIds, viewMode, format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (filteredBranchIds.length === 0) return [];
      // Start well before the month so a gap at the boundary still carries forward
      const startDate = format(subDays(selectedMonth, 40), 'yyyy-MM-dd');

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

  // ---- Monthly lock (HR / Super Admin only) ----
  const canManageLottreyLock = user?.role === 'super_admin' || user?.role === 'hr';
  const monthKey = format(selectedMonth, 'yyyy-MM-01');

  const { data: monthLock } = useQuery({
    queryKey: ['lottery-month-lock', effectiveBranchId, monthKey],
    queryFn: async () => {
      if (!effectiveBranchId) return null;
      const { data, error } = await supabase
        .from('lottery_month_locks')
        .select('*')
        .eq('branch_id', effectiveBranchId)
        .eq('month_year', monthKey)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveBranchId,
  });

  const isMonthLocked = !!monthLock;
  const isReadOnlyMonth = isMonthLocked && !canManageLottreyLock;

  const toggleMonthLockMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveBranchId) throw new Error('Select a single branch first');
      if (monthLock) {
        const { error } = await supabase
          .from('lottery_month_locks')
          .delete()
          .eq('id', (monthLock as any).id);
        if (error) throw error;
        return 'unlocked';
      }
      const { error } = await supabase
        .from('lottery_month_locks')
        .insert({ branch_id: effectiveBranchId, month_year: monthKey, locked_by: user?.id ?? null });
      if (error) throw error;
      return 'locked';
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['lottery-month-lock'] });
      toast.success(result === 'locked'
        ? `${format(selectedMonth, 'MMMM yyyy')} locked — store logins can no longer edit it`
        : `${format(selectedMonth, 'MMMM yyyy')} unlocked`);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update lock'),
  });


  // Fetch till reports (Total Instant Lottery Sales as per Day Report) for the month
  const { data: tillReports = [] } = useQuery({
    queryKey: ['lottery-till-reports', filteredBranchIds, format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (filteredBranchIds.length === 0) return [];
      const startDate = format(selectedMonth, 'yyyy-MM-01');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('lottery_daily_till_reports' as any)
        .select('*')
        .in('branch_id', filteredBranchIds)
        .gte('report_date', startDate)
        .lte('report_date', endDate);
      if (error) throw error;
      return ((data || []) as unknown) as Array<{ id: string; branch_id: string; report_date: string; till_report_amount: number }>;
    },
    enabled: filteredBranchIds.length > 0,
  });

  // Ticket price history keeps old lottery records on the price that was active
  // on that date, instead of recalculating the whole month at today's price.
  const { data: priceHistory = [] } = useQuery({
    queryKey: ['lottery-price-history', filteredBranchIds, format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (filteredBranchIds.length === 0 || games.length === 0) return [];
      const gameIds = games.map(g => g.id);
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      const { data, error } = await (supabase as any)
        .from('lottery_game_price_history')
        .select('*')
        .in('game_id', gameIds)
        .in('branch_id', filteredBranchIds)
        .lte('effective_date', endDate)
        .order('effective_date', { ascending: true });
      if (error) throw error;
      return (data || []) as LotteryPriceHistory[];
    },
    enabled: filteredBranchIds.length > 0 && games.length > 0,
  });

  const priceHistoryByGame = useMemo(() => {
    const map: Record<string, LotteryPriceHistory[]> = {};
    priceHistory.forEach(history => {
      (map[history.game_id] ||= []).push(history);
    });
    Object.values(map).forEach(rows => rows.sort((a, b) => a.effective_date.localeCompare(b.effective_date)));
    return map;
  }, [priceHistory]);

  const getHistoricalTicketPrice = useCallback((game: LotteryGame, dateStr: string) => {
    const history = priceHistoryByGame[game.id] || [];
    let activePrice = Number(game.ticket_price) || 0;

    for (const row of history) {
      if (row.effective_date <= dateStr) {
        activePrice = Number(row.ticket_price) || activePrice;
      } else {
        break;
      }
    }

    return activePrice;
  }, [priceHistoryByGame]);

  const getMonthlyPriceLabel = useCallback((game: LotteryGame) => {
    const prices = new Set<string>();
    daysInMonth.forEach(day => {
      prices.add(getHistoricalTicketPrice(game, format(day, 'yyyy-MM-dd')).toFixed(2));
    });
    const values = Array.from(prices);
    if (values.length <= 1) return `£${values[0] || Number(game.ticket_price).toFixed(2)}`;
    return values.map(v => `£${v}`).join(' / ');
  }, [daysInMonth, getHistoricalTicketPrice]);

  // Map till reports by date (sums across branches when viewing multiple)
  const tillReportByDate = useMemo(() => {
    const map: { [date: string]: number } = {};
    tillReports.forEach(r => {
      map[r.report_date] = (map[r.report_date] || 0) + Number(r.till_report_amount || 0);
    });
    return map;
  }, [tillReports]);

  // Local edits for till reports (before save)
  const [editingTillReports, setEditingTillReports] = useState<{ [date: string]: string }>({});

  const getTillValue = useCallback((dateStr: string): number | null => {
    if (editingTillReports[dateStr] !== undefined) {
      const v = parseFloat(editingTillReports[dateStr]);
      return isNaN(v) ? null : v;
    }
    return tillReportByDate[dateStr] ?? null;
  }, [editingTillReports, tillReportByDate]);

  const saveTillReportMutation = useMutation({
    mutationFn: async ({ date, amount }: { date: string; amount: number }) => {
      if (!effectiveBranchId) throw new Error('Select a branch first');
      const { error } = await supabase
        .from('lottery_daily_till_reports' as any)
        .upsert({
          branch_id: effectiveBranchId,
          report_date: date,
          till_report_amount: amount,
          updated_by: user?.id,
          created_by: user?.id,
        }, { onConflict: 'branch_id,report_date' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lottery-till-reports'] });
    },
    onError: (e) => toast.error('Failed to save till report: ' + (e as Error).message),
  });

  const handleTillEdit = (dateStr: string, value: string) => {
    setEditingTillReports(prev => ({ ...prev, [dateStr]: value }));
  };

  const handleTillBlur = async (dateStr: string) => {
    const raw = editingTillReports[dateStr];
    if (raw === undefined) return;
    const amount = parseFloat(raw);
    if (isNaN(amount)) {
      setEditingTillReports(prev => { const n = { ...prev }; delete n[dateStr]; return n; });
      return;
    }
    await saveTillReportMutation.mutateAsync({ date: dateStr, amount });
    setEditingTillReports(prev => { const n = { ...prev }; delete n[dateStr]; return n; });
  };

  // Organize records by game and date
  const recordsByGameAndDate = useMemo(() => {
    const map: { [gameId: string]: { [date: string]: DailyRecord } } = {};
    dailyRecords.forEach(record => {
      if (!map[record.game_id]) map[record.game_id] = {};
      map[record.game_id][record.record_date] = record;
    });
    return map;
  }, [dailyRecords]);

  // Get the most recent prior closing stock for auto-carry-forward.
  // Walks backwards (up to 60 days) so a gap in data entry never breaks the
  // opening balance chain — e.g. 23rd closing must appear as 24th opening even
  // if the 23rd row was saved without a closing figure on the first attempt.
  const getPreviousDayClosingStock = useCallback((gameId: string, dateStr: string): number | null => {
    const [y, m, d] = dateStr.split('-').map(Number);
    let cursor = new Date(y, (m || 1) - 1, d || 1);

    for (let step = 0; step < 60; step++) {
      cursor = subDays(cursor, 1);
      const prevDateStr = format(cursor, 'yyyy-MM-dd');

      // Prefer unsaved edits for that day
      const editedPrev = editingData[gameId]?.[prevDateStr];
      if (editedPrev?.stockEnd != null && Number(editedPrev.stockEnd) > 0) {
        return Number(editedPrev.stockEnd);
      }

      const prevRecord = recordsByGameAndDate[gameId]?.[prevDateStr];
      if (!prevRecord) continue;

      if (prevRecord.stock_end != null && Number(prevRecord.stock_end) > 0) {
        return Number(prevRecord.stock_end);
      }
      // Closing not entered — fall back to that day's total stock so the chain
      // keeps running instead of collapsing to blank.
      const total = Number(prevRecord.stock_begin || 0) + Number(prevRecord.activated_tickets || 0);
      if (total > 0) return total;
    }
    return null;
  }, [editingData, recordsByGameAndDate]);


  // Get value for a cell (edited or from DB) with auto-carry-forward for stockBegin
  const getCellValue = useCallback((gameId: string, dateStr: string, field: keyof GameDailyData) => {
    const edited = editingData[gameId]?.[dateStr];
    const record = recordsByGameAndDate[gameId]?.[dateStr];
    
    if (edited && edited[field] !== undefined) {
      return edited[field];
    }
    
    switch (field) {
      case 'stockBegin': {
        // Use saved value only if it's a meaningful positive number.
        // (Treat null/undefined/0 as "not set" so carry-forward from previous day's closing kicks in.)
        if (record?.stock_begin != null && Number(record.stock_begin) > 0) {
          return record.stock_begin;
        }
        // Otherwise, try to auto-populate from previous day's closing stock
        const prevClosing = getPreviousDayClosingStock(gameId, dateStr);
        if (prevClosing != null && prevClosing > 0) return prevClosing;
        return record?.stock_begin ?? null;
      }

      case 'activatedTickets': return record?.activated_tickets ?? null;
      case 'stockEnd': return record?.stock_end ?? null;
      default: return null;
    }
  }, [editingData, recordsByGameAndDate, getPreviousDayClosingStock]);

  // Calculate derived values for a day
  const getDayCalculations = useCallback((gameId: string, dateStr: string, game: LotteryGame) => {
    const stockBegin = getCellValue(gameId, dateStr, 'stockBegin') ?? 0;
    const activated = getCellValue(gameId, dateStr, 'activatedTickets') ?? 0;
    const stockEnd = getCellValue(gameId, dateStr, 'stockEnd');
    const ticketPrice = getHistoricalTicketPrice(game, dateStr);
    
    // Total = Stock Begin + Activated
    const totalStock = stockBegin + activated;
    
    // Tickets Sold = Stock Begin + Activated - Stock End
    // Only calculate if stock_end is entered
    const ticketsSold = stockEnd !== null ? Math.max(0, totalStock - stockEnd) : null;
    
    // Sales Value = Tickets Sold × Ticket Price
    const salesValue = ticketsSold !== null ? ticketsSold * ticketPrice : null;
    
    return { stockBegin, activated, totalStock, stockEnd, ticketsSold, salesValue, ticketPrice };
  }, [getCellValue, getHistoricalTicketPrice]);

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

      if (calc.salesValue !== null) {
        totalSalesValue += calc.salesValue;
      }
      
      if (calc.stockEnd !== null) {
        lastStockEnd = calc.stockEnd;
      }
    });
    
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
      
      const nextPrice = parseFloat(newGame.ticketPrice);
      const priceChanged = Number(editingGame.ticket_price) !== nextPrice;

      const { error } = await supabase
        .from('lottery_games')
        .update({
          game_name: newGame.name.trim(),
          ticket_price: nextPrice,
        })
        .eq('id', editingGame.id);
      if (error) throw error;

      if (priceChanged) {
        const { error: historyError } = await (supabase as any)
          .from('lottery_game_price_history')
          .upsert({
            game_id: editingGame.id,
            branch_id: editingGame.branch_id,
            ticket_price: nextPrice,
            effective_date: format(new Date(), 'yyyy-MM-dd'),
            changed_by: user?.id,
            notes: `Ticket price changed from £${Number(editingGame.ticket_price).toFixed(2)} to £${nextPrice.toFixed(2)}`,
          }, { onConflict: 'game_id,effective_date' });
        if (historyError) throw historyError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lottery-games'] });
      queryClient.invalidateQueries({ queryKey: ['lottery-price-history'] });
      setShowEditGameDialog(false);
      setEditingGame(null);
      setNewGame({ name: '', ticketPrice: '1' });
      toast.success('Game updated. Price changes now apply from today only.');
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
    const numValue = value === '' ? null : Math.max(0, parseInt(value) || 0);
    
    setEditingData(prev => {
      const record = recordsByGameAndDate[gameId]?.[date];
      const existing = prev[gameId]?.[date];
      // Fall back to previous day's closing stock so editing other fields doesn't wipe begin stock
      const fallbackBegin = record?.stock_begin ?? getPreviousDayClosingStock(gameId, date) ?? 0;
      
      return {
        ...prev,
        [gameId]: {
          ...prev[gameId],
          [date]: {
            stockBegin: existing?.stockBegin ?? fallbackBegin,
            activatedTickets: existing?.activatedTickets ?? record?.activated_tickets ?? 0,
            stockEnd: existing?.stockEnd ?? record?.stock_end ?? null,
            [field]: numValue,
          }
        }
      };
    });
  }, [recordsByGameAndDate, getPreviousDayClosingStock]);

  // Save all edited data for a game
  const saveGameData = async (gameId: string) => {
    const gameData = editingData[gameId];
    if (!gameData) return;

    try {
      for (const [date, data] of Object.entries(gameData)) {
        // Ensure begin stock falls back to previous day's end stock if missing
        const finalBegin = data.stockBegin ?? getPreviousDayClosingStock(gameId, date) ?? 0;
        await saveRecordMutation.mutateAsync({
          gameId,
          date,
          stockBegin: finalBegin,
          activatedTickets: data.activatedTickets ?? 0,
          stockEnd: data.stockEnd,
        });

        // If end stock was set, overwrite tomorrow's begin stock so it always carries forward
        if (data.stockEnd !== null && data.stockEnd !== undefined && effectiveBranchId) {
          const tomorrow = format(addDays(new Date(date), 1), 'yyyy-MM-dd');
          const tomorrowRecord = recordsByGameAndDate[gameId]?.[tomorrow];
          await supabase.from('lottery_daily_records').upsert({
            game_id: gameId,
            branch_id: effectiveBranchId,
            record_date: tomorrow,
            stock_begin: data.stockEnd,
            activated_tickets: tomorrowRecord?.activated_tickets ?? 0,
            stock_end: tomorrowRecord?.stock_end ?? null,
            created_by: user?.id,
          }, { onConflict: 'game_id,record_date' });
        }
      }

      setEditingData(prev => {
        const newData = { ...prev };
        delete newData[gameId];
        return newData;
      });
      
      queryClient.invalidateQueries({ queryKey: ['lottery-daily-records'] });
      toast.success('Data saved successfully');
    } catch {
      // Error already handled in mutation
    }
  };

  // Save all games data at once
  const saveAllData = async () => {
    const gamesWithChanges = Object.keys(editingData);
    if (gamesWithChanges.length === 0) {
      toast.info('No changes to save');
      return;
    }

    try {
      for (const gameId of gamesWithChanges) {
        const gameData = editingData[gameId];
        for (const [date, data] of Object.entries(gameData)) {
          await saveRecordMutation.mutateAsync({
            gameId,
            date,
            stockBegin: data.stockBegin ?? 0,
            activatedTickets: data.activatedTickets ?? 0,
            stockEnd: data.stockEnd,
          });
        }
      }

      setEditingData({});
      toast.success(`Saved data for ${gamesWithChanges.length} game(s) successfully`);
    } catch {
      // Error already handled in mutation
    }
  };

  // Check if there are any unsaved changes
  const hasAnyUnsavedChanges = Object.keys(editingData).length > 0;

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
      const priceValues = daysInMonth.map(day => `£${getHistoricalTicketPrice(game, format(day, 'yyyy-MM-dd')).toFixed(2)}`);
      lines.push(['', '', getMonthlyPriceLabel(game), 'Ticket Price Used', ...priceValues, getMonthlyPriceLabel(game)].join(','));
      lines.push(['', '', getMonthlyPriceLabel(game), 'No of Tickets Sold', ...soldValues, gameTotals.totalTicketsSold].join(','));
      
      // Sales Value row
      const salesValues = daysInMonth.map(day => {
        const calc = getDayCalculations(game.id, format(day, 'yyyy-MM-dd'), game);
        return calc.salesValue !== null ? `£${calc.salesValue.toFixed(2)}` : '-';
      });
      lines.push(['', '', '', 'Tickets Sale Value', ...salesValues, `£${gameTotals.totalSalesValue.toFixed(2)}`].join(','));
      
      lines.push('');
    });
    
    // Summary - Total Instant Lottery Sales (with daily values so they appear in Excel)
    lines.push('');
    const dailySalesValues = daysInMonth.map(day => {
      const v = dailyTotals[format(day, 'yyyy-MM-dd')]?.salesValue || 0;
      return v > 0 ? `£${v.toFixed(2)}` : '-';
    });
    lines.push(['', 'Total Instant Lottery Sales', '', '', ...dailySalesValues, `£${grandTotals.totalSalesValue.toFixed(2)}`].join(','));

    // Total Instant Lottery Sales as per Day Report (manual till entry)
    const dailyTillValues = daysInMonth.map(day => {
      const v = getTillValue(format(day, 'yyyy-MM-dd'));
      return v !== null ? `£${v.toFixed(2)}` : '-';
    });
    const totalTill = daysInMonth.reduce((s, d) => s + (getTillValue(format(d, 'yyyy-MM-dd')) ?? 0), 0);
    lines.push(['', 'Total Instant Lottery Sales Value as per Day Report (£)', '', '', ...dailyTillValues, `£${totalTill.toFixed(2)}`].join(','));

    // Sales Difference (System - Till Report)
    const dailyDiffValues = daysInMonth.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const sys = dailyTotals[dateStr]?.salesValue || 0;
      const till = getTillValue(dateStr);
      if (till === null) return '-';
      const d = sys - till;
      return Math.abs(d) < 0.01 ? '0' : `£${d.toFixed(2)}`;
    });
    const totalDiff = grandTotals.totalSalesValue - totalTill;
    lines.push(['', 'Sales Value Difference (System - Till Report)', '', '', ...dailyDiffValues, `£${totalDiff.toFixed(2)}`].join(','));
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

          {canManageLottreyLock && effectiveBranchId && (
            <Button
              variant={isMonthLocked ? 'destructive' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => toggleMonthLockMutation.mutate()}
              disabled={toggleMonthLockMutation.isPending}
            >
              {isMonthLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              {isMonthLocked ? 'Unlock Month' : 'Lock Month'}
            </Button>
          )}
        </div>
      </div>

      {isMonthLocked && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/10 text-sm">
          <Lock className="h-4 w-4 text-destructive flex-shrink-0" />
          <span>
            <strong>{format(selectedMonth, 'MMMM yyyy')} is locked by head office.</strong>{' '}
            {isReadOnlyMonth
              ? 'Lottery records for this month can no longer be edited.'
              : 'Store logins cannot edit this month — you can still make corrections.'}
          </span>
        </div>
      )}


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
                    <CardDescription>Enter daily stock and sales data for each game. Yesterday's closing stock auto-fills today's opening stock.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                    {isSingleBranchSelected && hasAnyUnsavedChanges && (
                      <Button size="sm" variant="default" onClick={saveAllData} className="gap-2 bg-green-600 hover:bg-green-700">
                        <Save className="h-4 w-4" />
                        Save All
                      </Button>
                    )}
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
                    <NizaLoaderInline />
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
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shadow-lg text-xs">
                                £{getHistoricalTicketPrice(game, format(new Date(), 'yyyy-MM-dd')).toFixed(0)}
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
                                            min="0"
                                            className="h-8 w-full text-center text-sm border-0 bg-muted/30 cursor-not-allowed"
                                            value={value ?? ''}
                                            readOnly
                                            placeholder="-"
                                            tabIndex={-1}
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
                                            min="0"
                                            className="h-8 w-full text-center text-sm border-0 bg-muted/30 cursor-not-allowed"
                                            value={value ?? ''}
                                            readOnly
                                            placeholder="-"
                                            tabIndex={-1}
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
                                            min="0"
                                            className="h-8 w-full text-center text-sm border-0 bg-muted/30 cursor-not-allowed"
                                            value={value ?? ''}
                                            readOnly
                                            placeholder="-"
                                            tabIndex={-1}
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
                                        <Badge variant="outline" className="text-xs px-1.5" title="Price follows history by date">
                                          {getMonthlyPriceLabel(game)}
                                        </Badge>
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
                        <h4 className="font-semibold text-lg mb-4">Daily Summary — Opening & Closing Stock</h4>
                        <ScrollArea className="w-full">
                          <div className="min-w-max">
                            <table className="w-full border-collapse text-sm">
                              <thead>
                                <tr className="bg-muted/50">
                                  <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-semibold min-w-[200px] border-r">
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
                                {/* Opening Stock (Day's Total Stock Begin) */}
                                <tr className="border-b bg-blue-50/50 dark:bg-blue-950/20">
                                  <td className="sticky left-0 z-10 bg-blue-50/50 dark:bg-blue-950/20 px-3 py-2 font-medium border-r">
                                    Opening Stock (All Games)
                                  </td>
                                  {daysInMonth.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    let openingStock = 0;
                                    games.forEach(game => {
                                      const stockBegin = getCellValue(game.id, dateStr, 'stockBegin') ?? 0;
                                      const activated = getCellValue(game.id, dateStr, 'activatedTickets') ?? 0;
                                      openingStock += stockBegin + activated;
                                    });
                                    return (
                                      <td key={dateStr} className="px-1 py-2 text-center font-medium text-blue-700 dark:text-blue-400 border-r">
                                        {openingStock > 0 ? openingStock : '-'}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-100/50">
                                    —
                                  </td>
                                </tr>

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

                                {/* Total Instant Lottery Sales as per Day Report (manual till entry) */}
                                <tr className="border-b bg-purple-50/50 dark:bg-purple-950/20">
                                  <td className="sticky left-0 z-10 bg-purple-50/50 dark:bg-purple-950/20 px-3 py-2 font-semibold border-r">
                                    Total Instant Lottery Sales Value as per Day Report (£)
                                  </td>
                                  {daysInMonth.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const editedVal = editingTillReports[dateStr];
                                    const savedVal = tillReportByDate[dateStr];
                                    const displayVal = editedVal !== undefined ? editedVal : (savedVal !== undefined ? savedVal.toString() : '');
                                    return (
                                      <td key={dateStr} className="px-1 py-1 text-center border-r">
                                        {isSingleBranchSelected ? (
                                          <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={displayVal}
                                            onChange={(e) => handleTillEdit(dateStr, e.target.value)}
                                            onBlur={() => handleTillBlur(dateStr)}
                                            placeholder="£0.00"
                                            className="h-8 text-center text-xs px-1 font-medium text-purple-700 dark:text-purple-400"
                                          />
                                        ) : (
                                          <span className="text-purple-700 dark:text-purple-400 font-medium">
                                            {savedVal !== undefined ? `£${savedVal.toFixed(2)}` : '-'}
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-center font-bold text-purple-700 dark:text-purple-400 bg-purple-100/50">
                                    £{daysInMonth.reduce((sum, day) => sum + (getTillValue(format(day, 'yyyy-MM-dd')) ?? 0), 0).toFixed(2)}
                                  </td>
                                </tr>

                                {/* Sales Difference (System vs Till Report) */}
                                <tr className="border-b bg-rose-50/50 dark:bg-rose-950/20">
                                  <td className="sticky left-0 z-10 bg-rose-50/50 dark:bg-rose-950/20 px-3 py-2 font-semibold border-r">
                                    Sales Value Difference (System − Till Report)
                                  </td>
                                  {daysInMonth.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const sys = dailyTotals[dateStr]?.salesValue || 0;
                                    const till = getTillValue(dateStr);
                                    if (till === null) {
                                      return <td key={dateStr} className="px-1 py-2 text-center text-muted-foreground border-r">-</td>;
                                    }
                                    const diff = sys - till;
                                    const ok = Math.abs(diff) < 0.01;
                                    return (
                                      <td key={dateStr} className={`px-1 py-2 text-center font-medium border-r ${ok ? 'text-green-600' : 'text-destructive'}`}>
                                        {ok ? '✓' : `${diff > 0 ? '+' : ''}£${diff.toFixed(2)}`}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-center font-bold bg-rose-100/50">
                                    {(() => {
                                      const totalTill = daysInMonth.reduce((sum, day) => sum + (getTillValue(format(day, 'yyyy-MM-dd')) ?? 0), 0);
                                      const diff = grandTotals.totalSalesValue - totalTill;
                                      const ok = Math.abs(diff) < 0.01;
                                      return <span className={ok ? 'text-green-600' : 'text-destructive'}>{ok ? '✓' : `${diff > 0 ? '+' : ''}£${diff.toFixed(2)}`}</span>;
                                    })()}
                                  </td>
                                </tr>

                                {/* Closing Stock - Working */}
                                <tr className="border-b">
                                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium border-r">
                                    Closing Stock — As per Working
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
                                
                                {/* Stock Difference (Day over Day) */}
                                <tr className="bg-amber-50/50 dark:bg-amber-950/20">
                                  <td className="sticky left-0 z-10 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 font-semibold border-r">
                                    Stock Difference (Day-over-Day)
                                  </td>
                                  {daysInMonth.map((day, idx) => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const currentClosing = dailyTotals[dateStr]?.closingStock || 0;
                                    
                                    // Get previous day's closing
                                    let previousClosing = 0;
                                    if (idx > 0) {
                                      const prevDateStr = format(daysInMonth[idx - 1], 'yyyy-MM-dd');
                                      previousClosing = dailyTotals[prevDateStr]?.closingStock || 0;
                                    } else {
                                      // First day - compare with opening stock
                                      games.forEach(game => {
                                        const stockBegin = getCellValue(game.id, dateStr, 'stockBegin') ?? 0;
                                        previousClosing += stockBegin;
                                      });
                                    }
                                    
                                    // If no data for this day, show dash
                                    if (currentClosing === 0) {
                                      return (
                                        <td key={dateStr} className="px-1 py-2 text-center border-r text-muted-foreground">
                                          -
                                        </td>
                                      );
                                    }
                                    
                                    // Get tickets sold for this day
                                    let ticketsSold = 0;
                                    let activatedToday = 0;
                                    games.forEach(game => {
                                      const calc = getDayCalculations(game.id, dateStr, game);
                                      ticketsSold += calc.ticketsSold ?? 0;
                                      activatedToday += calc.activated ?? 0;
                                    });
                                    
                                    // Expected: previousClosing + activated - sold = currentClosing
                                    const expectedClosing = previousClosing + activatedToday - ticketsSold;
                                    const diff = currentClosing - expectedClosing;
                                    const hasError = diff !== 0 && currentClosing > 0;
                                    
                                    return (
                                      <td key={dateStr} className={`px-1 py-2 text-center font-medium border-r ${hasError ? 'text-destructive' : 'text-green-600'}`}>
                                        {diff === 0 ? '✓' : (diff > 0 ? `+${diff}` : diff)}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-center font-bold bg-amber-100/50">
                                    —
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                        
                        {isSingleBranchSelected && hasAnyUnsavedChanges && (
                          <div className="mt-4 flex justify-end">
                            <Button 
                              onClick={saveAllData} 
                              className="gap-2 bg-green-600 hover:bg-green-700"
                            >
                              <Save className="h-4 w-4" />
                              Save All Changes
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
                    {/* Date Navigation with Date Picker */}
                    <div className="flex items-center gap-1 bg-card rounded-xl p-1 shadow-sm border border-primary/10">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9 rounded-lg hover:bg-primary/10"
                        onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" className="px-4 py-2 min-w-[160px] text-center">
                            <span className={`font-semibold ${isToday(selectedDate) ? 'text-primary' : ''}`}>
                              {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEE, dd MMM yyyy')}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="center">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(d) => d && setSelectedDate(d)}
                            className="p-3 pointer-events-auto"
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
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
                    {isSingleBranchSelected && hasAnyUnsavedChanges && (
                      <Button size="sm" variant="default" onClick={saveAllData} className="gap-2 bg-green-600 hover:bg-green-700">
                        <Save className="h-4 w-4" />
                        Save All
                      </Button>
                    )}
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
                    <NizaLoaderInline />
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
                        const tillVal = getTillValue(dateStr);
                        const editedTill = editingTillReports[dateStr];
                        const savedTill = tillReportByDate[dateStr];
                        const tillDisplay = editedTill !== undefined ? editedTill : (savedTill !== undefined ? savedTill.toString() : '');
                        const diff = tillVal !== null ? totalSales - tillVal : null;
                        const diffOk = diff !== null && Math.abs(diff) < 0.01;
                        return (
                          <>
                            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200/50">
                              <p className="text-sm text-green-700 dark:text-green-400 font-medium">Day's Sales (System)</p>
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
                            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/50">
                              <p className="text-sm text-purple-700 dark:text-purple-400 font-medium">Sales Value as per Day Report (£)</p>
                              {isSingleBranchSelected ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={tillDisplay}
                                  onChange={(e) => handleTillEdit(dateStr, e.target.value)}
                                  onBlur={() => handleTillBlur(dateStr)}
                                  placeholder="Enter sales value (£) from till"
                                  className="mt-1 h-10 text-2xl font-bold text-purple-700 dark:text-purple-400 bg-white/50"
                                />
                              ) : (
                                <p className="text-3xl font-bold text-purple-700 dark:text-purple-400">
                                  {savedTill !== undefined ? `£${savedTill.toFixed(2)}` : '—'}
                                </p>
                              )}
                            </div>
                            <div className={`p-4 rounded-xl border ${diff === null ? 'bg-muted/30 border-muted' : diffOk ? 'bg-green-50 dark:bg-green-950/30 border-green-200/50' : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200/50'}`}>
                              <p className={`text-sm font-medium ${diff === null ? 'text-muted-foreground' : diffOk ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                Sales Value Difference (System − Till)
                              </p>
                              <p className={`text-3xl font-bold ${diff === null ? 'text-muted-foreground' : diffOk ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                {diff === null ? '—' : diffOk ? '✓ Match' : `${diff > 0 ? '+' : ''}£${diff.toFixed(2)}`}
                              </p>
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
                                    £{calc.ticketPrice.toFixed(0)}
                                  </div>
                                  <div>
                                    <CardTitle className="text-lg">{game.game_name}</CardTitle>
                                    <CardDescription>£{calc.ticketPrice.toFixed(2)} per ticket for {format(selectedDate, 'dd MMM')}</CardDescription>
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
                                    min="0"
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
                                    min="0"
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
                                    min="0"
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
                    
                    {/* Daily Physical Stock & Difference - Auto Calculated */}
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
                            {(() => {
                              const dateStr = format(selectedDate, 'yyyy-MM-dd');
                              // Auto-calculate physical count as sum of all games' stock_end for this day
                              let autoPhysicalCount = 0;
                              games.forEach(game => {
                                const stockEnd = getCellValue(game.id, dateStr, 'stockEnd');
                                if (stockEnd !== null && stockEnd !== undefined) {
                                  autoPhysicalCount += stockEnd;
                                }
                              });
                              
                              return (
                                <div className="h-10 px-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 flex items-center justify-center font-bold text-lg text-blue-700 dark:text-blue-400">
                                  {autoPhysicalCount}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Difference</Label>
                            {(() => {
                              const dateStr = format(selectedDate, 'yyyy-MM-dd');
                              const working = dailyTotals[dateStr]?.closingStock || 0;
                              
                              // Auto-calculate physical count
                              let autoPhysicalCount = 0;
                              games.forEach(game => {
                                const stockEnd = getCellValue(game.id, dateStr, 'stockEnd');
                                if (stockEnd !== null && stockEnd !== undefined) {
                                  autoPhysicalCount += stockEnd;
                                }
                              });
                              
                              // Difference = Working - Physical (should be 0 if data matches)
                              const diff = working - autoPhysicalCount;
                              const hasData = working > 0 || autoPhysicalCount > 0;
                              
                              return (
                                <div className={`h-10 px-3 rounded-lg border flex items-center justify-center font-bold text-lg ${
                                  !hasData ? 'bg-muted text-muted-foreground' :
                                  diff === 0 ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800' :
                                  'bg-destructive/10 text-destructive border-destructive/30'
                                }`}>
                                  {hasData ? (
                                    diff === 0 ? (
                                      <span className="flex items-center gap-1">
                                        <CheckCircle2 className="h-4 w-4" /> 0
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1">
                                        <AlertTriangle className="h-4 w-4" />
                                        {diff > 0 ? `+${diff}` : diff}
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

                    {/* Save All Button for Daily View */}
                    {isSingleBranchSelected && hasAnyUnsavedChanges && (
                      <div className="flex justify-end">
                        <Button 
                          onClick={saveAllData} 
                          className="gap-2 bg-green-600 hover:bg-green-700"
                        >
                          <Save className="h-4 w-4" />
                          Save All Changes
                        </Button>
                      </div>
                    )}
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
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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

                  <div className="p-6 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200/50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-amber-500/20 rounded-lg">
                        <Ticket className="h-5 w-5 text-amber-600" />
                      </div>
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Total Tickets Sold</span>
                    </div>
                    <p className="text-4xl font-bold text-amber-700 dark:text-amber-400">
                      {games.reduce((sum, game) => sum + getGameTotals(game.id, game).totalTicketsSold, 0)}
                    </p>
                  </div>
                </div>

                {/* Daily Summary Table */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-4">Daily-wise Summary</h4>
                  <ScrollArea className="w-full">
                    <div className="min-w-max">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-semibold min-w-[100px] border-r">
                              Date
                            </th>
                            <th className="px-3 py-2 text-center font-semibold min-w-[100px] border-r">
                              Opening Stock
                            </th>
                            <th className="px-3 py-2 text-center font-semibold min-w-[100px] border-r">
                              Activated
                            </th>
                            <th className="px-3 py-2 text-center font-semibold min-w-[100px] border-r">
                              Sold
                            </th>
                            <th className="px-3 py-2 text-center font-semibold min-w-[100px] border-r">
                              Closing Stock
                            </th>
                            <th className="px-3 py-2 text-center font-semibold min-w-[110px] border-r">
                              Sales Value
                            </th>
                            <th className="px-3 py-2 text-center font-semibold min-w-[130px] border-r">
                              Sales (Day Report)
                            </th>
                            <th className="px-3 py-2 text-center font-semibold min-w-[100px] border-r">
                              Variance
                            </th>
                            <th className="px-3 py-2 text-center font-semibold min-w-[80px]">
                              Balance ✓
                            </th>

                          </tr>
                        </thead>
                        <tbody>
                          {daysInMonth.map((day, idx) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            let opening = 0, activated = 0, sold = 0, closing = 0, sales = 0;
                            
                            games.forEach(game => {
                              const stockBegin = getCellValue(game.id, dateStr, 'stockBegin') ?? 0;
                              const activatedTickets = getCellValue(game.id, dateStr, 'activatedTickets') ?? 0;
                              const calc = getDayCalculations(game.id, dateStr, game);
                              
                              opening += stockBegin;
                              activated += activatedTickets;
                              sold += calc.ticketsSold ?? 0;
                              closing += calc.stockEnd ?? 0;
                              sales += calc.salesValue ?? 0;
                            });
                            
                            // Check balance: opening + activated - sold = closing
                            const expectedClosing = opening + activated - sold;
                            const isBalanced = closing > 0 && expectedClosing === closing;
                            const hasData = opening > 0 || activated > 0 || closing > 0;
                            
                            return (
                              <tr key={dateStr} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                <td className="sticky left-0 bg-inherit px-3 py-2 font-medium border-r">
                                  {format(day, 'EEE dd')}
                                </td>
                                <td className="px-3 py-2 text-center border-r">
                                  {opening > 0 ? opening : '-'}
                                </td>
                                <td className="px-3 py-2 text-center border-r text-blue-600">
                                  {activated > 0 ? `+${activated}` : '-'}
                                </td>
                                <td className="px-3 py-2 text-center border-r text-amber-600">
                                  {sold > 0 ? sold : '-'}
                                </td>
                                <td className="px-3 py-2 text-center border-r font-medium">
                                  {closing > 0 ? closing : '-'}
                                </td>
                                <td className="px-3 py-2 text-center border-r text-green-600 font-medium">
                                  {sales > 0 ? `£${sales.toFixed(2)}` : '-'}
                                </td>
                                {(() => {
                                  const till = getTillValue(dateStr);
                                  const variance = till != null ? sales - till : null;
                                  return (
                                    <>
                                      <td className="px-3 py-2 text-center border-r text-purple-600 font-medium">
                                        {till != null ? `£${till.toFixed(2)}` : '-'}
                                      </td>
                                      <td className={`px-3 py-2 text-center border-r font-medium ${variance == null ? 'text-muted-foreground' : Math.abs(variance) < 0.005 ? 'text-green-600' : variance > 0 ? 'text-amber-600' : 'text-destructive'}`}>
                                        {variance == null ? '-' : `${variance >= 0 ? '+' : '−'}£${Math.abs(variance).toFixed(2)}`}
                                      </td>
                                    </>
                                  );
                                })()}
                                <td className={`px-3 py-2 text-center ${hasData ? (isBalanced ? 'text-green-600' : 'text-destructive') : 'text-muted-foreground'}`}>
                                  {hasData ? (isBalanced ? '✓' : '✗') : '-'}
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
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
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                              £{getHistoricalTicketPrice(game, format(new Date(), 'yyyy-MM-dd')).toFixed(0)}
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
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shadow-lg text-xs">
                              £{getHistoricalTicketPrice(game, format(new Date(), 'yyyy-MM-dd')).toFixed(0)}
                            </div>
                            <div>
                              <h4 className="font-semibold">{game.game_name}</h4>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span>Current £{game.ticket_price.toFixed(2)} per ticket</span>
                                <span>•</span>
                                <span>This month {getMonthlyPriceLabel(game)}</span>
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
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={newGame.ticketPrice}
                onChange={(e) => setNewGame(prev => ({ ...prev, ticketPrice: e.target.value }))}
                placeholder="e.g. 1, 3, 6, 10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGameDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => addGameMutation.mutate()} 
              disabled={!newGame.name.trim() || !parseFloat(newGame.ticketPrice) || parseFloat(newGame.ticketPrice) <= 0 || addGameMutation.isPending}
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
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={newGame.ticketPrice}
                onChange={(e) => setNewGame(prev => ({ ...prev, ticketPrice: e.target.value }))}
                placeholder="e.g. 1, 3, 6, 10"
              />
              <p className="text-xs text-muted-foreground">
                If price changes, previous dates keep their old price and the new price starts from today.
              </p>
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
              disabled={!newGame.name.trim() || !parseFloat(newGame.ticketPrice) || parseFloat(newGame.ticketPrice) <= 0 || updateGameMutation.isPending}
            >
              {updateGameMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
