import { useState, useEffect } from 'react';
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
import { Progress } from '@/components/ui/progress';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  isManager?: boolean;
}

export default function CustomerAccountDetail({ customer, onBack, canEdit, isSuperAdmin, isManager }: Props) {
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

  // Partial payment state
  const [partialPayOpen, setPartialPayOpen] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialDate, setPartialDate] = useState<Date | undefined>(new Date());
  const [partialMethod, setPartialMethod] = useState('cash');
  const [partialNotes, setPartialNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Manager request flow
  const [requestOpen, setRequestOpen] = useState<{ id: string; type: 'record_payment' | 'mark_fully_paid' } | null>(null);
  const [reqAmount, setReqAmount] = useState('');
  const [reqMethod, setReqMethod] = useState('cash');
  const [reqDate, setReqDate] = useState<Date | undefined>(new Date());
  const [reqNotes, setReqNotes] = useState('');
  const [reqFiles, setReqFiles] = useState<File[]>([]);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [reviewRequest, setReviewRequest] = useState<any | null>(null);
  const [reviewAmount, setReviewAmount] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Item form
  const [itemDesc, setItemDesc] = useState('');
  const [itemAmount, setItemAmount] = useState('');
  const [itemDate, setItemDate] = useState('');
  const [itemTax, setItemTax] = useState('');
  const [itemDiscount, setItemDiscount] = useState('');

  // Load pending payment approval requests for this customer
  const fetchRequests = async () => {
    const monthlyIds = monthlyAccounts.map(m => m.id);
    if (monthlyIds.length === 0) { setPendingRequests([]); return; }
    const { data } = await supabase
      .from('payment_approval_requests' as any)
      .select('*')
      .in('monthly_account_id', monthlyIds)
      .order('created_at', { ascending: false });
    setPendingRequests((data as any) || []);
  };

  // Refetch requests when monthly accounts list changes
  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyAccounts.length]);


  // Stats
  const totalOwed = monthlyAccounts.filter(m => !m.is_paid).reduce((s, m) => s + m.total_due - Number((m as any).amount_paid || 0), 0);
  const totalPaid = monthlyAccounts.reduce((s, m) => s + Number((m as any).amount_paid || 0), 0) + monthlyAccounts.filter(m => m.is_paid && !Number((m as any).amount_paid)).reduce((s, m) => s + m.total_due, 0);

  const handleRecordPartialPayment = async (monthlyId: string) => {
    if (!partialAmount || parseFloat(partialAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setSubmittingPayment(true);
    try {
      const dateStr = partialDate ? format(partialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      const { error } = await supabase.from('customer_payments').insert({
        monthly_account_id: monthlyId,
        amount_paid: parseFloat(partialAmount),
        payment_date: dateStr,
        payment_method: partialMethod,
        notes: partialNotes || null,
        recorded_by: user?.id,
      });
      if (error) throw error;

      // Get account to recalculate
      const account = monthlyAccounts.find(a => a.id === monthlyId);
      if (account) {
        const newAmountPaid = Number((account as any).amount_paid || 0) + parseFloat(partialAmount);
        const fullyPaid = newAmountPaid >= account.total_due;
        await supabase.from('customer_monthly_accounts').update({
          amount_paid: newAmountPaid,
          is_paid: fullyPaid,
          paid_date: fullyPaid ? dateStr : null,
          marked_paid_by: fullyPaid ? user?.id : null,
        }).eq('id', monthlyId);
      }

      toast.success('Payment recorded');
      setPartialPayOpen(null);
      setPartialAmount('');
      setPartialNotes('');
      setPartialMethod('cash');
      // Trigger refetch by invalidating
      window.location.reload(); // simple refresh to refetch
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };


  const handleSubmitRequest = async () => {
    if (!requestOpen || !user) return;
    const acc = monthlyAccounts.find(a => a.id === requestOpen.id);
    if (!acc) return;
    const amountNum = parseFloat(reqAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (reqFiles.length === 0) {
      toast.error('Please upload at least one evidence file (cheque, receipt, etc.)');
      return;
    }
    setSubmittingRequest(true);
    try {
      const uploaded: any[] = [];
      for (const file of reqFiles) {
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `payment-evidence/${user.id}/${fileName}`;
        const { error: upErr } = await supabase.storage.from('documents').upload(filePath, file);
        if (upErr) throw upErr;
        uploaded.push({ name: file.name, path: filePath, size: file.size, type: file.type });
      }

      const { error } = await supabase.from('payment_approval_requests' as any).insert({
        monthly_account_id: requestOpen.id,
        customer_id: customer.id,
        branch_id: customer.branch_id,
        organization_id: customer.organization_id,
        requested_by: user.id,
        request_type: requestOpen.type,
        requested_amount: amountNum,
        payment_method: reqMethod,
        payment_date: reqDate ? format(reqDate, 'yyyy-MM-dd') : null,
        evidence_files: uploaded,
        notes: reqNotes || null,
        status: 'pending',
      } as any);
      if (error) throw error;

      toast.success('Payment request submitted for super admin approval');
      setRequestOpen(null);
      setReqAmount(''); setReqNotes(''); setReqFiles([]); setReqMethod('cash');
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleReviewRequest = async (action: 'approved' | 'rejected') => {
    if (!reviewRequest || !user) return;
    setSubmittingReview(true);
    try {
      const finalAmount = parseFloat(reviewAmount) || Number(reviewRequest.requested_amount);

      const { error: updErr } = await supabase
        .from('payment_approval_requests' as any)
        .update({
          status: action,
          approved_amount: action === 'approved' ? finalAmount : null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: action === 'rejected' ? (reviewReason || null) : null,
        } as any)
        .eq('id', reviewRequest.id);
      if (updErr) throw updErr;

      if (action === 'approved') {
        // Apply payment to the monthly account
        const acc = monthlyAccounts.find(a => a.id === reviewRequest.monthly_account_id);
        const dateStr = reviewRequest.payment_date || format(new Date(), 'yyyy-MM-dd');

        // Insert payment record
        await supabase.from('customer_payments').insert({
          monthly_account_id: reviewRequest.monthly_account_id,
          amount_paid: finalAmount,
          payment_date: dateStr,
          payment_method: reviewRequest.payment_method || 'other',
          notes: `Approved from request: ${reviewRequest.notes || ''}`.trim(),
          recorded_by: user.id,
        });

        if (acc) {
          const newAmountPaid = Number((acc as any).amount_paid || 0) + finalAmount;
          const fullyPaid = reviewRequest.request_type === 'mark_fully_paid' || newAmountPaid >= acc.total_due;
          await supabase.from('customer_monthly_accounts').update({
            amount_paid: fullyPaid ? acc.total_due : newAmountPaid,
            is_paid: fullyPaid,
            paid_date: fullyPaid ? dateStr : null,
            marked_paid_by: fullyPaid ? user.id : null,
          }).eq('id', reviewRequest.monthly_account_id);
        }
      }

      toast.success(action === 'approved' ? 'Payment approved & applied' : 'Request rejected');
      setReviewRequest(null);
      setReviewAmount('');
      setReviewReason('');
      fetchRequests();
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process request');
    } finally {
      setSubmittingReview(false);
    }
  };

  const getRequestForAccount = (accId: string) =>
    pendingRequests.find(r => r.monthly_account_id === accId && r.status === 'pending');

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
                        {account.paid_date && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-xs font-medium mt-0.5">
                            ✓ Paid on {format(new Date(account.paid_date), 'dd MMM yyyy')}
                          </Badge>
                        )}
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
                          <div className="flex items-center gap-2">
                            <p className="text-xl font-bold">£{account.total_due.toFixed(2)}</p>
                            {isSuperAdmin && (
                              <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => { setEditAmountId(account.id); setEditAmountValue(String(account.total_due)); }}>
                                <Edit className="h-3 w-3 mr-1" />Edit
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className={`${status.bg} ${status.text} ${status.border}`}>{status.label}</Badge>
                    </div>
                  </div>

                  {account.notes && <p className="text-sm text-muted-foreground mb-3">{account.notes}</p>}

                  {/* Payment Progress */}
                  {!account.is_paid && account.total_due > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Paid: £{Number((account as any).amount_paid || 0).toFixed(2)} / £{account.total_due.toFixed(2)}</span>
                        <span className="font-medium">Remaining: £{(account.total_due - Number((account as any).amount_paid || 0)).toFixed(2)}</span>
                      </div>
                      <Progress value={(Number((account as any).amount_paid || 0) / account.total_due) * 100} className="h-2" />
                    </div>
                  )}

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

                  {/* Pending payment request banner */}
                  {(() => {
                    const pendingReq = getRequestForAccount(account.id);
                    if (!pendingReq) return null;
                    return (
                      <div className="mb-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/5">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="text-sm">
                            <p className="font-medium text-amber-700">
                              Payment request pending: {pendingReq.request_type === 'mark_fully_paid' ? 'Mark Fully Paid' : 'Record Payment'} — £{Number(pendingReq.requested_amount).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Method: {pendingReq.payment_method || 'n/a'} · {pendingReq.payment_date || 'no date'} · {Array.isArray(pendingReq.evidence_files) ? pendingReq.evidence_files.length : 0} file(s)
                            </p>
                            {pendingReq.notes && <p className="text-xs mt-1">{pendingReq.notes}</p>}
                          </div>
                          {isSuperAdmin && (
                            <Button size="sm" onClick={() => { setReviewRequest(pendingReq); setReviewAmount(String(pendingReq.requested_amount)); setReviewReason(''); }}>
                              Review
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {canEdit && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setAddItemOpen(account.id)}>
                          <Plus className="h-3.5 w-3.5 mr-1" />Add Item
                        </Button>
                        {!account.is_paid && (
                          <Button size="sm" variant="outline" onClick={() => { setPartialPayOpen(account.id); setPartialAmount(''); setPartialNotes(''); }}>
                            <PoundSterling className="h-3.5 w-3.5 mr-1" />Record Payment
                          </Button>
                        )}
                        {!account.is_paid ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                                <Check className="h-3.5 w-3.5 mr-1" />Mark Fully Paid
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

                    {/* Manager request flow — only when not super admin/HR and no pending request */}
                    {isManager && !account.is_paid && !getRequestForAccount(account.id) && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => {
                          const remaining = account.total_due - Number((account as any).amount_paid || 0);
                          setRequestOpen({ id: account.id, type: 'record_payment' });
                          setReqAmount(String(remaining > 0 ? remaining : ''));
                          setReqNotes(''); setReqFiles([]); setReqMethod('cash'); setReqDate(new Date());
                        }}>
                          <PoundSterling className="h-3.5 w-3.5 mr-1" />Request Record Payment
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                          const remaining = account.total_due - Number((account as any).amount_paid || 0);
                          setRequestOpen({ id: account.id, type: 'mark_fully_paid' });
                          setReqAmount(String(remaining > 0 ? remaining : account.total_due));
                          setReqNotes(''); setReqFiles([]); setReqMethod('cash'); setReqDate(new Date());
                        }}>
                          <Check className="h-3.5 w-3.5 mr-1" />Request Mark Fully Paid
                        </Button>
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

      {/* Partial Payment Dialog */}
      <Dialog open={!!partialPayOpen} onOpenChange={() => setPartialPayOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {partialPayOpen && (() => {
              const acc = monthlyAccounts.find(a => a.id === partialPayOpen);
              const remaining = acc ? acc.total_due - Number((acc as any).amount_paid || 0) : 0;
              return (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <div className="flex justify-between"><span>Total Due:</span><span className="font-medium">£{acc?.total_due.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Already Paid:</span><span className="font-medium">£{Number((acc as any)?.amount_paid || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Remaining:</span><span>£{remaining.toFixed(2)}</span></div>
                </div>
              );
            })()}
            <div>
              <Label>Amount (£) *</Label>
              <Input type="number" step="0.01" min="0.01" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={partialMethod} onValueChange={setPartialMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !partialDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {partialDate ? format(partialDate, 'dd MMM yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={partialDate} onSelect={setPartialDate} className={cn("p-3 pointer-events-auto")} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={partialNotes} onChange={e => setPartialNotes(e.target.value)} rows={2} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialPayOpen(null)}>Cancel</Button>
            <Button onClick={() => partialPayOpen && handleRecordPartialPayment(partialPayOpen)} disabled={submittingPayment || !partialAmount}>
              {submittingPayment ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager Payment Request Dialog */}
      <Dialog open={!!requestOpen} onOpenChange={() => setRequestOpen(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {requestOpen?.type === 'mark_fully_paid' ? 'Request — Mark Fully Paid' : 'Request — Record Payment'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Upload payment evidence (cheque image, bank receipt, etc.). Super admin must approve before this is recorded.
            </p>
            <div>
              <Label>Amount (£) *</Label>
              <Input type="number" step="0.01" min="0.01" value={reqAmount} onChange={e => setReqAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={reqMethod} onValueChange={setReqMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !reqDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reqDate ? format(reqDate, 'dd MMM yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={reqDate} onSelect={setReqDate} className={cn("p-3 pointer-events-auto")} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Evidence Files *</Label>
              <label htmlFor="req-files" className="cursor-pointer block">
                <div className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors w-fit">
                  <Plus className="h-4 w-4" />
                  <span className="text-sm">Upload Files</span>
                </div>
                <input
                  id="req-files"
                  type="file"
                  multiple
                  accept="*/*"
                  onChange={(e) => setReqFiles(prev => [...prev, ...Array.from(e.target.files || [])])}
                  className="hidden"
                />
              </label>
              {reqFiles.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {reqFiles.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
                      <span className="max-w-[140px] truncate">{f.name}</span>
                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => setReqFiles(prev => prev.filter((_, i) => i !== idx))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={reqNotes} onChange={e => setReqNotes(e.target.value)} rows={2} placeholder="Optional context for the super admin" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(null)}>Cancel</Button>
            <Button onClick={handleSubmitRequest} disabled={submittingRequest || !reqAmount || reqFiles.length === 0}>
              {submittingRequest ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super Admin Review Dialog */}
      <Dialog open={!!reviewRequest} onOpenChange={() => setReviewRequest(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Payment Request</DialogTitle>
          </DialogHeader>
          {reviewRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="flex justify-between"><span>Type:</span><span className="font-medium">{reviewRequest.request_type === 'mark_fully_paid' ? 'Mark Fully Paid' : 'Record Payment'}</span></div>
                <div className="flex justify-between"><span>Requested Amount:</span><span className="font-medium">£{Number(reviewRequest.requested_amount).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Method:</span><span>{reviewRequest.payment_method || 'n/a'}</span></div>
                <div className="flex justify-between"><span>Date:</span><span>{reviewRequest.payment_date || 'n/a'}</span></div>
                {reviewRequest.notes && <div className="pt-1 border-t mt-1"><span className="text-muted-foreground">Notes: </span>{reviewRequest.notes}</div>}
              </div>

              {Array.isArray(reviewRequest.evidence_files) && reviewRequest.evidence_files.length > 0 && (
                <div>
                  <Label>Evidence</Label>
                  <div className="space-y-1 mt-1">
                    {reviewRequest.evidence_files.map((f: any, idx: number) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={async () => {
                          const { data } = await supabase.storage.from('documents').createSignedUrl(f.path, 3600);
                          if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                        }}
                      >
                        <Package className="h-3.5 w-3.5 mr-2" />{f.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>Approved Amount (£) — editable</Label>
                <Input type="number" step="0.01" value={reviewAmount} onChange={e => setReviewAmount(e.target.value)} />
              </div>

              <div>
                <Label>Rejection Reason (only if rejecting)</Label>
                <Textarea value={reviewReason} onChange={e => setReviewReason(e.target.value)} rows={2} placeholder="Optional" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewRequest(null)} disabled={submittingReview}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleReviewRequest('rejected')} disabled={submittingReview}>
              Reject
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleReviewRequest('approved')} disabled={submittingReview}>
              {submittingReview ? 'Processing...' : 'Approve & Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
