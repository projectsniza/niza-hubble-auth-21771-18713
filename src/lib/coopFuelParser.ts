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
  // Newspapers sold at 20% VAT (gaming cards etc.) — kept apart from zero-rated NP.
  NP20: number;
  national_lottery: number; instant_lottery: number; paypoint: number; payzone: number;
  lottery_payouts: number; newspaper_voucher: number; petty_cash: number;
  bad_debtors: number; fuel_drive_off: number;
  // Litres of fuel sold (from the X-Read / Cash Reconciliation figures)
  fuel_litres: number;
  // Extended tender / banking fields extracted from TXT1
  cash_tender: number; visa_mc: number; amex: number; fuel_card: number;
  customer_account: number; coupon: number; cash_lifts: number;
  cash_in_drawer: number; gross_sales: number; net_takings: number;
  // VAT splits aggregated across all departments
  vat_20: number; vat_5: number; net_20: number; net_5: number; net_0: number;
  // Raw "fuel department 0%" amount — before applying the branch's VM/CW split.
  fuel_zero_rated: number;
  // Weekly Cash Reconciliation figures (populated at aggregation time — the
  // CashRec upload sits at the Monday of the week).
  cashrec_total_banking: number; cashrec_cash_banked: number;
  cashrec_card_banked: number; cashrec_other: number;
}

export const emptyCoopTotals = (): CoopCategoryTotals => ({
  FU: 0, TO: 0, DR: 0, GS: 0, GZ: 0, DO: 0, AL: 0, NP: 0, VM: 0, CW: 0,
  NP20: 0,
  national_lottery: 0, instant_lottery: 0, paypoint: 0, payzone: 0,
  lottery_payouts: 0, newspaper_voucher: 0, petty_cash: 0, bad_debtors: 0,
  fuel_drive_off: 0,
  fuel_litres: 0,
  cash_tender: 0, visa_mc: 0, amex: 0, fuel_card: 0, customer_account: 0,
  coupon: 0, cash_lifts: 0, cash_in_drawer: 0, gross_sales: 0, net_takings: 0,
  vat_20: 0, vat_5: 0, net_20: 0, net_5: 0, net_0: 0,
  fuel_zero_rated: 0,
  cashrec_total_banking: 0, cashrec_cash_banked: 0,
  cashrec_card_banked: 0, cashrec_other: 0,
});


