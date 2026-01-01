import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export type AnnouncementAudience = 'all' | 'students' | 'instructors';

export interface AnnouncementRecord {
  id: string;
  title: string;
  body: string;
  audience?: AnnouncementAudience;
  courseId?: string;
  authorName?: string;
  authorRole?: string;
  pinned?: boolean;
  createdAtIso: string;
}

@Injectable({ providedIn: 'root' })
export class AnnouncementsService {
  constructor(private http: HttpClient) {}

  async listForUser(input: { userKey: string; userRole: string; enrolledCourseIds: string[] }): Promise<{ announcements: AnnouncementRecord[]; unreadCount: number }> {
    let params = new HttpParams();
    if (input.userRole) params = params.set('role', input.userRole);
    if (input.enrolledCourseIds?.length) params = params.set('courses', input.enrolledCourseIds.join(','));
    const announcements = await firstValueFrom(this.http.get<AnnouncementRecord[]>(`${API_BASE_URL}/announcements`, { params }));
    return { announcements, unreadCount: 0 };
  }

  async create(input: { title: string; body: string; pinned?: boolean; audience?: AnnouncementAudience; courseId?: string }): Promise<AnnouncementRecord> {
    return firstValueFrom(this.http.post<AnnouncementRecord>(`${API_BASE_URL}/announcements`, input));
  }

  async update(
    id: string,
    input: { title?: string; body?: string; pinned?: boolean; audience?: AnnouncementAudience; courseId?: string }
  ): Promise<AnnouncementRecord> {
    const key = String(id || '').trim();
    return firstValueFrom(this.http.put<AnnouncementRecord>(`${API_BASE_URL}/announcements/${key}`, input));
  }

  async remove(id: string): Promise<void> {
    const key = String(id || '').trim();
    await firstValueFrom(this.http.delete(`${API_BASE_URL}/announcements/${key}`));
  }

  async markRead(_userKey: string, announcementId: string): Promise<void> {
    const id = String(announcementId || '').trim();
    await firstValueFrom(this.http.post(`${API_BASE_URL}/announcements/${id}/read`, {}));
  }
}
