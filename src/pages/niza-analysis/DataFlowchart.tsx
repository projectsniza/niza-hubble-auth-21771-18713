import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, FileText, Mail, Upload, AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react';

/**
 * Hidden documentation page (not in sidebar) — describes which Branch Cash
 * Summary workbook fields are derived from which source.
 * Route: /niza-analysis/data-flow
 */

interface FieldRow { sheet: string; field: string; status: 'csv' | 'invoice' | 'email' | 'manual'; note?: string }

const rows: FieldRow[] = [
  // CASH SUM1
  { sheet: 'CASH SUM1', field: 'DATE', status: 'csv' },
  { sheet: 'CASH SUM1', field: 'SHOP SALES (TO+DR+GS+GZ+DO+AL+NP)', status: 'csv' },
  { sheet: 'CASH SUM1', field: 'CARWASH / VENDING / PAYZONE / FUEL', status: 'csv' },
  { sheet: 'CASH SUM1', field: 'LOTTO SALES / LOTTO PRIZE', status: 'csv' },
  { sheet: 'CASH SUM1', field: 'CREDIT C.SALES (Visa+Amex+Fuel card)', status: 'csv', note: 'NEW: parsed from till TXT1 tender lines' },
  { sheet: 'CASH SUM1', field: 'CASH S.TOTAL (Cash tender)', status: 'csv', note: 'NEW: parsed from till TXT1 Cash line' },
  { sheet: 'CASH SUM1', field: 'ACCOUNT CUSTOMERS', status: 'csv', note: 'NEW: from TXT1 Customer Account' },
  { sheet: 'CASH SUM1', field: 'VOUCHERS INCOME', status: 'csv', note: 'NEW: Coupon + Gift Voucher' },
  { sheet: 'CASH SUM1', field: 'MISC. EXPENSE (Petty cash payouts)', status: 'csv' },
  { sheet: 'CASH SUM1', field: 'TOTAL BANKING (Cash Lifts)', status: 'csv', note: 'NEW: from TXT1 Cash Lifts' },
  { sheet: 'CASH SUM1', field: 'CASH DIFFERENT (Cash in Drawer over/short)', status: 'csv', note: 'NEW: from TXT1' },
  { sheet: 'CASH SUM1', field: 'OPEN BALANCE / CLOSING CASH BAL.', status: 'manual', note: 'Carried forward — admin enters once' },
  { sheet: 'CASH SUM1', field: 'OTHER INCOME / DETAILS / PRODUCTS FOR RESALE / ACTUAL CASH', status: 'manual' },

  // SALE
  { sheet: 'SALE', field: 'Per-day departmental gross (FU, TO, DR, GS, GZ, DO, AL, NP, VM, CW)', status: 'csv' },
  { sheet: 'SALE', field: 'NAT LOTTERY / SCRATCHCARDS / PAYPOINT / PAYZONE / LOTTO PAYOUTS / DRIVE OFF', status: 'csv' },
  { sheet: 'SALE', field: 'NET 0% / NET 20% / VAT 20% / NET 5% / VAT 5%', status: 'csv', note: 'NEW: aggregated from DEPARTMENTVAT split' },

  // SHIFT SHEET
  { sheet: 'SHIFT SHEET', field: 'CASH / VISA-MC / AMEX / FUEL CARD / CUST. ACCOUNT / COUPON', status: 'csv', note: 'NEW: full tender breakdown' },
  { sheet: 'SHIFT SHEET', field: 'PAYPOINT / PAYZONE / CASH LIFTS / GROSS SALES / NET TAKINGS / CASH IN DRAWER', status: 'csv', note: 'NEW' },

  // C.CARD
  { sheet: 'C.CARD', field: 'VISA-MC / AMEX / FUEL CARD / CUST. ACCOUNT / COUPON / TOTAL', status: 'csv', note: 'NEW: from TXT1' },
  { sheet: 'C.CARD', field: 'Per-card-issuer split (Allstar, BP, Shell, UK Fuels, Key Fuels…)', status: 'csv', note: 'Aggregated into single FUEL CARD total — issuer-level split needs till format extension' },

  // BANK
  { sheet: 'BANK', field: 'CASH BANKED / CARD SETTLEMENT / TOTAL', status: 'csv', note: 'NEW: derived from Cash Lifts + card tenders' },
  { sheet: 'BANK', field: 'CHEQUES BANKED / OTHER / actual bank statement lines', status: 'manual', note: 'No source — reconcile against bank feed' },

  // C.PURCH
  { sheet: 'C.PURCH', field: 'Cash purchases paid out of till', status: 'invoice', note: 'From Store → Invoice upload (Cash Purchase) marked as payment_method=Cash/Credit' },

  // EXPENSES
  { sheet: 'EXPENSES', field: 'Petty cash / misc. expenses', status: 'invoice', note: 'From Store → Invoice upload with category=Expense' },

  // PURCHASE
  { sheet: 'PURCHASE', field: 'Supplier invoices (Day Listing)', status: 'email', note: 'Email Agent extracts supplier PDF invoices (Consort, DWG, Embon, etc.)' },

  // P&L / STOCK / WAGES / COMP
  { sheet: 'P&L', field: 'SALES / COST OF SALES / GROSS PROFIT / EXPENSES / NET PROFIT', status: 'manual', note: 'Computed downstream — needs stock + payroll figures' },
  { sheet: 'STOCK CONT', field: 'OPENING / CLOSING STOCK / LOSS-GAIN', status: 'manual', note: 'Manual stock count — no till source' },
  { sheet: 'Week Wages / HOURS & WAGES', field: 'Employee hours / wages', status: 'manual', note: 'Could be pulled from Timesheet module (future)' },
  { sheet: 'COUNTING', field: 'PLU / item counts', status: 'manual', note: 'Stock count sheet — not in till export' },
  { sheet: 'DIPS', field: 'Tank dips / meter readings', status: 'manual', note: 'Forecourt manual reading' },
  { sheet: 'OBJECTIVE', field: 'Fuel volume / sales targets', status: 'manual', note: 'Manual KPI sheet' },
  { sheet: 'comp statement', field: 'YoY comparison', status: 'manual', note: 'Computed downstream from prior workbooks' },
];

