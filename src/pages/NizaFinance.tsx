import { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, Download, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import nizaCloudLogo from '@/assets/niza-cloud-logo.png';
import { Button } from '@/components/ui/button';
import AppsDialog from '@/components/dashboard/AppsDialog';
import { Card } from '@/components/ui/card';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PLCalculatorDialog from '@/components/finance/PLCalculatorDialog';
import ComparisonView from '@/components/finance/ComparisonView';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';

interface FinancialData {
  id?: string;
  name: string;
  quarter: string;
  storeName: string;
  revenue: {
    alcohol: number;
    domesticItems: number;
    drinks: number;
    grocery: number;
    groceryZero: number;
    newspapers: number;
    tobacco: number;
  };
  costOfSales: {
    inventoryChange: number;
    inventoryTransfer: number;
    purchases0: number;
    purchases20: number;
    purchases5: number;
  };
  adminCosts: {
    auditFees: number;
    bankFees: number;
    cleaning: number;
    clockRite: number;
    compliance: number;
    creditCardAmex: number;
    creditCardCommission: number;
    employersNI: number;
    insuranceBuilding: number;
    insuranceShop: number;
    interestPaid: number;
    itSoftware: number;
    licence: number;
    lightPower: number;
    otherExpenses: number;
    payPoint: number;
    pensions: number;
    pestControl: number;
    professionalHR: number;
    professionalStockTaking: number;
    rates: number;
    rent: number;
    repairs: number;
    salaries: number;
    sanitary: number;
    security: number;
    shopMaintain: number;
    staffTraining: number;
    staffWelfare: number;
    sundry: number;
    telephone: number;
    travel: number;
    wasteDisposal: number;
    water: number;
    writeOff: number;
  };
  otherIncome: {
    lotteryCommission: number;
    parcelCommission: number;
    payPointCommission: number;
    atmRental: number;
  };
}

export default function NizaFinance() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [savedReports, setSavedReports] = useState<FinancialData[]>([]);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('reports');
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('financial_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const reports: FinancialData[] = (data || []).map((report: any) => ({
        id: report.id,
        name: report.name,
        quarter: report.quarter,
        storeName: report.store_name,
        revenue: report.revenue as FinancialData['revenue'],
        costOfSales: report.cost_of_sales as FinancialData['costOfSales'],
        adminCosts: report.admin_costs as FinancialData['adminCosts'],
        otherIncome: report.other_income as FinancialData['otherIncome'],
      }));

      setSavedReports(reports);
    } catch (error: unknown) {
      console.error('Error fetching reports:', error);
      toast({
        title: "Error",
        description: "Failed to load reports.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: FinancialData) => {
    try {
      const { data: insertedData, error } = await supabase
        .from('financial_reports')
        .insert({
          name: data.name,
          quarter: data.quarter,
          store_name: data.storeName,
          revenue: data.revenue,
          cost_of_sales: data.costOfSales,
          admin_costs: data.adminCosts,
          other_income: data.otherIncome,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newReport: FinancialData = {
        id: insertedData.id,
        name: insertedData.name,
        quarter: insertedData.quarter,
        storeName: insertedData.store_name,
        revenue: insertedData.revenue as FinancialData['revenue'],
        costOfSales: insertedData.cost_of_sales as FinancialData['costOfSales'],
        adminCosts: insertedData.admin_costs as FinancialData['adminCosts'],
        otherIncome: insertedData.other_income as FinancialData['otherIncome'],
      };

      setSavedReports([newReport, ...savedReports]);
      toast({
        title: "Report Saved",
        description: `${data.name} has been saved successfully.`,
      });
    } catch (error: unknown) {
      console.error('Error saving report:', error);
      toast({
        title: "Error",
        description: "Failed to save report.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (report: FinancialData) => {
    if (!report.id) return;

    try {
      const { error } = await supabase
        .from('financial_reports')
        .delete()
        .eq('id', report.id);

      if (error) throw error;

      setSavedReports(savedReports.filter(r => r.id !== report.id));
      setSelectedReports(selectedReports.filter(id => id !== report.id));
      toast({
        title: "Report Deleted",
        description: "The report has been removed.",
      });
    } catch (error: unknown) {
      console.error('Error deleting report:', error);
      toast({
        title: "Error",
        description: "Failed to delete report.",
        variant: "destructive",
      });
    }
  };

  const toggleReportSelection = (reportId: string) => {
    setSelectedReports(prev =>
      prev.includes(reportId) ? prev.filter(id => id !== reportId) : [...prev, reportId]
    );
  };

  const handleExportPDF = async (report: FinancialData) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFontSize(20);
    pdf.setTextColor(34, 197, 94);
    pdf.text('Profit & Loss Report', pageWidth / 2, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(report.name, pageWidth / 2, 30, { align: 'center' });
    pdf.text(`${report.storeName} - ${report.quarter}`, pageWidth / 2, 37, { align: 'center' });
    
    let yPos = 50;
    
    const totalTurnover = Object.values(report.revenue).reduce((a, b) => a + b, 0);
    const totalCostOfSales = Object.values(report.costOfSales).reduce((a, b) => a + b, 0);
    const grossProfit = totalTurnover - totalCostOfSales;
    const totalAdminCosts = Object.values(report.adminCosts).reduce((a, b) => a + b, 0);
    const operatingProfit = grossProfit - totalAdminCosts;
    const totalOtherIncome = Object.values(report.otherIncome).reduce((a, b) => a + b, 0);
    const profitBeforeTax = operatingProfit + totalOtherIncome;
    
    pdf.setFontSize(14);
    pdf.setTextColor(34, 197, 94);
    pdf.text('Financial Summary', 15, yPos);
    yPos += 10;
    
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Total Turnover: ${formatCurrency(totalTurnover)}`, 15, yPos);
    yPos += 7;
    pdf.text(`Cost of Sales: ${formatCurrency(totalCostOfSales)}`, 15, yPos);
    yPos += 7;
    pdf.text(`Gross Profit: ${formatCurrency(grossProfit)}`, 15, yPos);
    yPos += 7;
    pdf.text(`Administrative Costs: ${formatCurrency(totalAdminCosts)}`, 15, yPos);
    yPos += 7;
    pdf.text(`Operating Profit: ${formatCurrency(operatingProfit)}`, 15, yPos);
    yPos += 7;
    pdf.text(`Other Income: ${formatCurrency(totalOtherIncome)}`, 15, yPos);
    yPos += 10;
    
    pdf.setFontSize(12);
    pdf.setTextColor(34, 197, 94);
    pdf.text(`Final Profit Before Tax: ${formatCurrency(profitBeforeTax)}`, 15, yPos);
    
    pdf.save(`${report.name.replace(/\s+/g, '_')}.pdf`);
    
    toast({
      title: "PDF Exported",
      description: `${report.name} has been downloaded.`,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(value);
  };

  const selectedReportData = savedReports.filter(r => r.id && selectedReports.includes(r.id));

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside 
        className={`${sidebarCollapsed ? 'w-16' : 'w-80'} transition-all duration-300 border-r border-primary/20 flex flex-col relative h-screen sticky top-0 flex-shrink-0`}
        style={{ background: 'var(--gradient-panel)' }}
      >
        {/* Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-4 top-7 h-8 w-8 rounded-full bg-background border-2 border-primary shadow-lg hover:bg-primary hover:text-primary-foreground z-20 hidden md:flex items-center justify-center cursor-pointer"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>

        <div className={`${sidebarCollapsed ? 'p-2' : 'p-4'} border-b border-primary/20 flex items-center justify-center min-h-[60px]`}>
          <img src={nizaCloudLogo} alt="Niza Finance" className={sidebarCollapsed ? "h-10 w-auto object-contain" : "h-10"} />
        </div>

        {!sidebarCollapsed && (
          <div className="p-6 border-b border-primary/20">
            <div className="mb-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
                Niza Finance
              </h1>
              <p className="text-xs text-muted-foreground">P&L Management</p>
            </div>
            <Button onClick={() => setCalculatorOpen(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Profit & Loss Calculator
            </Button>
          </div>
        )}

        {sidebarCollapsed && (
          <div className="p-2 border-b border-primary/20 flex justify-center">
            <Button onClick={() => setCalculatorOpen(true)} size="icon" className="h-10 w-10">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {!sidebarCollapsed && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Saved Reports</h3>
                {selectedReports.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('comparison')}
                    className="h-7 text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Compare
                  </Button>
                )}
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <NizaLoaderInline />
                </div>
              ) : savedReports.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No reports yet</p>
                </div>
              ) : (
                savedReports.map((report) => (
                  <Card
                    key={report.id}
                    className="p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={report.id ? selectedReports.includes(report.id) : false}
                        onCheckedChange={() => report.id && toggleReportSelection(report.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{report.name}</h4>
                        <p className="text-xs text-muted-foreground">{report.storeName}</p>
                        <p className="text-xs text-muted-foreground">{report.quarter}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleExportPDF(report)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(report)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Apps Dialog */}
        <header className="h-16 border-b border-border bg-card flex items-center px-6 relative z-10">
          <AppsDialog />
        </header>

        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <div className="border-b bg-card/30 px-6 py-4">
              <TabsList>
                <TabsTrigger value="reports">All Reports</TabsTrigger>
                <TabsTrigger value="comparison" disabled={selectedReports.length === 0}>
                  Comparison {selectedReports.length > 0 && `(${selectedReports.length})`}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="reports" className="p-6 m-0">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <NizaLoaderInline />
                </div>
              ) : savedReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">No Reports Yet</h2>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Create your first Profit & Loss report to start tracking financial performance across branches.
                  </p>
                  <Button onClick={() => setCalculatorOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create First Report
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedReports.map((report) => {
                    const totalTurnover = Object.values(report.revenue).reduce((a, b) => a + b, 0);
                    const totalCostOfSales = Object.values(report.costOfSales).reduce((a, b) => a + b, 0);
                    const grossProfit = totalTurnover - totalCostOfSales;
                    const totalAdminCosts = Object.values(report.adminCosts).reduce((a, b) => a + b, 0);
                    const operatingProfit = grossProfit - totalAdminCosts;
                    const totalOtherIncome = Object.values(report.otherIncome).reduce((a, b) => a + b, 0);
                    const profitBeforeTax = operatingProfit + totalOtherIncome;

                    return (
                      <Card key={report.id} className="p-4 hover:shadow-lg transition-shadow">
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-bold text-lg">{report.name}</h3>
                            <p className="text-sm text-muted-foreground">{report.storeName}</p>
                            <p className="text-xs text-muted-foreground">{report.quarter}</p>
                          </div>
                          
                          <div className="space-y-2 pt-2 border-t">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Turnover</span>
                              <span className="font-medium text-green-500">{formatCurrency(totalTurnover)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Gross Profit</span>
                              <span className="font-medium text-emerald-600">{formatCurrency(grossProfit)}</span>
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t">
                              <span className="font-medium">Final Profit</span>
                              <span className="font-bold text-green-600">{formatCurrency(profitBeforeTax)}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleExportPDF(report)}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              PDF
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(report)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="comparison" className="p-6 m-0">
              <ComparisonView reports={selectedReportData} />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <PLCalculatorDialog
        open={calculatorOpen}
        onOpenChange={setCalculatorOpen}
        onSave={handleSave}
      />
    </div>
  );
}
