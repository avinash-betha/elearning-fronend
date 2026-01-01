import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface InstructorApplicationDocument {
  name: string;
  type: string;
  size: number;
}

export interface InstructorApplication {
  id: string;
  email: string;
  name: string;
  highestQualification: string;
  yearsOfExperience: number;
  expertiseAreas: string;
  portfolioUrl?: string;
  documents: InstructorApplicationDocument[];
  status: ApplicationStatus;
  submittedAtIso: string;
  adminNotes?: string;
}

@Injectable({ providedIn: 'root' })
export class InstructorApplicationService {
  constructor(private http: HttpClient) {}

  async submit(input: {
    highestQualification: string;
    yearsOfExperience: number;
    expertiseAreas: string;
    portfolioUrl?: string;
    files: File[];
  }): Promise<InstructorApplication> {
    const documents = (input.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size }));
    return firstValueFrom(
      this.http.post<InstructorApplication>(`${API_BASE_URL}/instructor-applications`, {
        highestQualification: input.highestQualification,
        yearsOfExperience: input.yearsOfExperience,
        expertiseAreas: input.expertiseAreas,
        portfolioUrl: input.portfolioUrl,
        documents
      })
    );
  }

  async getMine(): Promise<InstructorApplication | null> {
    return firstValueFrom(this.http.get<InstructorApplication>(`${API_BASE_URL}/instructor-applications/me`));
  }

  async listPending(): Promise<InstructorApplication[]> {
    return firstValueFrom(this.http.get<InstructorApplication[]>(`${API_BASE_URL}/admin/instructor-applications`));
  }

  async approve(userId: string, notes?: string): Promise<void> {
    const id = String(userId || '').trim();
    await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/instructor-applications/${id}/approve`, { notes }));
  }

  async reject(userId: string, notes: string): Promise<void> {
    const id = String(userId || '').trim();
    await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/instructor-applications/${id}/reject`, { notes }));
  }
}
