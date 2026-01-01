import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface CertificateRecord {
  id: string;
  courseId: string;
  courseTitle: string;
  userEmail: string;
  userName: string;
  scorePercent: number;
  issuedAtIso: string;
}

@Injectable({ providedIn: 'root' })
export class CertificateService {
  constructor(private http: HttpClient) {}

  async listByEmail(): Promise<CertificateRecord[]> {
    return firstValueFrom(this.http.get<CertificateRecord[]>(`${API_BASE_URL}/certificates/me`));
  }

  async getById(certId: string): Promise<CertificateRecord | null> {
    const id = String(certId || '').trim();
    if (!id) return null;
    return firstValueFrom(this.http.get<CertificateRecord>(`${API_BASE_URL}/certificates/${id}`));
  }

  async getByCourse(email: string, courseId: string): Promise<CertificateRecord | null> {
    const all = await this.listByEmail();
    const e = String(email || '').trim().toLowerCase();
    const c = String(courseId || '').trim();
    return all.find((r) => r.courseId === c && String(r.userEmail || '').toLowerCase() === e) || null;
  }
}
