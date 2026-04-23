// Lightweight CSV export utility (no extra deps)

const escape = (val: any): string => {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export function downloadCSV(filename: string, rows: Record<string, any>[], headers?: { key: string; label: string }[]) {
  if (!rows || rows.length === 0) {
    const blob = new Blob(['No data'], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, filename);
    return;
  }
  const cols = headers && headers.length > 0
    ? headers
    : Object.keys(rows[0]).map(k => ({ key: k, label: k }));

  const headerLine = cols.map(c => escape(c.label)).join(',');
  const dataLines = rows.map(r => cols.map(c => escape(r[c.key])).join(','));
  const csv = [headerLine, ...dataLines].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