const STATUS: Record<FieldRow['status'], { label: string; color: string; icon: any }> = {
  csv:     { label: 'CSV (till)',          color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30', icon: CheckCircle2 },
  invoice: { label: 'Store invoice upload', color: 'bg-blue-500/15 text-blue-700 border-blue-500/30',          icon: Upload },
  email:   { label: 'Email Agent',         color: 'bg-violet-500/15 text-violet-700 border-violet-500/30',     icon: Mail },
  manual:  { label: 'Missing / Manual',    color: 'bg-amber-500/15 text-amber-700 border-amber-500/30',        icon: AlertTriangle },
};

export default function DataFlowchart() {
  const grouped = rows.reduce<Record<string, FieldRow[]>>((acc, r) => {
    (acc[r.sheet] ||= []).push(r); return acc;
  }, {});
  const missingCount = rows.filter(r => r.status === 'manual').length;
  const csvCount = rows.filter(r => r.status === 'csv').length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Branch Cash Summary — Data Source Map</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Hidden reference page (not in sidebar). Documents which workbook fields are
          populated automatically from the till CSV/TXT1 upload, which come from store
          invoice uploads / the email agent, and which are still manual.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-2xl font-bold text-emerald-600">{csvCount}</div><div className="text-xs text-muted-foreground">fields from CSV</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold text-blue-600">{rows.filter(r=>r.status==='invoice').length}</div><div className="text-xs text-muted-foreground">from invoice upload</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold text-violet-600">{rows.filter(r=>r.status==='email').length}</div><div className="text-xs text-muted-foreground">from email agent</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold text-amber-600">{missingCount}</div><div className="text-xs text-muted-foreground">manual / missing</div></Card>
      </div>

      {/* Flow diagram */}
      <Card className="p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Pipeline</h2>
        <div className="grid md:grid-cols-4 gap-3 text-sm">
          <div className="border rounded-lg p-3 bg-emerald-500/5">
            <div className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-emerald-600"/> 1. Till TXT1 / DEPARTMENTVAT CSV</div>
            <ul className="mt-2 list-disc list-inside text-xs space-y-0.5 text-muted-foreground">
              <li>Department gross + VAT split</li>
              <li>Cash / Visa-MC / Amex / Fuel card tenders</li>
              <li>Lottery, Scratchcards, Paypoint, Payzone</li>
              <li>Cash Lifts, Cash in Drawer, Gross / Net</li>
              <li>Car Wash / Jet Wash, Drive Off</li>
            </ul>
          </div>
          <div className="border rounded-lg p-3 bg-blue-500/5">
            <div className="font-semibold flex items-center gap-2"><Upload className="h-4 w-4 text-blue-600"/> 2. Store invoice upload</div>
            <ul className="mt-2 list-disc list-inside text-xs space-y-0.5 text-muted-foreground">
              <li>Cash Purchases (C.PURCH tab)</li>
              <li>Petty cash / Misc Expenses (EXPENSES tab)</li>
              <li>Payment method tagged Cash/Credit</li>
            </ul>
          </div>
          <div className="border rounded-lg p-3 bg-violet-500/5">
            <div className="font-semibold flex items-center gap-2"><Mail className="h-4 w-4 text-violet-600"/> 3. Email Agent</div>
            <ul className="mt-2 list-disc list-inside text-xs space-y-0.5 text-muted-foreground">
              <li>Supplier PDFs → PURCHASE tab</li>
              <li>Supplier, Invoice no, Net/VAT/Gross</li>
              <li>Date matched to till day</li>
            </ul>
          </div>
          <div className="border rounded-lg p-3 bg-amber-500/5">
            <div className="font-semibold flex items-center gap-2"><MinusCircle className="h-4 w-4 text-amber-600"/> 4. Missing / Manual</div>
            <ul className="mt-2 list-disc list-inside text-xs space-y-0.5 text-muted-foreground">
              <li>Bank statement (Cheques, settlements)</li>
              <li>Stock counts (COUNTING, STOCK CONT)</li>
              <li>Tank dips (DIPS)</li>
              <li>Wages (could pull from Timesheet later)</li>
              <li>Opening / Closing cash balance carry-forward</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Per-sheet table */}
      {Object.entries(grouped).map(([sheet, fields]) => (
        <Card key={sheet} className="p-4">
          <h3 className="font-semibold mb-2">{sheet}</h3>
          <div className="space-y-1.5">
            {fields.map((f, i) => {
              const s = STATUS[f.status];
              const Icon = s.icon;
              return (
                <div key={i} className="flex items-start gap-3 text-sm border-b border-border/40 pb-1.5 last:border-0">
                  <Badge variant="outline" className={`${s.color} shrink-0 gap-1`}>
                    <Icon className="h-3 w-3" /> {s.label}
                  </Badge>
                  <div className="flex-1">
                    <div className="font-medium">{f.field}</div>
                    {f.note && <div className="text-xs text-muted-foreground">{f.note}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <Card className="p-4 bg-muted/30">
        <h3 className="font-semibold mb-1 text-sm">Known data we cannot yet read from till CSV</h3>
        <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
          <li>Per-card-issuer split (Allstar / BP / Shell / UK Fuels / Key Fuels) — only aggregated FUEL CARD total currently available</li>
          <li>Opening / closing cash float (carry-forward from previous day)</li>
          <li>Cheque tenders (rare; not in current TXT1 sample)</li>
          <li>Stock counts, tank dips, employee wages</li>
          <li>Bank statement reconciliation lines</li>
        </ul>
      </Card>
    </div>
  );
}
