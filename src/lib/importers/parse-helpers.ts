export function parseAmount(raw: string): number {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/\s/g, '').replace(/€|EUR/gi, '');
  if (!s) return NaN;
  // Cases: "1.234,56" ES, "1,234.56" EN, "1234.56", "1234,56", "-12,30", "(12.30)"
  const isParen = /^\(.+\)$/.test(s);
  if (isParen) s = '-' + s.slice(1, -1);
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // decimal is whichever comes last
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // yyyy-mm-dd or yyyy/mm/dd
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function normalizeDesc(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
