import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calculator } from 'lucide-react';

interface FormulaRow { field: string; formula: string; source: string; }
interface FormulaGroup { tab: string; description: string; rows: FormulaRow[]; }

const GROUPS: FormulaGroup[] = [
  {
    tab: 'SALE',
    description: 'Daily net sales by department. All amounts are net of VAT (paperwork-matched).',
    rows: [
      { field: 'Fuel',          formula: 'sum(dept_amount) where dept matches /^FUEL\\b/ at 20% VAT', source: 'Department VAT' },
      { field: 'Tobacco',       formula: 'sum(dept_amount @ 20%) where label matches /CIGARETTES|TOBACCO/', source: 'Department VAT' },
      { field: 'Drinks',        formula: 'sum(dept_amount @ 20%) where label matches /SOFT\\s*BEVERAGES|BEVERAGES/', source: 'Department VAT' },
      { field: 'Grocery Std',   formula: 'sum(dept_amount @ 20%) for grocery-family departments', source: 'Department VAT' },
      { field: 'Grocery Zero',  formula: 'sum(dept_amount @ 0%) for grocery-family departments', source: 'Department VAT' },
      { field: 'Domestic 5%',   formula: 'sum(dept_amount @ 5%) across all departments', source: 'Department VAT' },
      { field: 'Alcohol',       formula: 'sum(dept_amount @ 20%) where label matches /ALCOHOL|WINE|SPIRIT|BEER/', source: 'Department VAT (separate from Drinks)' },
      { field: 'Newspapers',    formula: 'sum(dept_amount @ 0% or 20%) where label matches /NEWSPAPER|MAGAZINE/', source: 'Department VAT' },
      { field: 'Vending (Culverstone)', formula: 'X-Read Vending totals + fuel_dept_0% (extra zero-rated fuel is vending)', source: 'Department VAT + X-Read' },
      { field: 'Vending (Houndsmills)', formula: 'X-Read Vending + max(0, fuel_dept_0% − X-Read Car Wash)', source: 'Department VAT + X-Read' },
      { field: 'Car Wash',      formula: 'sum(TXT1 lines matching /CAR\\s*WASH|JET\\s*WASH/)', source: 'X-Read (TXT1)' },
      { field: 'Nat Lottery',   formula: 'TXT1 "Lottery" line (last numeric)', source: 'X-Read (TXT1)' },
      { field: 'Scratchcards',  formula: 'TXT1 "Scratchcards" line', source: 'X-Read (TXT1)' },
      { field: 'Paypoint',      formula: 'TXT1 "Paypoint" line', source: 'X-Read (TXT1)' },
      { field: 'Payzone',       formula: 'TXT1 "Payzone" line', source: 'X-Read (TXT1)' },
      { field: 'Lotto Payouts', formula: '−|TXT1 "Lotto Prizes"| − |TXT1 "Scratchcard Prizes"|', source: 'X-Read (TXT1)' },
      { field: 'Drive Off',     formula: '−|TXT1 "Drive Off" line|', source: 'X-Read (TXT1)' },
      { field: 'Net 0% / Net 20% / VAT 20% / Net 5% / VAT 5%', formula: 'Summed directly from Department VAT columns', source: 'Department VAT' },
    ],
  },
  {
    tab: 'CASH SUM1',
    description: 'Daily cash summary. Zero-cells are left blank so the workbook stays paperwork-friendly.',
    rows: [
      { field: 'Shop Sales',        formula: 'TO + DR + GS + GZ + DO + AL + NP', source: 'Department VAT' },
      { field: 'Carwash',           formula: 'SALE!Car Wash', source: 'X-Read' },
      { field: 'Vending Machines',  formula: 'SALE!Vending (branch-mode aware)', source: 'Dept VAT + X-Read' },
      { field: 'Payzone',           formula: 'SALE!Payzone', source: 'X-Read' },
      { field: 'Fuel Sales',        formula: 'SALE!Fuel', source: 'Department VAT' },
      { field: 'Lotto Sales',       formula: 'SALE!Nat Lottery', source: 'X-Read' },
      { field: 'Lotto Prize',       formula: '|SALE!Lotto Payouts|', source: 'X-Read' },
      { field: 'Credit C.Sales',    formula: 'Visa/MC + Amex + Fuel Card', source: 'X-Read tender lines' },
      { field: 'Cash S.Total',      formula: 'X-Read "Cash" tender line', source: 'X-Read' },
      { field: 'Account Customers', formula: 'X-Read "Customer Account" line', source: 'X-Read' },
      { field: 'Vouchers Income',   formula: 'X-Read "Coupon" + "Gift Voucher" lines', source: 'X-Read' },
      { field: 'Misc. Expence',     formula: '|X-Read "Payouts" line|', source: 'X-Read' },
      { field: 'Total Banking',     formula: 'Cash Reconciliation "Total Banking" (weekly upload)', source: 'Cash Reconciliation' },
      { field: 'Actual Cash/Chq',   formula: 'X-Read "Cash in Drawer" line', source: 'X-Read' },
    ],
  },
  {
    tab: 'OBJECTIVE',
    description: 'Management notes tab. All cells manually entered by the branch/HR.',
    rows: [],
  },
  {
    tab: 'C.CARD',
    description: 'Left intentionally empty in the export (client request). Headers only.',
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
