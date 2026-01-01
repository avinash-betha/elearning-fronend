import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface CourseSubmission {
  courseId: string;
  title: string;
  description?: string;
  instructorName?: string;
  instructorEmail?: string;
  status?: string;
  submittedAtIso?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminCourseSubmissionsService {
  constructor(private http: HttpClient) {}

  async list(): Promise<CourseSubmission[]> {
    const res = await firstValueFrom(this.http.get<CourseSubmission[] | { items: CourseSubmission[] }>(`${API_BASE_URL}/admin/course-submissions`));
    if (Array.isArray(res)) return res;
    return res.items || [];
  }

  async approve(courseId: string, notes?: string): Promise<void> {
    const id = String(courseId || '').trim();
    await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/course-submissions/${id}/approve`, { notes }));
  }

  async reject(courseId: string, notes: string): Promise<void> {
    const id = String(courseId || '').trim();
    await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/course-submissions/${id}/reject`, { notes }));
  }
}