const numFromCell = (s: string | undefined): number => {
  if (!s) return 0;
  const cleaned = s.replace(/[^\d.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const lineMatches = (line: string, kw: RegExp) => kw.test(line);

// The till X-Read is a CSV grid: "Lottery,31,105.50,6,31.50,0,0.00,37,137.00,".
// Numbers must therefore be read per CSV cell — a plain regex over the whole line
// reads "37,137.00" as thirty-seven thousand and corrupts lottery / car wash /
// drive-off figures. Always split on the delimiter first and take the LAST
// numeric cell (the consolidated "Total" column).
const lastNumberOnLine = (line: string): number | null => {
  const cells = line.split(/[,\t;]/).map(c => c.trim()).filter(c => c !== '');
  for (let i = cells.length - 1; i >= 0; i--) {
    if (/^-?\d+(?:\.\d+)?$/.test(cells[i])) return numFromCell(cells[i]);
  }
  return null;
};

const findTxtLineLast = (text: string, kw: RegExp): number => {
  for (const line of text.split(/\r?\n/)) {
    if (!lineMatches(line, kw)) continue;
    const n = lastNumberOnLine(line);
    if (n !== null) return n;
  }
  return 0;
};

const sumTxtLines = (text: string, kw: RegExp): number => {
  let total = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!lineMatches(line, kw)) continue;
    const n = lastNumberOnLine(line);
    if (n !== null) total += n;
  }
  return +total.toFixed(2);
};

// Map a department label (left-side text in DEPARTMENTVAT) to a category code.
// Amount columns only — VAT is tracked separately and never added into a category.
// GROCERY (family) is a virtual code — it means "split by rate: 20%→GS, 0%→GZ, 5%→DO".
// FORCE_GZ departments are always reported as Grocery Zero, never Grocery Std
// (client rule: FRANCHISE LOCAL for every Co-op shop, plus GROCERY 3 at Southwater
// only — GROCERY 3 stays a normal grocery department at every other shop).
const FORCE_GZ = /FRANCHISE\s*LOCAL|FRANCHISE\b/i;
const FORCE_GZ_SOUTHWATER = /GROCERY\s*3\b/i;

const DEPT_MAP: Array<[RegExp, keyof CoopCategoryTotals | 'GROCERY']> = [
  [/^FUEL\b/i, 'FU'],
  [/CIGARETTES|TOBACCO/i, 'TO'],
  // "SOFT BEVERAGES" is Drinks. Plain "BEVERAGES" (and any explicit alcohol
  // wording) is the licensed range and belongs in Alcohol Sales — this is the
  // Drinks / Alcohol split the client asked for.
  [/SOFT\s*BEVERAGES|SOFT\s*DRINKS|\bDRINKS\b/i, 'DR'],
  [/ALCOHOL|\bWINE\b|SPIRIT|\bBEER\b|\bCIDER\b|OFF\s*LICENCE|BWS|^BEVERAGES\b/i, 'AL'],
  [/NEWSPAPERS?|MAGAZINES?/i, 'NP'],
  [/PAYPOINT/i, 'paypoint'],
  [/PAYZONE/i, 'payzone'],
  [/VENDING/i, 'VM'],
  [/CAR\s*WASH|JET\s*WASH|CRA\s*WASH/i, 'CW'],
  // Everything below is grocery family — always split by VAT rate.
  [/GROCERY|FROZEN|PROVISIONS|CAR\s*CARE|CONCESSION|SEASONAL|STORE\s*EXPENSES|BAKERY|INSTORE\s*BKRY|FRUIT|VEGETABLES|MEAT|POULTRY|DELICATESSEN|FRANCHISE|LOCAL\s*PRODUCTS|PHONECARDS|\bDEPT\b/i, 'GROCERY'],
];

const codeForDept = (label: string, southwater = false): (keyof CoopCategoryTotals | 'GROCERY') | null => {
  if (FORCE_GZ.test(label)) return 'GZ';
  if (southwater && FORCE_GZ_SOUTHWATER.test(label)) return 'GZ';
  for (const [re, code] of DEPT_MAP) if (re.test(label)) return code;
  return null;
};

// Southwater is the only shop where GROCERY 3 moves into Grocery Zero.
export const isSouthwaterBranch = (branchName?: string | null) => /southwater/i.test(branchName || '');



interface DeptRow { label: string; net0: number; net20: number; vat20: number; net5: number; vat5: number; }

// Tolerant department parser:
// - splits on comma / tab / semicolon
// - strips empty cells
// - identifies a "dept row" by an uppercase-ish label that contains "- (NNN)" OR
//   matches one of the known department keywords
// - extracts up to 3 (net, vat) pairs from the row (for 0%, 20%, 5% — order in file
//   is consistent: 0%, then 20%, then 5%). VAT cells are the cell right after a
//   non-zero net cell in a numeric run.
const DEPT_HINT = /\bDEPT\b|\(\d{2,4}\)|FUEL|TOBACCO|CIGARETTES|BEVERAGES|GROCERY|FROZEN|PROVISIONS|ALCOHOL|WINE|SPIRIT|BEER|NEWSPAPER|MAGAZINE|VENDING|BAKERY|BKRY|FRUIT|VEGETABLES|MEAT|POULTRY|DELICATESSEN|CONCESSION|CAR\s*CARE|PHONECARDS|CAR\s*WASH|JET\s*WASH/i;

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

const splitStoredCoopRawText = (rawText?: string | null): CoopParseInput => {
  if (!rawText) return {};
  const marker = '\n---DEPT---\n';
  if (rawText.includes(marker)) {
    const [txt1, ...rest] = rawText.split(marker);
    return { txt1, deptVat: rest.join(marker) };
  }
  if (/Department\s+VAT\s+Report|^Department,|,0%,,,20%,,,5%/im.test(rawText)) return { deptVat: rawText };
  return { txt1: rawText };
};

export type VendingSplitMode = 'culverstone' | 'houndsmills';

/**
 * Apply the branch-specific split of the "Fuel dept @ 0% VAT" amount into
 * Vending Machines vs Car Wash. Mutates a shallow copy and returns it.
 *
 * - Culverstone-style: extra fuel-zero-rated amount is Vending only.
 *   VM += fuel_zero_rated (CW stays as X-Read "Car Wash" total).
 * - Houndsmills-style: fuel-zero-rated = Car Wash + Vending. Car Wash comes
 *   from the X-Read, and Vending is the remainder.
 *   VM = max(0, fuel_zero_rated - CW).
 */
export function applyVendingSplit(totals: CoopCategoryTotals, mode: VendingSplitMode | null | undefined): CoopCategoryTotals {
  const out = { ...totals };
  const extra = out.fuel_zero_rated || 0;
  if (!extra) return out;
  if (mode === 'houndsmills') {
    const remainder = Math.max(0, extra - (out.CW || 0));
    out.VM = +((out.VM || 0) + remainder).toFixed(2);
  } else {
    // culverstone (default): all extra fuel-zero-rated is vending
    out.VM = +((out.VM || 0) + extra).toFixed(2);
  }
  return out;
}

export function normalizeCoopParsedTotals(parsedTotals: any, rawText?: string | null, mode?: VendingSplitMode | null) {
  const input = splitStoredCoopRawText(rawText);
  const detailed = parseCoopFuelDetailed(input);
  if (!detailed.knownLabels.length) return parsedTotals || {};
  const breakdown = applyVendingSplit(detailed.totals, mode ?? 'culverstone');
  return {
    ...(parsedTotals || {}),
    shop: +(breakdown.TO + breakdown.DR + breakdown.AL + breakdown.GS + breakdown.GZ + breakdown.DO + breakdown.NP + breakdown.NP20 + breakdown.VM).toFixed(2),
    fuel: breakdown.FU,
    lottery: breakdown.national_lottery,
    breakdown,
    format: 'coop_fuel' as const,
  };
}

/**
 * Parse a weekly Cash Reconciliation CSV/text export. Very tolerant: matches
 * common label variants and returns the last numeric on each matching line.
 */
export function parseCashRec(text: string): {
  total_banking: number; cash_banked: number; card_banked: number; other: number;
} {
  const grab = (kw: RegExp) => findTxtLineLast(text, kw);
  const total_banking = grab(/Total\s*Banking|Total\s*Banked/i);
  const cash_banked  = grab(/Cash\s*Banked|Cash\s*Lifts?|Cash\s*Bank/i);
  const card_banked  = grab(/Card\s*Settlement|Card\s*Bank(?:ed)?|Merchant\s*Settlement/i);
  const other        = grab(/Other\s*Bank(?:ed)?|Cheque(?:s)?\s*Bank(?:ed)?/i);
  return { total_banking, cash_banked, card_banked, other };
}

/**
 * Weekly FIS credit-card settlement export (CSV / XLSX-converted-to-CSV).
 *
 * The FIS files differ slightly per acquirer, so this parser is deliberately
 * tolerant: every line that contains a date and a numeric amount is attributed
 * to a card scheme by keyword, and amounts are accumulated per transaction date.
 */
export interface FisCardDay {
  visa_mc: number; amex: number; fuel_card: number; other: number; total: number;
}
export interface FisCardParseResult {
  byDate: Record<string, FisCardDay>;
  weekTotals: FisCardDay;
  matchedLines: number;
}

const emptyFisDay = (): FisCardDay => ({ visa_mc: 0, amex: 0, fuel_card: 0, other: 0, total: 0 });

const normaliseFisDate = (raw: string): string | null => {
  let m = raw.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = raw.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yr}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
};

