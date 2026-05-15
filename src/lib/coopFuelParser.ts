// Co-op Fuel store import format parser.
// Reads two till exports per day and produces a structured per-category breakdown:
//   - TXT1*.csv  → tender + lottery + scratchcards + paypoint/payzone + car/jet wash totals
//   - DEPARTMENTVAT*.csv → category sales by VAT rate (0%, 5%, 20%)
//
// The result is shaped so we can emit a Xero "Sales import" CSV identical to the
// Houndsmill template (one invoice per day, multiple line rows per category).

export interface CoopCategoryTotals {
  // Sales by Xero short code (gross, i.e. inc VAT where applicable)
  FU: number; // Fuel
  TO: number; // Tobacco
  DR: number; // Drinks
  GS: number; // Grocery Standard (20% VAT)
  GZ: number; // Grocery Zero (0% VAT, excl. fuel & news)
  DO: number; // Domestic Items (5% VAT)
  AL: number; // Alcohol
  NP: number; // Newspapers & Magazines
  VM: number; // Vending Machines
  CW: number; // Car/Jet Wash
  // Pass-through / payable items (from TXT1)
  national_lottery: number;     // 948B
  instant_lottery: number;      // 949B (scratchcards)
  paypoint: number;             // 950B
  payzone: number;
  lottery_payouts: number;      // 621B (negative)
  newspaper_voucher: number;    // 622B
  petty_cash: number;           // 623B (sum of payouts/refunds, negative)
  bad_debtors: number;          // 451 (drive off etc.)
  fuel_drive_off: number;       // FU negative reduction
}

export const emptyCoopTotals = (): CoopCategoryTotals => ({
  FU: 0, TO: 0, DR: 0, GS: 0, GZ: 0, DO: 0, AL: 0, NP: 0, VM: 0, CW: 0,
  national_lottery: 0, instant_lottery: 0, paypoint: 0, payzone: 0,
  lottery_payouts: 0, newspaper_voucher: 0, petty_cash: 0, bad_debtors: 0,
  fuel_drive_off: 0,
});

const numFromCell = (s: string | undefined): number => {
  if (!s) return 0;
  const cleaned = s.replace(/[^\d.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const lineMatches = (line: string, kw: RegExp) => kw.test(line);

const findTxtLineLast = (text: string, kw: RegExp): number => {
  for (const line of text.split(/\r?\n/)) {
    if (!lineMatches(line, kw)) continue;
    const m = line.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+\.\d+/g);
    if (m && m.length) return numFromCell(m[m.length - 1]);
  }
  return 0;
};

const sumTxtLines = (text: string, kw: RegExp): number => {
  let total = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!lineMatches(line, kw)) continue;
    const m = line.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+\.\d+/g);
    if (m && m.length) total += numFromCell(m[m.length - 1]);
  }
  return total;
};

// Map a department label (left-side text in DEPARTMENTVAT) to a Xero short code.
const DEPT_MAP: Array<[RegExp, keyof CoopCategoryTotals]> = [
  [/^FUEL\b/i, 'FU'],
  [/CIGARETTES|TOBACCO/i, 'TO'],
  [/BEVERAGES|SOFT\s*BEVERAGES/i, 'DR'],
  [/ALCOHOL|WINE|SPIRIT|BEER/i, 'AL'],
  [/NEWSPAPERS?|MAGAZINES?/i, 'NP'],
  [/VENDING/i, 'VM'],
  [/BAKERY|INSTORE\s*BKRY|FRUIT\s*&\s*VEGETABLES|MEAT\s*&\s*POULTRY|DELICATESSEN|FRANCHISE\s*LOCAL|CONCESSION/i, 'GZ'],
  [/GROCERY|FROZEN|PROVISIONS|CAR\s*CARE|PHONECARDS|DEPT/i, 'GS'],
];

const codeForDept = (label: string): keyof CoopCategoryTotals | null => {
  for (const [re, code] of DEPT_MAP) if (re.test(label)) return code;
  return null;
};

interface DeptRow { label: string; net0: number; net20: number; vat20: number; net5: number; vat5: number; }

