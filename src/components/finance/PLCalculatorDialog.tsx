import { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FinancialData {
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

const initialData: Omit<FinancialData, 'name'> = {
  quarter: 'Q1 2024',
  storeName: '',
  revenue: {
    alcohol: 0,
    domesticItems: 0,
    drinks: 0,
    grocery: 0,
    groceryZero: 0,
    newspapers: 0,
    tobacco: 0,
  },
  costOfSales: {
    inventoryChange: 0,
    inventoryTransfer: 0,
    purchases0: 0,
    purchases20: 0,
    purchases5: 0,
  },
  adminCosts: {
    auditFees: 0,
    bankFees: 0,
    cleaning: 0,
    clockRite: 0,
    compliance: 0,
    creditCardAmex: 0,
    creditCardCommission: 0,
    employersNI: 0,
    insuranceBuilding: 0,
    insuranceShop: 0,
    interestPaid: 0,
    itSoftware: 0,
    licence: 0,
    lightPower: 0,
    otherExpenses: 0,
    payPoint: 0,
    pensions: 0,
    pestControl: 0,
    professionalHR: 0,
    professionalStockTaking: 0,
    rates: 0,
    rent: 0,
    repairs: 0,
    salaries: 0,
    sanitary: 0,
    security: 0,
    shopMaintain: 0,
    staffTraining: 0,
    staffWelfare: 0,
    sundry: 0,
    telephone: 0,
    travel: 0,
    wasteDisposal: 0,
    water: 0,
    writeOff: 0,
  },
  otherIncome: {
    lotteryCommission: 0,
    parcelCommission: 0,
    payPointCommission: 0,
    atmRental: 0,
  },
};

interface PLCalculatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: FinancialData) => void;
}

