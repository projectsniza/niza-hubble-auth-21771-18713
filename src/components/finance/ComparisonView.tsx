import { Card } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface FinancialData {
  name: string;
  quarter: string;
  storeName: string;
  revenue: Record<string, number>;
  costOfSales: Record<string, number>;
  adminCosts: Record<string, number>;
  otherIncome: Record<string, number>;
}

interface ComparisonViewProps {
  reports: FinancialData[];
}

export default function ComparisonView({ reports }: ComparisonViewProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(value);
  };

  const calculateMetrics = (data: FinancialData) => {
    const totalTurnover = Object.values(data.revenue).reduce((a, b) => a + b, 0);
    const totalCostOfSales = Object.values(data.costOfSales).reduce((a, b) => a + b, 0);
    const grossProfit = totalTurnover - totalCostOfSales;
    const grossProfitMargin = totalTurnover > 0 ? (grossProfit / totalTurnover) * 100 : 0;
    const totalAdminCosts = Object.values(data.adminCosts).reduce((a, b) => a + b, 0);
    const operatingProfit = grossProfit - totalAdminCosts;
    const totalOtherIncome = Object.values(data.otherIncome).reduce((a, b) => a + b, 0);
    const profitBeforeTax = operatingProfit + totalOtherIncome;

    return {
      totalTurnover,
      totalCostOfSales,
      grossProfit,
      grossProfitMargin,
      totalAdminCosts,
      operatingProfit,
      totalOtherIncome,
      profitBeforeTax,
    };
  };

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Reports Selected</h3>
        <p className="text-muted-foreground">Select reports from the sidebar to compare</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {/* Header Row */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
          <div className="font-bold text-lg">Metric</div>
          {reports.map((report, idx) => (
            <Card key={idx} className="p-4 bg-primary/5">
              <div className="font-bold text-center">{report.storeName}</div>
              <div className="text-sm text-center text-muted-foreground">{report.quarter}</div>
            </Card>
          ))}
        </div>

        {/* Turnover */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
          <div className="font-semibold text-green-500 flex items-center">Total Turnover</div>
          {reports.map((report, idx) => {
            const metrics = calculateMetrics(report);
            return (
              <Card key={idx} className="p-3 text-center bg-green-500/5 border-green-500/20">
                <div className="font-bold text-green-500">{formatCurrency(metrics.totalTurnover)}</div>
              </Card>
            );
          })}
        </div>

        {/* Cost of Sales */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
          <div className="font-semibold text-orange-500 flex items-center">Cost of Sales</div>
          {reports.map((report, idx) => {
            const metrics = calculateMetrics(report);
            return (
              <Card key={idx} className="p-3 text-center bg-orange-500/5 border-orange-500/20">
                <div className="font-bold text-orange-500">{formatCurrency(metrics.totalCostOfSales)}</div>
              </Card>
            );
          })}
        </div>

        {/* Gross Profit */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
          <div className="font-semibold text-emerald-600 flex items-center">Gross Profit</div>
          {reports.map((report, idx) => {
            const metrics = calculateMetrics(report);
            return (
              <Card key={idx} className="p-3 text-center bg-emerald-600/10 border-emerald-600/30">
                <div className="font-bold text-emerald-600">{formatCurrency(metrics.grossProfit)}</div>
                <div className="text-xs text-muted-foreground mt-1">{metrics.grossProfitMargin.toFixed(2)}%</div>
              </Card>
            );
          })}
        </div>

        {/* Admin Costs */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
          <div className="font-semibold text-red-500 flex items-center">Admin Costs</div>
          {reports.map((report, idx) => {
            const metrics = calculateMetrics(report);
            return (
              <Card key={idx} className="p-3 text-center bg-red-500/5 border-red-500/20">
                <div className="font-bold text-red-500">{formatCurrency(metrics.totalAdminCosts)}</div>
              </Card>
            );
          })}
        </div>

        {/* Operating Profit */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
          <div className="font-semibold text-blue-500 flex items-center">Operating Profit</div>
          {reports.map((report, idx) => {
            const metrics = calculateMetrics(report);
            return (
              <Card key={idx} className="p-3 text-center bg-blue-500/10 border-blue-500/30">
                <div className="font-bold text-blue-500">{formatCurrency(metrics.operatingProfit)}</div>
              </Card>
            );
          })}
        </div>

        {/* Other Income */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
          <div className="font-semibold text-purple-500 flex items-center">Other Income</div>
          {reports.map((report, idx) => {
            const metrics = calculateMetrics(report);
            return (
              <Card key={idx} className="p-3 text-center bg-purple-500/5 border-purple-500/20">
                <div className="font-bold text-purple-500">{formatCurrency(metrics.totalOtherIncome)}</div>
              </Card>
            );
          })}
        </div>

        {/* Final Profit */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
          <div className="font-semibold text-green-600 flex items-center">Profit Before Tax</div>
          {reports.map((report, idx) => {
            const metrics = calculateMetrics(report);
            return (
              <Card key={idx} className="p-4 text-center bg-gradient-to-r from-green-500/20 to-emerald-600/20 border-green-500/30">
                <div className="font-bold text-xl text-green-600">{formatCurrency(metrics.profitBeforeTax)}</div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
