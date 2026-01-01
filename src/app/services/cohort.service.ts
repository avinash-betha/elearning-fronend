import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface CohortSession {
  id: string;
  title: string;
  startsAtIso: string;
  durationMinutes: number;
  hostName: string;
}

export interface CohortPostAttachment {
  id?: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface CohortPost {
  id: string;
  authorEmail: string;
  authorName: string;
  message: string;
  createdAtIso: string;
  attachments: CohortPostAttachment[];
  reactions: Record<'support' | 'insight' | 'celebrate', string[]>;
}

export interface CohortRecord {
  id: string;
  courseId: string;
  cohortName: string;
  membersCount: number;
  sessions: CohortSession[];
  posts: CohortPost[];
}

@Injectable({ providedIn: 'root' })
export class CohortService {
  constructor(private http: HttpClient) {}

  async getCohort(courseId: string): Promise<CohortRecord> {
    const id = String(courseId || '').trim();
    return firstValueFrom(this.http.get<CohortRecord>(`${API_BASE_URL}/cohorts/${id}`));
  }

  async addPost(input: { courseId: string; message: string; attachments: CohortPostAttachment[] }): Promise<CohortRecord> {
    const id = String(input.courseId || '').trim();
    return firstValueFrom(
      this.http.post<CohortRecord>(`${API_BASE_URL}/cohorts/${id}/posts`, {
        message: input.message,
        attachments: input.attachments
      })
    );
  }

  async toggleReaction(input: { courseId: string; postId: string; type: 'support' | 'insight' | 'celebrate' }): Promise<CohortRecord> {
    const courseId = String(input.courseId || '').trim();
    const postId = String(input.postId || '').trim();
    return firstValueFrom(
      this.http.post<CohortRecord>(`${API_BASE_URL}/cohorts/${courseId}/posts/${postId}/reactions`, {
        type: input.type
      })
    );
  }
}
