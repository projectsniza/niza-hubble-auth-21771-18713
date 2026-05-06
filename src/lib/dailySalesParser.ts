// Best-effort parser for till daily reports.
// Extracts shop, fuel and lottery totals from various CSV formats.

export interface DailySalesTotals {
  shop: number;
  fuel: number;
  lottery: number;
  scratchcards?: number;
  paypoint?: number;
  payzone?: number;
  carwash?: number;
  jetwash?: number;
  card?: number;
  cash?: number;
  net_takings?: number;
}

const num = (s: string | undefined): number => {
  if (!s) return 0;
  const cleaned = s.replace(/[^\d.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const findLineAmount = (text: string, keywords: RegExp): number => {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!keywords.test(line)) continue;
    // Grab all decimal numbers on the line — take the LAST one (typical "total" column)
    const matches = line.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+\.\d+/g);
    if (matches && matches.length) return num(matches[matches.length - 1]);
  }
  return 0;
};

const sumLineAmounts = (text: string, keywords: RegExp): number => {
  const lines = text.split(/\r?\n/);
  let total = 0;
  for (const line of lines) {
    if (!keywords.test(line)) continue;
    const matches = line.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+\.\d+/g);
    if (matches && matches.length) total += num(matches[matches.length - 1]);
  }
  return total;
};

export function parseDailySales(rawText: string): DailySalesTotals {
  const text = rawText || '';

  // Fuel: prefer "Total Motor Fuels" or "Motor Fuels" or sum of fuel line items
  let fuel = findLineAmount(text, /Total\s+Motor\s+Fuels/i);
  if (!fuel) fuel = findLineAmount(text, /Motor\s+Fuels/i);
  if (!fuel) fuel = findLineAmount(text, /\bFUEL\s*-/i);

  // Shop sales: "Shop Sales" / "Net Takings" minus fuel as fallback
  let shop = findLineAmount(text, /Shop\s+Sales/i);
  const netTakings = findLineAmount(text, /Net\s+Takings/i);
  if (!shop && netTakings && fuel) shop = +(netTakings - fuel).toFixed(2);
  if (!shop && netTakings && !fuel) shop = netTakings;

  // Lottery
  let lottery = findLineAmount(text, /National\s+Lottery|^Lottery\b|\bLottery\s+Sales/i);
  if (!lottery) lottery = findLineAmount(text, /\bLottery\b/i);

  const scratchcards = findLineAmount(text, /Scratchcards|Instant\s+Lottery/i);
  const paypoint = findLineAmount(text, /Paypoint/i);
  const payzone = findLineAmount(text, /Payzone/i);
  const carwash = sumLineAmounts(text, /CAR\s*WASH/i);
  const jetwash = sumLineAmounts(text, /JET\s*WASH/i);
  const card = findLineAmount(text, /Visa\/?Mastercard|Card\s+Total/i);
  const cash = findLineAmount(text, /^Cash\b|\bCash\s+Total/im);

  return {
    shop: +shop.toFixed(2),
    fuel: +fuel.toFixed(2),
    lottery: +lottery.toFixed(2),
    scratchcards: +scratchcards.toFixed(2),
    paypoint: +paypoint.toFixed(2),
    payzone: +payzone.toFixed(2),
    carwash: +carwash.toFixed(2),
    jetwash: +jetwash.toFixed(2),
    card: +card.toFixed(2),
    cash: +cash.toFixed(2),
    net_takings: +netTakings.toFixed(2),
  };
}

// Xero CSV builder: one row per non-zero category
export function buildXeroCsv(rows: Array<{ sale_date: string; totals: DailySalesTotals; branch_name?: string }>): string {
  const header = 'Contact,InvoiceNumber,Date,Description,Quantity,UnitAmount,AccountCode,TaxType';
  const out: string[] = [header];

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };

  rows.forEach((row, idx) => {
    const date = fmtDate(row.sale_date);
    const dateKey = row.sale_date.replace(/-/g, '-');
    const seq = String(idx + 1).padStart(2, '0');
    const t = row.totals;
    const lines: Array<[string, string, number, string, string]> = [
      ['Daily Sales - Shop', 'Shop Sales Total', t.shop, '200', '20% (VAT on Income)'],
      ['Daily Sales - Fuel', 'Fuel Sales Total', t.fuel, '201', '20% (VAT on Income)'],
      ['Daily Sales - Lottery', 'Lottery Sales Total', t.lottery, '205', 'No VAT'],
    ];
    lines.forEach((l, i) => {
      if (l[2] === 0) return;
      const inv = `DS-${dateKey}-${seq}-${String(i + 1).padStart(2, '0')}`;
      out.push([l[0], inv, date, l[3], '1', l[2].toFixed(2), l[4]].map(csvEscape).join(','));
    });
  });

  return out.join('\n');
}

const csvEscape = (v: string | number) => {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};
