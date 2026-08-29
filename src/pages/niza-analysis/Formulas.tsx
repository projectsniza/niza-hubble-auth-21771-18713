import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calculator } from 'lucide-react';

interface FormulaRow { field: string; formula: string; source: string; }
interface FormulaGroup { tab: string; description: string; rows: FormulaRow[]; }

const GROUPS: FormulaGroup[] = [
  {
    tab: 'SALE',
    description: 'Daily net sales by department, with fuel litres first. All amounts are net of VAT (paperwork-matched).',
    rows: [
      { field: 'Fuel Sold Litres',  formula: 'Total litres from the weekly Cash Reconciliation (per-day where dated)', source: 'Cash Reconciliation' },
      { field: 'Diesel / Unleaded / Super Unleaded Litres', formula: 'Litre split by grade from the Cash Reconciliation', source: 'Cash Reconciliation' },
      { field: 'Fuel',          formula: 'sum(dept_amount) where dept matches /^FUEL\\b/ at 20% VAT', source: 'Department VAT' },
      { field: 'Tobacco',       formula: 'sum(dept_amount @ 20%) where label matches /CIGARETTES|TOBACCO/', source: 'Department VAT' },
      { field: 'Drinks',        formula: 'sum(dept_amount @ 20%) where label matches /SOFT\\s*BEVERAGES|BEVERAGES/ (alcohol excluded)', source: 'Department VAT' },
      { field: 'Alcohol',       formula: 'sum(dept_amount @ 20%) where label matches /ALCOHOL|WINE|SPIRIT|BEER/', source: 'Department VAT (separate from Drinks)' },
      { field: 'Grocery Std',   formula: 'sum(dept_amount @ 20%) for grocery-family departments − FRANCHISE LOCAL', source: 'Department VAT' },
      { field: 'Grocery Zero',  formula: 'sum(dept_amount @ 0%) for grocery-family departments + FRANCHISE LOCAL', source: 'Department VAT' },
      { field: 'Domestic 5%',   formula: 'sum(dept_amount @ 5%) across all departments', source: 'Department VAT' },
      { field: 'Newspapers',    formula: 'sum(dept_amount @ 0%) where label matches /NEWSPAPER|MAGAZINE/', source: 'Department VAT' },
      { field: 'Newspapers 20%',formula: 'Gaming cards sold under newspapers, reclassified to 20% VAT on the configured dates', source: 'Department VAT + date rules' },
      { field: 'Vending (Culverstone)', formula: 'X-Read Vending totals + fuel_dept_0% (extra zero-rated fuel is vending)', source: 'Department VAT + X-Read' },
      { field: 'Vending (Houndsmills)', formula: 'X-Read Vending + max(0, fuel_dept_0% − X-Read Car Wash)', source: 'Department VAT + X-Read' },
      { field: 'Car Wash',      formula: 'sum(TXT1 lines matching /CAR\\s*WASH|JET\\s*WASH/)', source: 'X-Read (TXT1)' },
      { field: 'Nat Lottery',   formula: 'TXT1 "Lottery" line (last numeric)', source: 'X-Read (TXT1)' },
      { field: 'Scratchcards',  formula: 'TXT1 "Scratchcards" line', source: 'X-Read (TXT1)' },
      { field: 'Paypoint',      formula: 'TXT1 "Paypoint" line', source: 'X-Read (TXT1)' },
      { field: 'Payzone',       formula: 'TXT1 "Payzone" line', source: 'X-Read (TXT1)' },
      { field: 'Lotto Payouts', formula: '−|TXT1 "Lotto Prizes"| − |TXT1 "Scratchcard Prizes"|', source: 'X-Read (TXT1)' },
      { field: 'Net 0% / Net 20% / VAT 20% / Net 5% / VAT 5%', formula: 'Summed directly from Department VAT columns', source: 'Department VAT' },
      { field: 'TOTAL row',     formula: 'SUM() live Excel formula per column', source: 'Workbook formula' },
    ],
  },
  {
    tab: 'C.CARD',
    description: 'Weekly card settlement — one column per card brand, generated from the FIS card statement upload.',
    rows: [
      { field: 'Brand columns', formula: 'Visa/Master, All Star, Amex, UK Fuel, Texaco/Fast Fuel, BP, Euroshell + any new brand found in the statement', source: 'FIS card statement' },
      { field: 'Fallback (no statement yet)', formula: 'Visa/Master ← till card tender, Amex ← till Amex, UK Fuel ← till fuel card', source: 'X-Read tenders' },
      { field: 'TOTAL (per day)', formula: 'SUM(first brand column : last brand column)', source: 'Workbook formula' },
      { field: 'TOTAL row',     formula: 'SUM() per brand column', source: 'Workbook formula' },
    ],
  },
  {
    tab: 'CASH SUM1',
    description: 'Daily cash summary. Every cell is a live Excel formula off SALE and C.CARD, so edits recalculate.',
    rows: [
      { field: 'Shop Sales',        formula: "SUM(SALE!Tobacco : SALE!Newspapers 20%)", source: 'SALE tab' },
      { field: 'Carwash',           formula: 'SALE!Car Wash', source: 'SALE tab' },
      { field: 'Vending Machines',  formula: 'SALE!Vending (branch-mode aware)', source: 'SALE tab' },
      { field: 'Payzone',           formula: 'SALE!Payzone', source: 'SALE tab' },
      { field: 'Fuel Sales',        formula: 'SALE!Fuel', source: 'SALE tab' },
      { field: 'Lotto Sales',       formula: 'SALE!Nat Lottery + SALE!Scratchcards (combined)', source: 'SALE tab' },
      { field: 'Lotto Prize',       formula: '−ABS(SALE!Lotto Payouts)', source: 'SALE tab' },
      { field: 'Credit Card Sales', formula: 'C.CARD!Total for the day', source: 'C.CARD tab' },
      { field: 'Cash need to Deposit', formula: 'Shop + Carwash + Vending + Payzone + Fuel + Lotto Sales + Lotto Prize − Credit Card Sales', source: 'Workbook formula' },
      { field: 'Account Customers', formula: 'Left blank by client request', source: '—' },
      { field: 'Vouchers Income',   formula: 'X-Read "Coupon" / "Gift Voucher" lines', source: 'X-Read' },
      { field: 'Drive Off',         formula: 'X-Read drive-off value, sign exactly as printed on the day report (moved here from SALE)', source: 'X-Read' },
      { field: 'Customer Accounts', formula: 'X-Read "Customer Account" line', source: 'X-Read' },
      { field: 'Misc. Expence',     formula: '|X-Read "Payouts" line|', source: 'X-Read' },
      { field: 'Products for Resale', formula: 'Entered by branch', source: 'Manual' },
      { field: 'Total Banking',     formula: 'Cash lifts recorded on the day report', source: 'X-Read / Manual' },
      { field: 'Closing Cash Bal.', formula: 'Cash need to Deposit − Account Customers − Vouchers − Drive Off − Customer Accounts − Misc. Expence − Products for Resale − Total Banking', source: 'Workbook formula' },
      { field: 'Actual Cash Short/Excess as per Day Report', formula: '−(X-Read "Cash in Drawer") — excess prints negative, so the sign is inverted', source: 'X-Read' },
      { field: 'Net Differences',   formula: 'Closing Cash Bal. − Actual Cash Short/Excess (should be nil)', source: 'Workbook formula' },
    ],
  },
  {
    tab: 'OBJECTIVE',
    description: 'Management notes tab. All cells manually entered by the branch/HR.',
    rows: [],
  },
  {
    tab: 'Removed tabs',
    description: 'SHIFT SHEET, COUNTING, DIPS, P & L, BANK, STOCK CONT, Week Wages, HOURS & WAGES and comp statement were removed by client request. Open Balance, Other Income and Details columns were also dropped.',
    rows: [],
  },
  {
    tab: 'C.PURCH / PURCHASE / EXPENSES',
    description: 'Populated from `niza_invoices` filtered by invoice_date range and by source/payment_method (credit purchases vs generic purchases vs expenses).',
    rows: [
      { field: 'Date',        formula: 'niza_invoices.invoice_date', source: 'Invoice extract (email agent or manual)' },
      { field: 'Supplier',    formula: 'niza_invoices.supplier', source: 'Invoice extract' },
      { field: 'Invoice No',  formula: 'niza_invoices.invoice_number', source: 'Invoice extract' },
      { field: 'Category',    formula: 'niza_invoices.category', source: 'Invoice extract' },
      { field: 'Net/VAT/Gross', formula: 'Direct copy from niza_invoices', source: 'Invoice extract' },
    ],
  },
];


export default function Formulas() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Calculator className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Formulas &amp; Calculations</h1>
          <p className="text-sm text-muted-foreground">Every output cell explained — where it comes from and how it's calculated.</p>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={GROUPS.map(g => g.tab)}>
        {GROUPS.map(g => (
          <AccordionItem key={g.tab} value={g.tab}>
            <AccordionTrigger>
              <div className="text-left">
                <div className="font-semibold">{g.tab}</div>
                <div className="text-xs text-muted-foreground">{g.description}</div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {g.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No automated fields on this tab.</p>
              ) : (
                <Card className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="text-left p-2">Field</th>
                        <th className="text-left p-2">Formula</th>
                        <th className="text-left p-2">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r, i) => (
                        <tr key={i} className="border-b hover:bg-muted/30 align-top">
                          <td className="p-2 font-medium whitespace-nowrap">{r.field}</td>
                          <td className="p-2 font-mono text-xs">{r.formula}</td>
                          <td className="p-2 text-xs text-muted-foreground">{r.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
