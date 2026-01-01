import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface CartItem {
  courseId: string;
  addedAtIso: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  constructor(private http: HttpClient) {}

  async getItems(): Promise<CartItem[]> {
    return firstValueFrom(this.http.get<CartItem[]>(`${API_BASE_URL}/cart`));
  }

  async add(courseId: string): Promise<{ added: boolean }> {
    await firstValueFrom(this.http.post(`${API_BASE_URL}/cart`, { courseId }));
    return { added: true };
  }

  async remove(courseId: string): Promise<void> {
    const id = String(courseId || '').trim();
    await firstValueFrom(this.http.delete(`${API_BASE_URL}/cart/${id}`));
  }
}
