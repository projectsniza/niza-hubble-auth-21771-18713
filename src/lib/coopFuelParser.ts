// Co-op Fuel store import format parser.
// Reads two till exports per day and produces a structured per-category breakdown:
//   - TXT1*.csv  → tender + lottery + scratchcards + paypoint/payzone + car/jet wash totals
//   - DEPARTMENTVAT*.csv → category sales by VAT rate (0%, 5%, 20%)
//
// The result is shaped so we can emit a Xero "Sales import" CSV identical to the
// Houndsmill template (one invoice per day, multiple line rows per category).

export interface CoopCategoryTotals {
  FU: number; TO: number; DR: number; GS: number; GZ: number; DO: number;
  AL: number; NP: number; VM: number; CW: number;
  national_lottery: number; instant_lottery: number; paypoint: number; payzone: number;
  lottery_payouts: number; newspaper_voucher: number; petty_cash: number;
  bad_debtors: number; fuel_drive_off: number;
  // Extended tender / banking fields extracted from TXT1
  cash_tender: number; visa_mc: number; amex: number; fuel_card: number;
  customer_account: number; coupon: number; cash_lifts: number;
  cash_in_drawer: number; gross_sales: number; net_takings: number;
  // VAT splits aggregated across all departments
  vat_20: number; vat_5: number; net_20: number; net_5: number; net_0: number;
}

export const emptyCoopTotals = (): CoopCategoryTotals => ({
  FU: 0, TO: 0, DR: 0, GS: 0, GZ: 0, DO: 0, AL: 0, NP: 0, VM: 0, CW: 0,
  national_lottery: 0, instant_lottery: 0, paypoint: 0, payzone: 0,
  lottery_payouts: 0, newspaper_voucher: 0, petty_cash: 0, bad_debtors: 0,
  fuel_drive_off: 0,
  cash_tender: 0, visa_mc: 0, amex: 0, fuel_card: 0, customer_account: 0,
  coupon: 0, cash_lifts: 0, cash_in_drawer: 0, gross_sales: 0, net_takings: 0,
  vat_20: 0, vat_5: 0, net_20: 0, net_5: 0, net_0: 0,
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

// Tolerant department parser:
// - splits on comma / tab / semicolon
// - strips empty cells
// - identifies a "dept row" by an uppercase-ish label that contains "- (NNN)" OR
//   matches one of the known department keywords
// - extracts up to 3 (net, vat) pairs from the row (for 0%, 20%, 5% — order in file
//   is consistent: 0%, then 20%, then 5%). VAT cells are the cell right after a
//   non-zero net cell in a numeric run.
const DEPT_HINT = /\bDEPT\b|\(\d{2,4}\)|FUEL|TOBACCO|CIGARETTES|BEVERAGES|GROCERY|FROZEN|PROVISIONS|ALCOHOL|WINE|SPIRIT|BEER|NEWSPAPER|MAGAZINE|VENDING|BAKERY|FRUIT|VEGETABLES|MEAT|POULTRY|DELICATESSEN|CONCESSION|CAR\s*CARE|PHONECARDS|CAR\s*WASH|JET\s*WASH/i;

const splitRow = (line: string): string[] => line.split(/[,\t;]/).map(c => c.trim());

const isNumericCell = (s: string) => /^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^-?\d+\.\d+$|^-?\d+$/.test(s.replace(/\s+/g, ''));

const parseDepartmentVat = (text: string): DeptRow[] => {
  const rows: DeptRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/,'');
    if (!line) continue;
    const cols = splitRow(line).filter(c => c !== '');
    if (cols.length < 4) continue;
    const label = cols[0];
    if (!DEPT_HINT.test(label)) continue;
    // Collect numeric cells (preserving order) — first numeric "block" is qty/net0,
    // then nets/vats per rate. We pick last 6 numeric cells and treat them as
    // [n0, v0, n20, v20, n5, v5] when ≥6 numerics; otherwise pad with zeros.
    const nums = cols.slice(1).filter(isNumericCell).map(numFromCell);
    if (nums.length < 2) continue;
    // Heuristic: in the till export the row layout (after the label) is
    //   qty0, amt0, vat0,  qty20, amt20, vat20,  qty5, amt5, vat5, totals...
    // We want amt+vat by rate. Pull the relevant slots if present.
    const get = (i: number) => (i < nums.length ? nums[i] : 0);
    rows.push({
      label,
      net0:  get(1),   // amt0
      net20: get(4),   // amt20
      vat20: get(5),   // vat20
      net5:  get(7),   // amt5
      vat5:  get(8),   // vat5
    });
  }
  return rows;
};