const parseDepartmentVat = (text: string): DeptRow[] => {
  const rows: DeptRow[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line || !line.trim()) continue;
    // Only lines that begin with a department-style label (uppercase + " - (")
    if (!/^[A-Z0-9][^,]*-\s*\(\d+\)/.test(line.split(',')[0].trim())) continue;
    const cols = line.split(',').map(c => c.trim());
    // Expected layout (post-trim, ignoring blanks):
    //  0:DEPT_LABEL,,,,,n0,amt0,vat0,,n20,amt20,vat20,,n5,amt5,vat5,,...
    const label = cols[0];
    rows.push({
      label,
      net0:  numFromCell(cols[6]),
      net20: numFromCell(cols[10]),
      vat20: numFromCell(cols[11]),
      net5:  numFromCell(cols[14]),
      vat5:  numFromCell(cols[15]),
    });
  }
  return rows;
};

export interface CoopParseInput {
  txt1?: string;     // TXT1*.csv contents
  deptVat?: string;  // DEPARTMENTVAT*.csv contents
}

export function parseCoopFuel(input: CoopParseInput): CoopCategoryTotals {
  const out = emptyCoopTotals();

  // ---- Department breakdown ----
  if (input.deptVat) {
    for (const r of parseDepartmentVat(input.deptVat)) {
      const code = codeForDept(r.label);
      if (!code) continue;
      const gross20 = r.net20 + r.vat20;
      const gross5  = r.net5  + r.vat5;
      // 5% slice always goes to DO; the rest by mapped code.
      if (gross5 > 0) out.DO = +(out.DO + gross5).toFixed(2);
      const targetGross = gross20 + r.net0;
      if (code === 'NP' || code === 'GZ' || code === 'AL' || code === 'VM' ||
          code === 'FU' || code === 'TO' || code === 'DR' || code === 'GS') {
        (out[code] as number) = +((out[code] as number) + targetGross).toFixed(2);
      }
    }
  }

  // ---- TXT1 tender / lottery / wash / paypoint ----
  if (input.txt1) {
    const t = input.txt1;
    // Lottery sales (positive) and prizes paid (negative)
    out.national_lottery   = findTxtLineLast(t, /^\s*Lottery\b(?!\s*Prizes)/im);
    out.instant_lottery    = findTxtLineLast(t, /Scratchcards/i);
    out.lottery_payouts    = -Math.abs(findTxtLineLast(t, /Lotto\s*Prizes/i)) +
                             -Math.abs(findTxtLineLast(t, /Scratchcard\s*Prizes/i));
    out.paypoint           = findTxtLineLast(t, /^\s*Paypoint\b/im);
    out.payzone            = findTxtLineLast(t, /^\s*Payzone\b/im);
    const carWash          = sumTxtLines(t, /CAR\s*WASH/i);
    const jetWash          = sumTxtLines(t, /JET\s*WASH/i);
    out.CW                 = +(carWash + jetWash).toFixed(2);
    out.fuel_drive_off     = -Math.abs(findTxtLineLast(t, /Drive\s*Off/i));
    out.petty_cash         = -Math.abs(findTxtLineLast(t, /^\s*Payouts\b/im));
  }

  return out;
}

// ---------- Xero CSV builder ----------
// Produces the Houndsmill-style sales import CSV.
const HEADER = '*ContactName,EmailAddress,POAddressLine1,POAddressLine2,POAddressLine3,POAddressLine4,POCity,PORegion,POPostalCode,POCountry,*InvoiceNumber,Reference,*InvoiceDate,*DueDate,Total,InventoryItemCode,*Description,*Quantity,*UnitAmount,Discount,*AccountCode,*TaxType,TaxAmount,TrackingName1,TrackingOption1,TrackingName2,TrackingOption2,Currency,BrandingTheme';

