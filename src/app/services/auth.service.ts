import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export type UserRole = 'student' | 'instructor' | 'admin';
export type UserStatus = 'active' | 'suspended';
export type InstructorApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAtIso: string;
  profilePhotoDataUrl?: string;
  instructorApplicationStatus?: InstructorApplicationStatus;
}

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private http: HttpClient) {}

  async register(input: { name: string; email: string; password: string; requestedRole?: UserRole }): Promise<{
    user: AppUser;
    needsInstructorApplication: boolean;
  }> {
    const payload = {
      name: input.name,
      fullName: input.name,
      email: input.email,
      password: input.password,
      requestedRole: input.requestedRole || 'student'
    };
    const res = await firstValueFrom(
      this.http.post<{ id: string; name?: string; fullName?: string; email: string; role: string }>(`${API_BASE_URL}/auth/signup`, payload)
    );
    const user: AppUser = {
      id: res.id,
      name: res.name || res.fullName || input.name,
      email: res.email,
      role: this.normalizeRole(res.role),
      status: 'active',
      createdAtIso: ''
    };
    return { user, needsInstructorApplication: input.requestedRole === 'instructor' };
  }

  async login(email: string, password: string): Promise<AppUser> {
    const res = await firstValueFrom(
      this.http.post<{ accessToken: string; tokenType?: string }>(`${API_BASE_URL}/auth/login`, { email, password })
    );
    this.setTokens(res.accessToken, '');
    try {
      const user = await this.fetchCurrentUser();
      if (user) return user;
    } catch {
      // Fallback to token-derived identity if /users/me is unavailable.
    }
    const fallback = this.buildUserFromToken(res.accessToken, email);
    this.setSession(fallback);
    return fallback;
  }

  async refresh(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');
    const res = await firstValueFrom(
      this.http.post<{ accessToken: string }>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
    );
    this.setTokens(res.accessToken, refreshToken);
    return res.accessToken;
  }

  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/auth/logout`, { refreshToken }));
    }
    this.clearSession();
  }

  setSession(user: Pick<AppUser, 'email' | 'name' | 'role'> & { profilePhotoDataUrl?: string }): void {
    const role = normalizeEmail(user.role).toLowerCase();
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userRole', role);

    const photo = user.profilePhotoDataUrl || '';
    if (photo) {
      localStorage.setItem('userProfilePhoto', photo);
    } else {
      localStorage.removeItem('userProfilePhoto');
    }
  }

  clearSession(): void {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userProfilePhoto');
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  getSessionEmail(): string {
    return normalizeEmail(localStorage.getItem('userEmail') || '');
  }

  async fetchCurrentUser(): Promise<AppUser | null> {
    const token = this.getAccessToken();
    if (!token) return null;
    try {
      const res = await firstValueFrom(
        this.http.get<{ id: string; fullName?: string; name?: string; email: string; role: string; createdAt?: string }>(`${API_BASE_URL}/users/me`)
      );
      const user: AppUser = {
        id: res.id,
        name: res.fullName || res.name || localStorage.getItem('userName') || '',
        email: res.email,
        role: this.normalizeRole(res.role),
        status: 'active',
        createdAtIso: res.createdAt || ''
      };
      this.setSession(user);
      return user;
    } catch {
      return null;
    }
  }

  getCurrentUser(): AppUser | null {
    const email = this.getSessionEmail();
    if (!email) return null;
    return {
      id: '',
      name: localStorage.getItem('userName') || '',
      email,
      role: (localStorage.getItem('userRole') as UserRole) || 'student',
      status: 'active',
      createdAtIso: ''
    };
  }

  async updateCurrentUser(patch: Partial<Pick<AppUser, 'name' | 'profilePhotoDataUrl'>> & { email?: string }): Promise<AppUser> {
    const res = await firstValueFrom(this.http.put<AppUser>(`${API_BASE_URL}/users/me`, patch));
    this.setSession(res);
    return res;
  }

  async updateUserByEmail(userId: string, patch: Partial<Pick<AppUser, 'name' | 'email' | 'role' | 'status' | 'instructorApplicationStatus'>>): Promise<AppUser> {
    return firstValueFrom(this.http.put<AppUser>(`${API_BASE_URL}/users/${userId}`, patch));
  }

  getAccessToken(): string {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
  }

  getRefreshToken(): string {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || '';
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  private normalizeRole(role: string): UserRole {
    const value = String(role || '').trim().toLowerCase();
    if (value === 'student' || value === 'instructor' || value === 'admin') return value;
    return 'student';
  }

  private buildUserFromToken(token: string, email: string): AppUser {
    const payload = this.decodeJwtPayload(token) as Record<string, any>;
    const role = this.normalizeRole(payload['role'] || payload['authorities']?.[0] || '');
    return {
      id: String(payload['sub'] || ''),
      name: localStorage.getItem('userName') || '',
      email,
      role,
      status: 'active',
      createdAtIso: ''
    };
  }

  private decodeJwtPayload(token: string): Record<string, any> {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return {};
    try {
      const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch {
      return {};
    }
  }
}
