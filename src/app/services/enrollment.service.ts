import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface EnrollmentRecord {
  id: string;
  email: string;
  courseId: string;
  enrolledAtIso: string;
  paymentId?: string;
  amountCents: number;
  currency: string;
  couponCode?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class EnrollmentService {
  constructor(private http: HttpClient) {}

  async listByEmail(): Promise<EnrollmentRecord[]> {
    return firstValueFrom(this.http.get<EnrollmentRecord[]>(`${API_BASE_URL}/enrollments/me`));
  }

  async isEnrolled(email: string, courseId: string): Promise<boolean> {
    const list = await this.listByEmail();
    const e = String(email || '').trim().toLowerCase();
    const c = String(courseId || '').trim();
    return list.some((r) => String(r.courseId) === c && String(r.email || '').toLowerCase() === e);
  }

  async enroll(input: { courseId: string }): Promise<EnrollmentRecord> {
    return firstValueFrom(this.http.post<EnrollmentRecord>(`${API_BASE_URL}/enrollments`, { courseId: input.courseId }));
  }

  async listByCourse(courseId: string): Promise<EnrollmentRecord[]> {
    const id = String(courseId || '').trim();
    return firstValueFrom(this.http.get<EnrollmentRecord[]>(`${API_BASE_URL}/enrollments/${id}`));
  }

  async revoke(enrollmentId: string): Promise<void> {
    const id = String(enrollmentId || '').trim();
    await firstValueFrom(this.http.delete(`${API_BASE_URL}/enrollments/${id}`));
  }
}