interface XeroLineDef {
  code?: string;            // InventoryItemCode
  description: string;
  account: string;          // AccountCode
  taxType: string;
  amount: number;
  always?: boolean;         // include even when 0
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};
const addOneDay = (iso: string) => {
  const d = new Date(iso); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
const csvEscape = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export interface CoopXeroRow {
  sale_date: string;            // YYYY-MM-DD
  invoice_number: string;       // e.g. INV-3651
  branch_name: string;          // for tracking option
  contact_name: string;         // *ContactName
  reference?: string;
  totals: CoopCategoryTotals;
}

export function buildCoopXeroCsv(rows: CoopXeroRow[]): string {
  const out: string[] = [HEADER];
  for (const r of rows) {
    const date = fmtDate(r.sale_date);
    const due = fmtDate(addOneDay(r.sale_date));
    const t = r.totals;
    const branch = r.branch_name;
    const reference = r.reference || '';

    const lines: XeroLineDef[] = [
      { code: 'TO', description: 'Tobacco',           account: '202', taxType: '20% (VAT on Income)', amount: t.TO },
      { code: 'DR', description: 'Drinks',            account: '203', taxType: '20% (VAT on Income)', amount: t.DR },
      { code: 'GS', description: 'Grocery Standard',  account: '204', taxType: '20% (VAT on Income)', amount: t.GS },
      { code: 'GZ', description: 'Grocery Zero',      account: '205', taxType: 'Zero Rated Income',   amount: t.GZ },
      { code: 'DO', description: 'Domestic Items',    account: '208', taxType: '5% (VAT on Income)',  amount: t.DO },
      { code: 'NP', description: 'Newspaper',         account: '207', taxType: 'Zero Rated Income',   amount: t.NP },
      { code: 'AL', description: 'Alcohol',           account: '206', taxType: '20% (VAT on Income)', amount: t.AL },
      { code: 'VM', description: 'Vending Machines',  account: '209', taxType: '20% (VAT on Income)', amount: t.VM },
      { code: 'FU', description: 'Fuel',              account: '201', taxType: '20% (VAT on Income)', amount: t.FU },
      { description: `National Lottery Payable-${branch}`,   account: '948B', taxType: 'No VAT', amount: t.national_lottery },
      { description: `Instant Lottery Payable-${branch}`,    account: '949B', taxType: 'No VAT', amount: t.instant_lottery },
      { description: `Pay point Paid out Payable-${branch}`, account: '950B', taxType: 'No VAT', amount: t.paypoint + t.payzone },
      { description: `Lottery Paid out-${branch}`,           account: '621B', taxType: 'No VAT', amount: t.lottery_payouts },
      { description: `Newspaper Voucher Redemption-${branch}`, account: '622B', taxType: 'No VAT', amount: t.newspaper_voucher, always: true },
      { description: `Shop Petty Cash control Account-${branch}`, account: '623B', taxType: 'No VAT', amount: t.petty_cash },
      { code: 'CW', description: 'Revenue from Cash Wash',   account: '210', taxType: '20% (VAT on Income)', amount: t.CW },
      { description: 'Bad Debtors From Customer & Cash Control', account: '451', taxType: 'No VAT', amount: t.bad_debtors },
      { code: 'FU', description: 'Fuel',              account: '201', taxType: '20% (VAT on Income)', amount: t.fuel_drive_off },
    ];

    for (const l of lines) {
      if (!l.always && (l.amount === 0 || !Number.isFinite(l.amount))) continue;
      const cols = [
        r.contact_name, '', '', '', '', '', '', '', '', '',
        r.invoice_number, reference, date, due, '',
        l.code || '', l.description, '1', l.amount.toFixed(2), '',
        l.account, l.taxType, '',
        'Fuel Station', branch, '', '', '', ''
      ];
      out.push(cols.map(csvEscape).join(','));
    }
  }
  return out.join('\n');
}

// Intermediate "Daily Summary" CSV — gives super admin a flat per-day breakdown
// with all known fields (other fields like bank deposits/invoices stay blank for now).
export function buildDailySummaryCsv(rows: CoopXeroRow[]): string {
  const headers = [
    'Date','Branch','Invoice #',
    'Fuel','Tobacco','Drinks','Grocery Std','Grocery Zero','Domestic 5%','Alcohol','Newspapers','Vending','Car/Jet Wash',
    'National Lottery','Instant Lottery','Paypoint','Payzone','Lottery Payouts','Petty Cash','Drive Off','Bad Debtors',
    'Bank Deposit','Cash Banked','Card Settlement','Invoices Received','Notes'
  ];
  const out = [headers.join(',')];
  for (const r of rows) {
    const t = r.totals;
    const cols = [
      r.sale_date, r.branch_name, r.invoice_number,
      t.FU, t.TO, t.DR, t.GS, t.GZ, t.DO, t.AL, t.NP, t.VM, t.CW,
      t.national_lottery, t.instant_lottery, t.paypoint, t.payzone, t.lottery_payouts, t.petty_cash, t.fuel_drive_off, t.bad_debtors,
      '', '', '', '', ''
    ];
    out.push(cols.map(csvEscape).join(','));
  }
  return out.join('\n');
}

// Format registry — single source of truth used across UI.
export const IMPORT_FORMATS = [
  { id: 'coop_fuel', label: '1. Co-op Fuel stores', description: 'TXT1 + DEPARTMENTVAT till exports → Xero sales import.' },
] as const;
export type ImportFormatId = typeof IMPORT_FORMATS[number]['id'];
