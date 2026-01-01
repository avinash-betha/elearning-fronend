import { Injectable } from '@angular/core';

export type CurrencyCode = string;

function safeNavigatorLanguage(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav: any = (globalThis as any).navigator;
    return String(nav?.language || nav?.languages?.[0] || '').trim();
  } catch {
    return '';
  }
}

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  /**
   * Best-effort default currency resolver.
   * TODO(backend): Replace with server-side geo/IP or user preference stored in profile.
   */
  resolveDefaultCurrency(): CurrencyCode {
    const lang = safeNavigatorLanguage().toLowerCase();

    // Very small heuristic mapping (keep simple + predictable).
    if (lang.endsWith('-in') || lang === 'en-in' || lang.startsWith('hi')) return 'INR';
    if (lang.endsWith('-gb') || lang === 'en-gb') return 'GBP';
    if (lang.endsWith('-au') || lang === 'en-au') return 'AUD';
    if (lang.endsWith('-ca') || lang === 'en-ca' || lang.startsWith('fr-ca')) return 'CAD';
    if (lang.endsWith('-de') || lang.startsWith('de') || lang.startsWith('fr') || lang.startsWith('es') || lang.startsWith('it')) return 'EUR';
    if (lang.endsWith('-jp') || lang.startsWith('ja')) return 'JPY';

    return 'USD';
  }

  formatMoney(cents: number, currency?: CurrencyCode): string {
    const cur = String(currency || this.resolveDefaultCurrency()).toUpperCase();
    const amount = Math.max(0, Number(cents) || 0) / 100;

    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(amount);
    } catch {
      // Fallback formatting if Intl rejects the currency.
      const fixed = amount.toFixed(2);
      if (cur === 'USD') return `$${fixed}`;
      return `${cur} ${fixed}`;
    }
  }
}
