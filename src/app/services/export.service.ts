import { Injectable } from '@angular/core';

export type ExportPrimitive = string | number | boolean | null | undefined | Date;
export type ExportRow = Record<string, ExportPrimitive>;

function toIso(value: ExportPrimitive): string {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return '';
  return String(value);
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

@Injectable({ providedIn: 'root' })
export class ExportService {
  /**
   * Exports rows to a CSV file.
   *
   * TODO(backend): Replace with server-side export (for large datasets) and signed download URLs.
   */
  exportCsv(filename: string, rows: ExportRow[], columns?: string[]): void {
    const cols = (columns && columns.length > 0)
      ? columns
      : Array.from(new Set(rows.flatMap((r) => Object.keys(r))));

    const header = cols.map((c) => escapeCsv(c)).join(',');
    const lines = rows.map((r) => cols.map((c) => escapeCsv(toIso(r[c]))).join(','));

    const csv = [header, ...lines].join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
  }

  /**
   * Exports one or more sheets to an Excel workbook.
   *
   * Uses dynamic import to avoid increasing initial bundle size unnecessarily.
   */
  async exportExcel(filename: string, sheets: Array<{ name: string; rows: ExportRow[] }>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const xlsx = await import('xlsx');

    const wb = xlsx.utils.book_new();

    for (const s of sheets) {
      const ws = xlsx.utils.json_to_sheet(s.rows);
      xlsx.utils.book_append_sheet(wb, ws, s.name);
    }

    const out = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
  }
}