export default function PLCalculatorDialog({ open, onOpenChange, onSave }: PLCalculatorDialogProps) {
  const [data, setData] = useState<Omit<FinancialData, 'name'>>(initialData);
  const [reportName, setReportName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const totalTurnover = Object.values(data.revenue).reduce((a, b) => a + b, 0);
  const totalCostOfSales = Object.values(data.costOfSales).reduce((a, b) => a + b, 0);
  const grossProfit = totalTurnover - totalCostOfSales;
  const grossProfitMargin = totalTurnover > 0 ? (grossProfit / totalTurnover) * 100 : 0;
  const totalAdminCosts = Object.values(data.adminCosts).reduce((a, b) => a + b, 0);
  const operatingProfit = grossProfit - totalAdminCosts;
  const totalOtherIncome = Object.values(data.otherIncome).reduce((a, b) => a + b, 0);
  const profitBeforeTax = operatingProfit + totalOtherIncome;
  const profitAfterTax = profitBeforeTax;

  const updateField = (section: keyof Omit<FinancialData, 'name'>, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setData((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as any),
        [field]: numValue,
      },
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(value);
  };

  const handleSaveClick = () => {
    setShowSaveDialog(true);
  };

  const handleConfirmSave = () => {
    if (!reportName.trim() || !data.storeName.trim()) {
      return;
    }
    onSave({ ...data, name: reportName });
    setShowSaveDialog(false);
    setReportName('');
    setData(initialData);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
              Profit & Loss Calculator
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Store & Period Selection */}
            <Card className="p-4 bg-card/50 border-primary/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2">Branch/Store Name</Label>
                  <Input
                    value={data.storeName}
                    onChange={(e) => setData({ ...data, storeName: e.target.value })}
                    placeholder="Enter branch name"
                  />
                </div>
                <div>
                  <Label className="mb-2">Quarter/Period</Label>
                  <Select value={data.quarter} onValueChange={(value) => setData({ ...data, quarter: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Q1 2024">Q1 2024 (Jan-Mar)</SelectItem>
                      <SelectItem value="Q2 2024">Q2 2024 (Apr-Jun)</SelectItem>
                      <SelectItem value="Q3 2024">Q3 2024 (Jul-Sep)</SelectItem>
                      <SelectItem value="Q4 2024">Q4 2024 (Oct-Dec)</SelectItem>
                      <SelectItem value="Q1 2025">Q1 2025 (Jan-Mar)</SelectItem>
                      <SelectItem value="Q2 2025">Q2 2025 (Apr-Jun)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Turnover */}
            <Card className="p-4 bg-card/50 border-primary/20">
              <h3 className="text-lg font-bold mb-3 text-green-500">Turnover</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(data.revenue).map(([key, value]) => (
                  <div key={key}>
                    <Label className="text-xs capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={value}
                      onChange={(e) => updateField('revenue', key, e.target.value)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between font-bold">
                  <span>Total Turnover</span>
                  <span className="text-green-500">{formatCurrency(totalTurnover)}</span>
                </div>
              </div>
            </Card>

            {/* Cost of Sales */}
            <Card className="p-4 bg-card/50 border-primary/20">
              <h3 className="text-lg font-bold mb-3 text-orange-500">Cost of Sales</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(data.costOfSales).map(([key, value]) => (
                  <div key={key}>
                    <Label className="text-xs capitalize">
                      {key.replace(/([A-Z])/g, ' $1').replace(/([0-9]+)/g, ' $1%').trim()}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={value}
                      onChange={(e) => updateField('costOfSales', key, e.target.value)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between font-bold">
                  <span>Total Cost of Sales</span>
                  <span className="text-orange-500">{formatCurrency(totalCostOfSales)}</span>
                </div>
              </div>
            </Card>

            {/* Gross Profit */}
            <Card className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-600/10 border-green-500/20">
              <div className="space-y-1">
                <div className="flex justify-between text-xl font-bold">
                  <span>Gross Profit</span>
                  <span className="text-green-500">{formatCurrency(grossProfit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Gross Profit Margin</span>
                  <span className="text-green-500">{grossProfitMargin.toFixed(2)}%</span>
                </div>
              </div>
            </Card>

            {/* Administrative Costs */}
            <Card className="p-4 bg-card/50 border-primary/20">
              <h3 className="text-lg font-bold mb-3 text-red-500">Administrative Costs</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(data.adminCosts).map(([key, value]) => (
                  <div key={key}>
                    <Label className="text-xs capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={value}
                      onChange={(e) => updateField('adminCosts', key, e.target.value)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between font-bold">
                  <span>Total Administrative Costs</span>
                  <span className="text-red-500">{formatCurrency(totalAdminCosts)}</span>
                </div>
              </div>
            </Card>

            {/* Operating Profit */}
            <Card className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-600/10 border-blue-500/20">
              <div className="flex justify-between text-xl font-bold">
                <span>Operating Profit</span>
                <span className="text-blue-500">{formatCurrency(operatingProfit)}</span>
              </div>
            </Card>

            {/* Other Income */}
            <Card className="p-4 bg-card/50 border-primary/20">
              <h3 className="text-lg font-bold mb-3 text-purple-500">Other Income</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(data.otherIncome).map(([key, value]) => (
                  <div key={key}>
                    <Label className="text-xs capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={value}
                      onChange={(e) => updateField('otherIncome', key, e.target.value)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between font-bold">
                  <span>Total Other Income</span>
                  <span className="text-purple-500">{formatCurrency(totalOtherIncome)}</span>
                </div>
              </div>
            </Card>

            {/* Final Profit */}
            <Card className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-600/20 border-green-500/30">
              <div className="space-y-2">
                <div className="flex justify-between text-xl font-bold">
                  <span>Profit Before Taxation</span>
                  <span className="text-green-500">{formatCurrency(profitBeforeTax)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-2 border-t border-green-500/30">
                  <span>Profit After Taxation</span>
                  <span className="text-green-500">{formatCurrency(profitAfterTax)}</span>
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveClick} className="gap-2">
                <Save className="h-4 w-4" />
                Save Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name Your Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="report-name">Report Name</Label>
              <Input
                id="report-name"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="e.g., Q1 2024 Financial Report"
                className="mt-2"
              />
            </div>
            <div className="bg-muted p-3 rounded-lg text-sm">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Branch:</span>
                  <span className="font-medium">{data.storeName || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Period:</span>
                  <span className="font-medium">{data.quarter}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSave}
              disabled={!reportName.trim() || !data.storeName.trim()}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