export function parseFisCardStatement(text: string): FisCardParseResult {
  const byDate: Record<string, FisCardDay> = {};
  const weekTotals = emptyFisDay();
  let matchedLines = 0;

  for (const rawLine of (text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/total|summary|grand/i.test(line) && !/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(line)) continue;

    const dateStr = normaliseFisDate(line);
    if (!dateStr) continue;

    // Collect numbers, ignoring the date digits themselves.
    const withoutDate = line.replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, ' ');
    const nums = (withoutDate.match(/-?\d[\d,]*\.\d{2}|-?\d[\d,]*(?=\s|,|$)/g) || [])
      .map(n => Number(n.replace(/,/g, '')))
      .filter(n => Number.isFinite(n) && n !== 0);
    if (!nums.length) continue;

    // Prefer a decimal money value; otherwise take the largest magnitude.
    const decimals = (withoutDate.match(/-?\d[\d,]*\.\d{2}/g) || []).map(n => Number(n.replace(/,/g, '')));
    const amount = decimals.length
      ? decimals[decimals.length - 1]
      : nums.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), nums[0]);
    if (!amount) continue;

    let key: keyof FisCardDay = 'other';
    if (/amex|american\s*express/i.test(line)) key = 'amex';
    else if (/all\s*star|allstar|uk\s*fuels|key\s*fuels|fuel\s*card|routex|fleet|texaco|shell|bp\b|esso|keyfuels/i.test(line)) key = 'fuel_card';
    else if (/visa|master(?:card)?|maestro|debit|credit|v\/mc|vmc|contactless/i.test(line)) key = 'visa_mc';

    if (!byDate[dateStr]) byDate[dateStr] = emptyFisDay();
    byDate[dateStr][key] = +(byDate[dateStr][key] + amount).toFixed(2);
    byDate[dateStr].total = +(byDate[dateStr].total + amount).toFixed(2);
    weekTotals[key] = +(weekTotals[key] + amount).toFixed(2);
    weekTotals.total = +(weekTotals.total + amount).toFixed(2);
    matchedLines++;
  }

  return { byDate, weekTotals, matchedLines };
}


