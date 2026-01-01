import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface PaymentRecord {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  constructor(private http: HttpClient) {}

  async listMethods(): Promise<PaymentMethod[]> {
    return firstValueFrom(this.http.get<PaymentMethod[]>(`${API_BASE_URL}/payment-methods`));
  }

  async addCardMethod(input: { nameOnCard: string; cardNumber: string; expMonth: number; expYear: number }): Promise<PaymentMethod> {
    return firstValueFrom(this.http.post<PaymentMethod>(`${API_BASE_URL}/payment-methods`, input));
  }

  async removeMethod(methodId: string): Promise<void> {
    const id = String(methodId || '').trim();
    await firstValueFrom(this.http.delete(`${API_BASE_URL}/payment-methods/${id}`));
  }

  async createPayment(input: { amountCents: number; currency: string; methodId: string; description?: string; metadata?: Record<string, string> }): Promise<PaymentRecord> {
    return firstValueFrom(this.http.post<PaymentRecord>(`${API_BASE_URL}/payments`, input));
  }
}
