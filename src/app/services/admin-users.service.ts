import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { AppUser } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  constructor(private http: HttpClient) {}

  async listAll(): Promise<AppUser[]> {
    return firstValueFrom(this.http.get<AppUser[]>(`${API_BASE_URL}/users`));
  }

  async getById(userId: string): Promise<AppUser> {
    const id = String(userId || '').trim();
    return firstValueFrom(this.http.get<AppUser>(`${API_BASE_URL}/users/${id}`));
  }

  async update(userId: string, patch: Partial<Pick<AppUser, 'name' | 'email' | 'role' | 'status' | 'instructorApplicationStatus'>>): Promise<AppUser> {
    const id = String(userId || '').trim();
    return firstValueFrom(this.http.put<AppUser>(`${API_BASE_URL}/users/${id}`, patch));
  }
}
