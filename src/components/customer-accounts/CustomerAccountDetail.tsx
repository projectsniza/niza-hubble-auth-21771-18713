import { useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Plus, PoundSterling, CheckCircle2, Clock, Calendar as CalendarIcon,
  Package, Trash2, Check, X, Edit
} from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { useAuth } from '@/contexts/AuthContext';
import { useMonthlyAccounts, MonthlyAccount, CustomerAccount } from '@/hooks/useCustomerAccounts';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface Props {
  customer: CustomerAccount;
  onBack: () => void;
  canEdit: boolean;
  isSuperAdmin?: boolean;
}

export default function CustomerAccountDetail({ customer, onBack, canEdit, isSuperAdmin }: Props) {
  const { user } = useAuth();
  const { monthlyAccounts, isLoading, createMonthly, updateMonthly, addItem, deleteItem, markPaid } = useMonthlyAccounts(customer.id);
  const [editAmountId, setEditAmountId] = useState<string | null>(null);
  const [editAmountValue, setEditAmountValue] = useState('');
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [paidDate, setPaidDate] = useState<Date | undefined>(new Date());
  const [addMonthOpen, setAddMonthOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(new Date().getMonth());
  const [totalDue, setTotalDue] = useState('');
  const [monthNotes, setMonthNotes] = useState('');

  // Item form
  const [itemDesc, setItemDesc] = useState('');
  const [itemAmount, setItemAmount] = useState('');
  const [itemDate, setItemDate] = useState('');
  const [itemTax, setItemTax] = useState('');
  const [itemDiscount, setItemDiscount] = useState('');

  // Stats
  const totalOwed = monthlyAccounts.filter(m => !m.is_paid).reduce((s, m) => s + m.total_due, 0);
  const totalPaid = monthlyAccounts.filter(m => m.is_paid).reduce((s, m) => s + m.total_due, 0);

  const getStatusColor = (account: MonthlyAccount) => {
    if (account.is_paid) return { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/30', label: 'Paid' };
    const monthDate = new Date(account.month_date);
    const now = new Date();
    if (monthDate < startOfMonth(now)) return { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30', label: 'Overdue' };
    return { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/30', label: 'Pending' };
  };

  const handleAddMonth = async () => {
    const monthDate = `${selectedYear}-${String(selectedMonthIdx + 1).padStart(2, '0')}-01`;
    await createMonthly.mutateAsync({
      customer_id: customer.id,
      month_date: monthDate,
      total_due: parseFloat(totalDue) || 0,
      notes: monthNotes || undefined,
      organization_id: customer.organization_id || undefined,
      branch_id: customer.branch_id,
    });
    setAddMonthOpen(false);
    setTotalDue('');
    setMonthNotes('');
  };

  const handleAddItem = async (monthlyId: string) => {
    await addItem.mutateAsync({
      monthly_account_id: monthlyId,
      description: itemDesc,
      amount: parseFloat(itemAmount) || 0,
      purchased_date: itemDate || undefined,
      tax: itemTax ? parseFloat(itemTax) : undefined,
      discount: itemDiscount ? parseFloat(itemDiscount) : undefined,
    });
    setAddItemOpen(null);
    setItemDesc(''); setItemAmount(''); setItemDate(''); setItemTax(''); setItemDiscount('');
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-xl shadow-md">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              <p className="text-sm text-muted-foreground">{customer.branches?.name} {customer.email && `· ${customer.email}`}</p>
            </div>
          </div>
        </div>
        <Button onClick={() => setAddMonthOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Add Month
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10"><PoundSterling className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">£{(totalOwed + totalPaid).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total All Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10"><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">£{totalPaid.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/10"><Clock className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold text-destructive">£{totalOwed.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Records */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><NizaLoaderInline /></div>
      ) : monthlyAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Monthly Records</h3>
            <p className="text-muted-foreground">Add the first monthly account entry</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {monthlyAccounts.map(account => {
            const status = getStatusColor(account);
            return (
              <Card key={account.id} className={`border-l-4 ${account.is_paid ? 'border-l-emerald-500' : status.label === 'Overdue' ? 'border-l-destructive' : 'border-l-amber-500'} hover:shadow-md transition-shadow`}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${status.bg}`}>
                        <CalendarIcon className={`h-5 w-5 ${status.text}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{format(new Date(account.month_date), 'MMMM yyyy')}</h3>
                        {account.paid_date && <p className="text-xs text-muted-foreground">Paid on {format(new Date(account.paid_date), 'dd MMM yyyy')}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {editAmountId === account.id ? (
                          <div className="flex items-center gap-2">
                            <span>£</span>
                            <Input 
                              type="number" 
                              step="0.01" 
                              value={editAmountValue} 
                              onChange={e => setEditAmountValue(e.target.value)} 
                              className="w-28 h-8"
                            />
                            <Button size="sm" variant="default" className="h-8" onClick={async () => {
                              await updateMonthly.mutateAsync({ id: account.id, total_due: parseFloat(editAmountValue) || 0 });
                              setEditAmountId(null);
                            }}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditAmountId(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <p className="text-xl font-bold">£{account.total_due.toFixed(2)}</p>
                            {isSuperAdmin && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditAmountId(account.id); setEditAmountValue(String(account.total_due)); }}>
                                <Edit className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className={`${status.bg} ${status.text} ${status.border}`}>{status.label}</Badge>
                    </div>
                  </div>

                  {account.notes && <p className="text-sm text-muted-foreground mb-3">{account.notes}</p>}

                  {/* Items */}
                  {account.items && account.items.length > 0 && (
                    <div className="mb-3 bg-muted/50 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Items</p>
                      {account.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{item.description}</span>
                            {item.purchased_date && <span className="text-xs text-muted-foreground">({format(new Date(item.purchased_date), 'dd/MM/yy')})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">£{Number(item.amount).toFixed(2)}</span>
                            {Number(item.tax) > 0 && <span className="text-xs text-muted-foreground">+£{Number(item.tax).toFixed(2)} tax</span>}
                            {Number(item.discount) > 0 && <span className="text-xs text-emerald-600">-£{Number(item.discount).toFixed(2)}</span>}
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteItem.mutateAsync(item.id)}>
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {canEdit && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setAddItemOpen(account.id)}>
                          <Plus className="h-3.5 w-3.5 mr-1" />Add Item
                        </Button>
                        {!account.is_paid ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                                <Check className="h-3.5 w-3.5 mr-1" />Mark Paid
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-4" align="end">
                              <div className="space-y-3">
                                <p className="text-sm font-medium">Select date paid</p>
                                <Calendar
                                  mode="single"
                                  selected={paidDate}
                                  onSelect={setPaidDate}
                                  className={cn("p-3 pointer-events-auto")}
                                  initialFocus
                                />
                                <Button 
                                  size="sm" 
                                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                                  disabled={!paidDate}
                                  onClick={() => {
                                    const dateStr = paidDate ? format(paidDate, 'yyyy-MM-dd') : undefined;
                                    markPaid.mutateAsync({ id: account.id, isPaid: true, paidDate: dateStr });
                                  }}
                                >
                                  Confirm Paid {paidDate ? format(paidDate, 'dd MMM yyyy') : ''}
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => markPaid.mutateAsync({ id: account.id, isPaid: false })}>
                            <X className="h-3.5 w-3.5 mr-1" />Unmark Paid
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Month Dialog */}
      <Dialog open={addMonthOpen} onOpenChange={setAddMonthOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Monthly Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Month</Label>
                <Select value={String(selectedMonthIdx)} onValueChange={v => setSelectedMonthIdx(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Total Due (£)</Label>
              <Input type="number" step="0.01" value={totalDue} onChange={e => setTotalDue(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={monthNotes} onChange={e => setMonthNotes(e.target.value)} rows={2} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMonthOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMonth} disabled={createMonthly.isPending}>
              {createMonthly.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={!!addItemOpen} onOpenChange={() => setAddItemOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Item</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Description *</Label>
              <Input value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="Item description" />
            </div>
            <div>
              <Label>Amount (£) *</Label>
              <Input type="number" step="0.01" value={itemAmount} onChange={e => setItemAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Purchase Date</Label>
              <Input type="date" value={itemDate} onChange={e => setItemDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tax (£)</Label>
                <Input type="number" step="0.01" value={itemTax} onChange={e => setItemTax(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label>Discount (£)</Label>
                <Input type="number" step="0.01" value={itemDiscount} onChange={e => setItemDiscount(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(null)}>Cancel</Button>
            <Button onClick={() => addItemOpen && handleAddItem(addItemOpen)} disabled={addItem.isPending || !itemDesc || !itemAmount}>
              {addItem.isPending ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