export async function spreadsheetBufferToCsvText(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array' });
  return wb.SheetNames
    .map((sheetName) => XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { FS: ',', RS: '\n' }))
    .join('\n');
}

export function parseCoopFuelDetailed(input: CoopParseInput): CoopParseResult {
  const out = emptyCoopTotals();
  const knownLabels: string[] = [];
  const unknownDepartments: UnknownDepartment[] = [];

  const deptSource = input.deptVat || input.txt1 || '';
  if (deptSource) {
    for (const r of parseDepartmentVat(deptSource)) {
      const code = codeForDept(r.label);
      const totalNet = +(r.net20 + r.net5 + r.net0).toFixed(2);
      // Aggregate VAT/net splits regardless of mapping success
      out.vat_20 = +(out.vat_20 + r.vat20).toFixed(2);
      out.vat_5  = +(out.vat_5  + r.vat5).toFixed(2);
      out.net_20 = +(out.net_20 + r.net20).toFixed(2);
      out.net_5  = +(out.net_5  + r.net5).toFixed(2);
      out.net_0  = +(out.net_0  + r.net0).toFixed(2);
      if (!code) {
        // Department VAT's National Lottery row is not the same as the sales
        // paperwork split for Lottery/Scratchcards/Payouts. Those values come
        // from TXT1, so do not map this department row into sales columns.
        if (/NATIONAL\s*LOTTERY/i.test(r.label)) {
          knownLabels.push(r.label);
          continue;
        }
        if (totalNet !== 0) unknownDepartments.push({ label: r.label, amount: totalNet });
        continue;
      }
      knownLabels.push(r.label);

      // GROCERY family — split by VAT rate: 20%→GS, 0%→GZ, 5%→DO.
      if (code === 'GROCERY') {
        if (r.net20 > 0) out.GS = +(out.GS + r.net20).toFixed(2);
        if (r.net0 > 0)  out.GZ = +(out.GZ + r.net0).toFixed(2);
        if (r.net5 > 0)  out.DO = +(out.DO + r.net5).toFixed(2);
        continue;
      }

      // FORCE_GZ departments (Franchise Local, Southwater Grocery 3): the whole
      // net value belongs to Grocery Zero, deducted from Grocery Std.
      if (code === 'GZ') {
        out.GZ = +(out.GZ + r.net0 + r.net20).toFixed(2);
        if (r.net5 > 0) out.DO = +(out.DO + r.net5).toFixed(2);
        continue;
      }

      if (r.net5 > 0) out.DO = +(out.DO + r.net5).toFixed(2);

      if (code === 'FU') {
        out.FU = +(out.FU + r.net20).toFixed(2);
        // Capture Fuel-department 0% amount for branch-specific VM/CW split.
        if (r.net0 > 0) out.fuel_zero_rated = +(out.fuel_zero_rated + r.net0).toFixed(2);
      } else if (code === 'NP') {
        // Zero-rated newspapers stay in NP; anything at 20% (gaming cards sold
        // through the newspapers department) is reported separately at 20% VAT.
        out.NP = +(out.NP + r.net0).toFixed(2);
        if (r.net20 > 0) out.NP20 = +(out.NP20 + r.net20).toFixed(2);
      } else if (code === 'VM' || code === 'CW') {
        (out[code] as number) = +((out[code] as number) + r.net0 + r.net20).toFixed(2);
      } else if (code === 'paypoint' || code === 'payzone') {
        if ((out[code] as number) === 0) (out[code] as number) = +totalNet.toFixed(2);
      } else if (code === 'DR' || code === 'TO' || code === 'AL') {
        (out[code] as number) = +((out[code] as number) + r.net20).toFixed(2);
        if (r.net0 > 0) out.GZ = +(out.GZ + r.net0).toFixed(2);
      }

    }
  }

  if (input.txt1) {
    const t = input.txt1;
    out.national_lottery   = findTxtLineLast(t, /^\s*Lottery(?!\s*(Prizes|Payouts?|Commission))\b/im) ||
                             findTxtLineLast(t, /National\s*Lottery(?!\s*(Prizes|Payouts?|Commission))/i);
    out.instant_lottery    = findTxtLineLast(t, /Scratchcards?(?!\s*(Prizes|Payouts?|Commission))/i) ||
                             findTxtLineLast(t, /Instant\s*Lottery/i);
    out.lottery_payouts    = -Math.abs(findTxtLineLast(t, /Lotto\s*Prizes/i)) +
                             -Math.abs(findTxtLineLast(t, /Scratchcard\s*Prizes/i));
    out.paypoint           = findTxtLineLast(t, /^\s*Paypoint\b/im);
    out.payzone            = findTxtLineLast(t, /^\s*Payzone\b/im);
    const carWash          = sumTxtLines(t, /CAR\s*WASH/i);
    const jetWash          = sumTxtLines(t, /JET\s*WASH/i);
    if (out.CW === 0) out.CW = +(carWash + jetWash).toFixed(2);
    out.fuel_drive_off     = -Math.abs(findTxtLineLast(t, /Drive\s*Off/i));
    out.petty_cash         = -Math.abs(findTxtLineLast(t, /^\s*Payouts\b/im));

    // Fuel litres sold — prefer an explicit total line, otherwise sum the grades.
    const totalLitres = findTxtLineLast(t, /(Total\s*Litres|Litres\s*Total|Volume\s*Total)/i);
    out.fuel_litres = totalLitres || sumTxtLines(t, /\bLitres?\b/i);


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
      { code: 'NP20', description: 'Newspaper - Standard Rate', account: '207', taxType: '20% (VAT on Income)', amount: t.NP20 },

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
    'DATE','BRANCH',
    'SHOP SALES','CARWASH','VENDING MACHINES','PAYZONE',
    'FUEL SALES','LOTTO SALES','LOTTO PRIZE','DRIVE OFF','CREDIT C.SALES','CASH S.TOTAL',
    'ACCOUNT CUSTOMERS','VOUCHERS INCOME','MISC. EXPENCE','PRODUCTS FOR RESALE',
    'TOTAL BANKING','CLOSING CASH BAL.','ACTUAL CASH/CHQ','CASH DIFFERENT'
  ];
  const out = [headers.join(',')];
  const fmt = (n: number) => (n ? Number(n).toFixed(2) : '');
  for (const r of rows) {
    const t = r.totals;
    const shopSales = (t.TO || 0) + (t.DR || 0) + (t.AL || 0) + (t.GS || 0) + (t.GZ || 0) +
                      (t.DO || 0) + (t.NP || 0) + (t.NP20 || 0);
    const lottoSales = (t.national_lottery || 0) + (t.instant_lottery || 0);
    const driveOff = t.fuel_drive_off ? -Math.abs(t.fuel_drive_off) : 0;
    const creditCards = (t.visa_mc || 0) + (t.amex || 0) + (t.fuel_card || 0);
    const lottoPrize = Math.abs(t.lottery_payouts || 0);
    const misc = Math.abs(t.petty_cash || 0);
    const totalBanking = shopSales + (t.CW || 0) + (t.VM || 0) + (t.payzone || 0) +
      (t.FU || 0) + lottoSales - lottoPrize + driveOff - creditCards -
      (t.customer_account || 0) - (t.coupon || 0) - misc;
    const cols = [
      r.sale_date, r.branch_name,
      fmt(shopSales), fmt(t.CW), fmt(t.VM), fmt(t.payzone),
      fmt(t.FU), fmt(lottoSales), fmt(lottoPrize), fmt(driveOff),
      fmt(creditCards), fmt(t.cash_tender),
      fmt(t.customer_account), fmt(t.coupon), fmt(misc), '',
      fmt(totalBanking), fmt(totalBanking), fmt(t.cash_in_drawer),
      fmt((t.cash_in_drawer || 0) - totalBanking)
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

  const SALE_SHEET = '  SALE  ';
  const CCARD_SHEET = 'C.CARD';
  const SALE_REF = `'${SALE_SHEET}'`;
  const CCARD_REF = `'${CCARD_SHEET}'`;
  const HEADER_ROW = 5;            // title() = 4 rows, header on row 5
  const FIRST_DATA_ROW = HEADER_ROW + 1;
  const setF = (ws: any, addr: string, f: string) => { ws[addr] = { t: 'n', f }; };
  const colTotals = (ws: any, cols: string[], lastRow: number, totalRow: number) => {
    if (lastRow < FIRST_DATA_ROW) return;
    for (const c of cols) setF(ws, `${c}${totalRow}`, `SUM(${c}${FIRST_DATA_ROW}:${c}${lastRow})`);
  };

  // ---------------- SALE — departmental breakdown ----------------
  // A DATE | B FUEL | C FUEL LITRES | D TOBACCO | E DRINKS | F ALCOHOL |
  // G GROCERY STD | H GROCERY ZERO | I DOMESTIC 5% | J NEWSPAPERS |
  // K NEWSPAPERS 20% | L VENDING | M CAR WASH | N NAT LOTTERY |
  // O SCRATCHCARDS | P PAYPOINT | Q PAYZONE | R LOTTO PAYOUTS | S..W VAT split
  const saleHeaders = ['DATE','FUEL','FUEL SOLD LITRES','TOBACCO','DRINKS','ALCOHOL',
    'GROCERY STD','GROCERY ZERO','DOMESTIC 5%','NEWSPAPERS','NEWSPAPERS 20%',
    'VENDING','CAR WASH','NAT LOTTERY','SCRATCHCARDS','PAYPOINT','PAYZONE',
    'LOTTO PAYOUTS','NET 0%','NET 20%','VAT 20%','NET 5%','VAT 5%'];
  const saleRows: any[][] = [...title('Sales by Department'), saleHeaders];
  for (const r of rows) {
    const t = r.totals;
    saleRows.push([
      r.sale_date,
      t.FU || '', t.fuel_litres || '',
      t.TO || '', t.DR || '', t.AL || '',
      t.GS || '', t.GZ || '', t.DO || '',
      t.NP || '', t.NP20 || '',
      t.VM || '', t.CW || '',
      t.national_lottery || '', t.instant_lottery || '',
      t.paypoint || '', t.payzone || '',
      t.lottery_payouts || '',
      t.net_0 || '', t.net_20 || '', t.vat_20 || '', t.net_5 || '', t.vat_5 || ''
    ]);
  }
  const saleWs = XLSX.utils.aoa_to_sheet(saleRows);
  const saleLastRow = HEADER_ROW + rows.length;
  const saleTotalRow = saleLastRow + 1;
  if (rows.length) {
    saleWs[`A${saleTotalRow}`] = { t: 's', v: 'TOTAL' };
    colTotals(saleWs, ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W'], saleLastRow, saleTotalRow);
    saleWs['!ref'] = `A1:W${saleTotalRow}`;
  }
  XLSX.utils.book_append_sheet(wb, saleWs, SALE_SHEET);

  // ---------------- C.CARD — weekly card settlement breakdown ----------------
  // A DATE | B VISA/MC | C AMEX | D FUEL CARD | E OTHER | F TOTAL
  const ccardHeaders = ['DATE','VISA/MC','AMEX','FUEL CARD','OTHER','TOTAL'];
  const ccardRows: any[][] = [...title('Credit Card Receipts'), ccardHeaders];
  for (const r of rows) {
    const t = r.totals;
    ccardRows.push([r.sale_date, t.visa_mc || '', t.amex || '', t.fuel_card || '', '', null]);
  }
  const ccardWs = XLSX.utils.aoa_to_sheet(ccardRows);
  const ccardLastRow = HEADER_ROW + rows.length;
  const ccardTotalRow = ccardLastRow + 1;
  for (let i = 0; i < rows.length; i++) {
    const n = FIRST_DATA_ROW + i;
    setF(ccardWs, `F${n}`, `SUM(B${n}:E${n})`);
  }
  if (rows.length) {
    ccardWs[`A${ccardTotalRow}`] = { t: 's', v: 'TOTAL' };
    colTotals(ccardWs, ['B','C','D','E','F'], ccardLastRow, ccardTotalRow);
    ccardWs['!ref'] = `A1:F${ccardTotalRow}`;
  }
  XLSX.utils.book_append_sheet(wb, ccardWs, CCARD_SHEET);

  // ---------------- CASH SUM1 — live formulas off SALE + C.CARD ----------------
  // A DATE | B SHOP SALES | C CARWASH | D VENDING MACHINES | E PAYZONE |
  // F FUEL SALES | G LOTTO SALES | H LOTTO PRIZE | I DRIVE OFF |
  // J CREDIT C.SALES | K CASH S.TOTAL | L ACCOUNT CUSTOMERS |
  // M VOUCHERS INCOME | N MISC. EXPENCE | O PRODUCTS FOR RESALE |
  // P TOTAL BANKING | Q CLOSING CASH BAL. | R ACTUAL CASH/CHQ | S CASH DIFFERENT
  const cashHeaders = [
    'DATE','SHOP SALES','CARWASH','VENDING MACHINES','PAYZONE',
    'FUEL SALES','LOTTO SALES','LOTTO PRIZE','DRIVE OFF','CREDIT C.SALES',
    'CASH S.TOTAL','ACCOUNT CUSTOMERS','VOUCHERS INCOME','MISC. EXPENCE',
    'PRODUCTS FOR RESALE','TOTAL BANKING','CLOSING CASH BAL.','ACTUAL CASH/CHQ',
    'CASH DIFFERENT'
  ];
  const cashRows: any[][] = [...title('Cash Summary (CASH SUM1)'), cashHeaders];
  for (const r of rows) {
    const t = r.totals;
    cashRows.push([
      r.sale_date,
      null, null, null, null, null, null, null,
      // Drive-offs always land here as a negative figure (X-Read shows them as
      // a deduction, whatever sign the report happens to print).
      t.fuel_drive_off ? -Math.abs(t.fuel_drive_off) : '',
      null,
      t.cash_tender || '',
      t.customer_account || '', t.coupon || '',
      Math.abs(t.petty_cash || 0) || '', '',
      null, null,
      t.cash_in_drawer || '',
      null,
    ]);
  }
  const cashWs = XLSX.utils.aoa_to_sheet(cashRows);
  const cashLastRow = HEADER_ROW + rows.length;
  const cashTotalRow = cashLastRow + 1;
  for (let i = 0; i < rows.length; i++) {
    const n = FIRST_DATA_ROW + i;
    setF(cashWs, `B${n}`, `SUM(${SALE_REF}!D${n}:${SALE_REF}!K${n})`);
    setF(cashWs, `C${n}`, `${SALE_REF}!M${n}`);
    setF(cashWs, `D${n}`, `${SALE_REF}!L${n}`);
    setF(cashWs, `E${n}`, `${SALE_REF}!Q${n}`);
    setF(cashWs, `F${n}`, `${SALE_REF}!B${n}`);
    // Lotto Sales = National Lottery + Instant Lottery
    setF(cashWs, `G${n}`, `${SALE_REF}!N${n}+${SALE_REF}!O${n}`);
    setF(cashWs, `H${n}`, `ABS(${SALE_REF}!R${n})`);
    // Credit sales pull straight from the C.CARD tab
    setF(cashWs, `J${n}`, `${CCARD_REF}!F${n}`);
    // Banking = gross takings less prizes, drive-offs, cards, accounts and payouts
    setF(cashWs, `P${n}`, `SUM(B${n}:G${n})-H${n}+I${n}-J${n}-L${n}-M${n}-N${n}-O${n}`);
    setF(cashWs, `Q${n}`, `P${n}`);
    setF(cashWs, `S${n}`, `R${n}-P${n}`);
  }
  if (rows.length) {
    cashWs[`A${cashTotalRow}`] = { t: 's', v: 'TOTAL' };
    colTotals(cashWs, ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S'], cashLastRow, cashTotalRow);
    cashWs['!ref'] = `A1:S${cashTotalRow}`;
  }
  XLSX.utils.book_append_sheet(wb, cashWs, 'CASH SUM1');

  const stub = (label: string, headers: string[]) => {
    const aoa: any[][] = [...title(label), headers];
    for (const r of rows) {
      const row = new Array(headers.length).fill('');
      row[0] = r.sale_date;
      aoa.push(row);
    }
    return XLSX.utils.aoa_to_sheet(aoa);
  };

  // ---- Removed by client request: SHIFT SHEET, COUNTING, DIPS, P&L, BANK,
  // STOCK CONT, Week Wages, HOURS & WAGES, comp statement.
  // OBJECTIVE is kept as a skeleton for management notes.
  XLSX.utils.book_append_sheet(wb, stub('Objectives',
    ['DATE','OBJECTIVE','TARGET','ACTUAL','VARIANCE','NOTES']), 'OBJECTIVE');


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

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Format registry — single source of truth used across UI.
export const IMPORT_FORMATS = [
  { id: 'coop_fuel', label: '1. Co-op Fuel stores', description: 'TXT till export plus optional Department VAT CSV/XLSX → paperwork-matched net category sales.' },
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


