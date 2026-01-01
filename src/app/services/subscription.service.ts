import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export type SubscriptionPlan = 'free' | 'monthly' | 'yearly';

export interface SubscriptionRecord {
  plan: SubscriptionPlan;
  status: string;
  startedAtIso?: string;
  renewsAtIso?: string;
  organizationName?: string;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  constructor(private http: HttpClient) {}

  async get(): Promise<SubscriptionRecord | null> {
    return firstValueFrom(this.http.get<SubscriptionRecord>(`${API_BASE_URL}/subscriptions/me`));
  }

  async set(input: { plan: SubscriptionPlan; startedAtIso?: string; renewsAtIso?: string; organizationName?: string }): Promise<SubscriptionRecord> {
    return firstValueFrom(this.http.post<SubscriptionRecord>(`${API_BASE_URL}/subscriptions`, input));
  }

  async cancel(): Promise<void> {
    await firstValueFrom(this.http.delete(`${API_BASE_URL}/subscriptions/me`));
  }
}
