import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface Coupon {
  code: string;
  discountType: 'percent' | 'amount';
  value: number;
}

@Injectable({ providedIn: 'root' })
export class CouponService {
  constructor(private http: HttpClient) {}

  async validateForUser(code: string, courseId: string, _email: string): Promise<{ ok: boolean; coupon?: Coupon; error?: string }> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ coupon: Coupon }>(`${API_BASE_URL}/coupons/validate`, { code, courseId })
      );
      return { ok: true, coupon: res.coupon };
    } catch (e: any) {
      return { ok: false, error: e?.error?.message || 'Invalid coupon' };
    }
  }

  async redeem(code: string): Promise<void> {
    await firstValueFrom(this.http.post(`${API_BASE_URL}/coupons/redeem`, { code }));
  }
}