export interface CoopParseInput {
  txt1?: string;     // TXT1*.csv contents (single till export — may also contain dept rows)
  deptVat?: string;  // optional DEPARTMENTVAT*.csv contents (legacy two-file flow)
}

export interface UnknownDepartment { label: string; amount: number; }
export interface CoopParseResult {
  totals: CoopCategoryTotals;
  knownLabels: string[];
  unknownDepartments: UnknownDepartment[];
}

export function parseCoopFuel(input: CoopParseInput): CoopCategoryTotals {
  return parseCoopFuelDetailed(input).totals;
}

export function parseCoopFuelDetailed(input: CoopParseInput): CoopParseResult {
  const out = emptyCoopTotals();
  const knownLabels: string[] = [];
  const unknownDepartments: UnknownDepartment[] = [];

  const deptSource = input.deptVat || input.txt1 || '';
  if (deptSource) {
    for (const r of parseDepartmentVat(deptSource)) {
      const code = codeForDept(r.label);
      const gross20 = r.net20 + r.vat20;
      const gross5  = r.net5  + r.vat5;
      const totalGross = +(gross20 + gross5 + r.net0).toFixed(2);
      // Aggregate VAT/net splits regardless of mapping success
      out.vat_20 = +(out.vat_20 + r.vat20).toFixed(2);
      out.vat_5  = +(out.vat_5  + r.vat5).toFixed(2);
      out.net_20 = +(out.net_20 + r.net20).toFixed(2);
      out.net_5  = +(out.net_5  + r.net5).toFixed(2);
      out.net_0  = +(out.net_0  + r.net0).toFixed(2);
      if (!code) {
        if (totalGross !== 0) unknownDepartments.push({ label: r.label, amount: totalGross });
        continue;
      }
      knownLabels.push(r.label);
      if (gross5 > 0) out.DO = +(out.DO + gross5).toFixed(2);
      const targetGross = gross20 + r.net0;
      if (code === 'NP' || code === 'GZ' || code === 'AL' || code === 'VM' ||
          code === 'FU' || code === 'TO' || code === 'DR' || code === 'GS') {
        (out[code] as number) = +((out[code] as number) + targetGross).toFixed(2);
      }
    }
  }

  if (input.txt1) {
    const t = input.txt1;
    out.national_lottery   = findTxtLineLast(t, /^\s*Lottery\b(?!\s*Prizes)/im);
    out.instant_lottery    = findTxtLineLast(t, /Scratchcards/i);
    out.lottery_payouts    = -Math.abs(findTxtLineLast(t, /Lotto\s*Prizes/i)) +
                             -Math.abs(findTxtLineLast(t, /Scratchcard\s*Prizes/i));
    out.paypoint           = findTxtLineLast(t, /^\s*Paypoint\b/im);
    out.payzone            = findTxtLineLast(t, /^\s*Payzone\b/im);
    const carWash          = sumTxtLines(t, /CAR\s*WASH/i);
    const jetWash          = sumTxtLines(t, /JET\s*WASH/i);
    if (out.CW === 0) out.CW = +(carWash + jetWash).toFixed(2);
    out.fuel_drive_off     = -Math.abs(findTxtLineLast(t, /Drive\s*Off/i));
    out.petty_cash         = -Math.abs(findTxtLineLast(t, /^\s*Payouts\b/im));

    // ---- Extended tender extraction (TXT1) ----
    out.cash_tender        = findTxtLineLast(t, /^\s*Cash\b(?!\s*(Lifts?|in\s*Drawer))/im);
    out.visa_mc            = findTxtLineLast(t, /Visa\s*\/?\s*Mastercard|Visa\/MC|^\s*Visa\b/im);
    out.amex               = findTxtLineLast(t, /^\s*Amex\b/im);
    out.fuel_card          = sumTxtLines(t, /^\s*(Fuel\s*Card|All\s*star|Allstar|UK\s*Fuels|Key\s*Fuels|BP\b|Shell\b|Routex|Fleetone|Fastfuel|Texaco)\b/im);
    out.customer_account   = findTxtLineLast(t, /Customer\s*Account/i);
    out.coupon             = +(findTxtLineLast(t, /^\s*Coupon\b/im) + findTxtLineLast(t, /Gift\s*Voucher/i)).toFixed(2);
    out.cash_lifts         = findTxtLineLast(t, /Cash\s*Lifts?/i);
    out.cash_in_drawer     = findTxtLineLast(t, /Cash\s*in\s*Drawer/i);
    out.gross_sales        = findTxtLineLast(t, /Gross\s*Sales/i);
    out.net_takings        = findTxtLineLast(t, /Net\s*Takings/i);
  }

  return { totals: out, knownLabels, unknownDepartments };
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

export interface NizaInvoiceRow {
  invoice_date: string | null;
  supplier: string | null;
  invoice_number: string | null;
  category: string | null;
  net: number | null;
  vat: number | null;
  gross: number | null;
  source?: string | null;        // 'email', 'manual', 'upload'
  payment_method?: string | null;
}

export function buildCoopXeroCsv(rows: CoopXeroRow[], configuredCodes?: Set<string>): string {
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
      const isZero = l.amount === 0 || !Number.isFinite(l.amount);
      const forceShow = !!(l.code && configuredCodes?.has(l.code));
      if (!l.always && !forceShow && isZero) continue;
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

// Intermediate "Daily Summary" CSV — one row per day, matching the CASH SUM1
// monthly cash-summary template (single-tab fallback).
export function buildDailySummaryCsv(rows: CoopXeroRow[]): string {
  const headers = [
    'DATE','BRANCH','OPEN BALANCE','OTHER INCOME','DETAILS',
    'SHOP SALES','CARWASH','VENDING MACHINES','PAYZONE',
    'FUEL SALES','LOTTO SALES','LOTTO PRIZE','CREDIT C.SALES','CASH S.TOTAL',
    'ACCOUNT CUSTOMERS','VOUCHERS INCOME','MISC. EXPENCE','PRODUCTS FOR RESALE',
    'TOTAL BANKING','CLOSING CASH BAL.','ACTUAL CASH/CHQ','CASH DIFFERENT'
  ];
  const out = [headers.join(',')];
  const fmt = (n: number) => (n ? Number(n).toFixed(2) : '');
  for (const r of rows) {
    const t = r.totals;
    const shopSales = (t.TO || 0) + (t.DR || 0) + (t.GS || 0) + (t.GZ || 0) +
                      (t.DO || 0) + (t.AL || 0) + (t.NP || 0);
    const cols = [
      r.sale_date, r.branch_name,
      '', '', '',
      fmt(shopSales), fmt(t.CW), fmt(t.VM), fmt(t.payzone),
      fmt(t.FU), fmt(t.national_lottery), fmt(Math.abs(t.lottery_payouts || 0)),
      '', '', '', '', '', '', '', '', '', ''
    ];
    out.push(cols.map(csvEscape).join(','));
  }
  return out.join('\n');
}

// ---------- Multi-tab "Branch Cash Summary" workbook ----------
// Mirrors the printed monthly management pack (CASH SUM1, SALE, SHIFT SHEET,
// COUNTING, DIPS, OBJECTIVE, C.CARD, C.PURCH, EXPENSES, PURCHASE, P&L, BANK,
// STOCK CONT, Week Wages, HOURS & WAGES, comp statement). Sheets derivable
// from till uploads are populated; the rest are skeletons for bank/invoice
// data the admin will fill in later.
export async function buildBranchSummaryWorkbook(
  rows: CoopXeroRow[],
  meta: {
    branch_name: string;
    period_label: string;
    invoices?: NizaInvoiceRow[];
    configuredCodes?: Set<string>;
  }
): Promise<Blob> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const title = (label: string) => [
    [label.toUpperCase()], [meta.branch_name], [`Period: ${meta.period_label}`], [],
  ];

  // CASH SUM1
  const cashHeaders = [
    'DATE','OPEN BALANCE','OTHER INCOME','DETAILS',
    'SHOP SALES','CARWASH','VENDING MACHINES','PAYZONE',
    'FUEL SALES','LOTTO SALES','LOTTO PRIZE','CREDIT C.SALES','CASH S.TOTAL',
    'ACCOUNT CUSTOMERS','VOUCHERS INCOME','MISC. EXPENCE','PRODUCTS FOR RESALE',
    'TOTAL BANKING','CLOSING CASH BAL.','ACTUAL CASH/CHQ','CASH DIFFERENT'
  ];
  const cashRows: any[][] = [...title('Cash Summary (CASH SUM1)'), cashHeaders];
  for (const r of rows) {
    const t = r.totals;
    const shop = (t.TO || 0) + (t.DR || 0) + (t.GS || 0) + (t.GZ || 0) +
                 (t.DO || 0) + (t.AL || 0) + (t.NP || 0);
    cashRows.push([
      r.sale_date, '', '', '',
      shop || '', t.CW || '', t.VM || '', t.payzone || '',
      t.FU || '', t.national_lottery || '', Math.abs(t.lottery_payouts || 0) || '',
      '', '', '', '', '', '', '', '', '', ''
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cashRows), 'CASH SUM1');

  // SALE — departmental breakdown
  const saleHeaders = ['DATE','FUEL','TOBACCO','DRINKS','GROCERY STD','GROCERY ZERO',
    'DOMESTIC 5%','ALCOHOL','NEWSPAPERS','VENDING','CAR WASH',
    'NAT LOTTERY','SCRATCHCARDS','PAYPOINT','PAYZONE','LOTTO PAYOUTS','DRIVE OFF'];
  const saleRows: any[][] = [...title('Sales by Department'), saleHeaders];
  for (const r of rows) {
    const t = r.totals;
    saleRows.push([
      r.sale_date,
      t.FU || '', t.TO || '', t.DR || '', t.GS || '', t.GZ || '',
      t.DO || '', t.AL || '', t.NP || '', t.VM || '', t.CW || '',
      t.national_lottery || '', t.instant_lottery || '',
      t.paypoint || '', t.payzone || '',
      t.lottery_payouts || '', t.fuel_drive_off || ''
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(saleRows), '  SALE  ');

  const stub = (label: string, headers: string[]) => {
    const aoa: any[][] = [...title(label), headers];
    for (const r of rows) {
      const row = new Array(headers.length).fill('');
      row[0] = r.sale_date;
      aoa.push(row);
    }
    return XLSX.utils.aoa_to_sheet(aoa);
  };

  XLSX.utils.book_append_sheet(wb, stub('Shift Sheet',
    ['DATE','RECEIVED','AMOUNT','SALES','AMOUNT','NOTES']), 'SHIFT SHEET');
  XLSX.utils.book_append_sheet(wb, stub('Counting Summary',
    ['DATE','PLU NO','ITEM','PRICE','OPEN','ADD','CLOSE','SALE']), 'COUNTING');
  XLSX.utils.book_append_sheet(wb, stub('Tank Dips',
    ['DATE','TANK','METER READINGS','TOTAL ISSUE','TODAYS DIP','DELIVERY','GONE FROM TANK','GAIN/LOSS','%']), 'DIPS');
  XLSX.utils.book_append_sheet(wb, stub('Objectives',
    ['DATE','OBJECTIVE','TARGET','ACTUAL','VARIANCE','NOTES']), 'OBJECTIVE');
  XLSX.utils.book_append_sheet(wb, stub('Credit Card Receipts',
    ['DATE','VISA','MASTERCARD','AMEX','DINERS','FUEL CARD','OTHER','TOTAL']), 'C.CARD');
  // Invoice-driven tabs (C.PURCH, EXPENSES, PURCHASE) come from niza_invoices.
  const inv = meta.invoices || [];
  const cpurch = inv.filter(i => (i.source || '').toLowerCase() === 'credit' || (i.payment_method || '').toLowerCase() === 'credit');
  const expenses = inv.filter(i => (i.source || '').toLowerCase() === 'expense' || (i.category || '').toLowerCase().includes('expense'));
  const purchases = inv.filter(i => !cpurch.includes(i) && !expenses.includes(i));

  const invoiceSheet = (
    label: string,
    headers: string[],
    list: NizaInvoiceRow[],
    extraPaidBy = false
  ) => {
    const aoa: any[][] = [...title(label), headers];
    for (const i of list) {
      const base = [
        i.invoice_date || '',
        i.supplier || '',
        i.invoice_number || '',
        i.category || '',
        i.net ?? '',
        i.vat ?? '',
        i.gross ?? '',
      ];
      aoa.push(extraPaidBy ? [base[0], base[1], i.category || '', base[3], base[4], base[5], base[6], i.payment_method || ''] : base);
    }
    // Pad with at least the till-date skeleton if no invoices, so layout matches.
    if (list.length === 0) {
      for (const r of rows) {
        const row = new Array(headers.length).fill('');
        row[0] = r.sale_date;
        aoa.push(row);
      }
    }
    return XLSX.utils.aoa_to_sheet(aoa);
  };

  XLSX.utils.book_append_sheet(wb, invoiceSheet('Credit Purchases',
    ['DATE','SUPPLIER','INVOICE NO','CATEGORY','NET','VAT','GROSS'], cpurch), 'C.PURCH');
  XLSX.utils.book_append_sheet(wb, invoiceSheet('Expenses',
    ['DATE','PAYEE','DESCRIPTION','CATEGORY','NET','VAT','GROSS','PAID BY'], expenses, true), 'EXPENSES');
  XLSX.utils.book_append_sheet(wb, invoiceSheet('Purchases',
    ['DATE','SUPPLIER','INVOICE NO','CATEGORY','NET','VAT','GROSS'], purchases), 'PURCHASE');
  XLSX.utils.book_append_sheet(wb, stub('Profit & Loss',
    ['DATE','SALES','COST OF SALES','GROSS PROFIT','EXPENSES','NET PROFIT']), '      P &  L  ');
  XLSX.utils.book_append_sheet(wb, stub('Banking',
    ['DATE','CASH BANKED','CHEQUES BANKED','CARD SETTLEMENT','OTHER','TOTAL']), ' BANK ');
  XLSX.utils.book_append_sheet(wb, stub('Stock Control',
    ['DATE','OPENING STOCK','PURCHASES','SALES','CLOSING STOCK','VARIANCE']), 'STOCK CONT');
  XLSX.utils.book_append_sheet(wb, stub('Week Wages',
    ['WEEK ENDING','EMPLOYEE','HOURS','RATE','GROSS','TAX','NI','NET']), 'Week Wages');
  XLSX.utils.book_append_sheet(wb, stub('Hours & Wages',
    ['DATE','EMPLOYEE','HOURS','RATE','AMOUNT']), 'HOURS & WAGES');
  XLSX.utils.book_append_sheet(wb, stub('Comparative Statement',
    ['DATE','THIS MONTH','LAST MONTH','VARIANCE','YTD']), 'comp statement');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Format registry — single source of truth used across UI.
export const IMPORT_FORMATS = [
  { id: 'coop_fuel', label: '1. Co-op Fuel stores', description: 'Single TXT till export → Xero sales import. Upload one TXT/CSV per day.' },
  { id: 'charfield_shift', label: '2. Charfield, Cotswold & Packhorse', description: 'Shift & Period Report (XLSX) from the till. Upload one workbook per day.' },
] as const;
export type ImportFormatId = typeof IMPORT_FORMATS[number]['id'];

// ---------- Charfield / Cotswold / Packhorse "Shift & Period Report" XLSX ----------
// Reads the till's Shift & Period Report workbook and produces the same
// CoopCategoryTotals shape used by Co-op Fuel uploads so all downstream
// exports (Xero Sales CSV + Branch Cash Summary workbook) work identically.
const CHARFIELD_DEPT: Array<[RegExp, keyof CoopCategoryTotals]> = [
  [/tobacco|cigarette/i, 'TO'],
  [/news|magazine/i, 'NP'],
  [/vending/i, 'VM'],
  [/off\s*licence|alcohol|wine|spirit|beer|cider/i, 'AL'],
  [/drink|beverage/i, 'DR'],
  [/5%\s*vat|domestic/i, 'DO'],
  [/car\s*wash|jet\s*wash|air\s*line|screen\s*wash/i, 'CW'],
  [/grocery\s*zero|chiller|sandwich|bakery|fruit|vegetable/i, 'GZ'],
  [/grocery|confection|ice\s*cream|snack|car\s*care|takeaway|hot\s*food|deli|frozen|provision/i, 'GS'],
  [/^fuel\b|manual\s*fuel/i, 'FU'],
];

const charfieldCode = (label: string): keyof CoopCategoryTotals | null => {
  for (const [re, code] of CHARFIELD_DEPT) if (re.test(label)) return code;
  return null;
};

const toNum = (v: any): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export async function parseCharfieldShiftReport(buffer: ArrayBuffer): Promise<CoopCategoryTotals> {
  return (await parseCharfieldShiftReportDetailed(buffer)).totals;
}

export async function parseCharfieldShiftReportDetailed(buffer: ArrayBuffer): Promise<CoopParseResult> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array' });
  const out = emptyCoopTotals();
  const knownLabels: string[] = [];
  const unknownDepartments: UnknownDepartment[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any;

    let inDept = false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      const c0 = String(row[0] ?? '').trim();

      if (/^department totals$/i.test(c0)) { inDept = true; continue; }
      if (inDept) {
        if (!c0 || /^total$/i.test(c0) || /^payment totals$/i.test(c0) ||
            /^money analysis$/i.test(c0) || /^safe drops$/i.test(c0)) {
          inDept = false;
        } else if (!/^sales department$/i.test(c0) && !/^quantity$/i.test(c0)) {
          const value = toNum(row[2]);
          if (value) {
            const code = charfieldCode(c0);
            if (code) {
              knownLabels.push(c0);
              if (code !== 'FU') (out[code] as number) = +((out[code] as number) + value).toFixed(2);
            } else {
              unknownDepartments.push({ label: c0, amount: value });
            }
          }
        }
      }

      if (/^fuel sales$/i.test(c0))   out.FU = +(out.FU + toNum(row[1])).toFixed(2);
      if (/^lottery$/i.test(c0) && !/prize/i.test(c0)) out.national_lottery += toNum(row[1]) || toNum(row[2]);
      if (/scratchcard/i.test(c0) && !/prize/i.test(c0)) out.instant_lottery += toNum(row[1]) || toNum(row[2]);
      if (/lotto\s*prize|lottery\s*prize/i.test(c0)) out.lottery_payouts -= Math.abs(toNum(row[1]) || toNum(row[2]));
      if (/scratchcard\s*prize/i.test(c0)) out.lottery_payouts -= Math.abs(toNum(row[1]) || toNum(row[2]));
      if (/^paypoint$/i.test(c0)) out.paypoint += toNum(row[1]) || toNum(row[2]);
      if (/^payzone$/i.test(c0))  out.payzone  += toNum(row[1]) || toNum(row[2]);
      if (/drive\s*off/i.test(c0)) out.fuel_drive_off -= Math.abs(toNum(row[1]) || toNum(row[2]));
    }
  }
  (Object.keys(out) as (keyof CoopCategoryTotals)[]).forEach(k => {
    out[k] = +(out[k] as number).toFixed(2) as any;
  });
  return { totals: out, knownLabels, unknownDepartments };
}


