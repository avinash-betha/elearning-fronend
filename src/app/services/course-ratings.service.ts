import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export type ReviewReactionType = 'helpful' | 'insightful' | 'love';

export interface ReviewAttachment {
  id?: string;
  name: string;
  type: string;
  size?: number;
  url?: string;
  dataUrl?: string;
}

export interface ReviewReply {
  id: string;
  authorEmail: string;
  authorName: string;
  body: string;
  createdAtIso: string;
  attachments?: ReviewAttachment[];
}

export interface CourseRating {
  id: string;
  courseId: string;
  email: string;
  name?: string;
  rating: number;
  comment?: string;
  attachments?: ReviewAttachment[];
  replies?: ReviewReply[];
  reactions?: Record<ReviewReactionType, string[]>;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface CourseRatingSummary {
  average: number;
  count: number;
  distribution: Record<number, number>;
}

@Injectable({ providedIn: 'root' })
export class CourseRatingsService {
  constructor(private http: HttpClient) {}

  async listForCourse(courseId: string): Promise<CourseRating[]> {
    const id = String(courseId || '').trim();
    return firstValueFrom(this.http.get<CourseRating[]>(`${API_BASE_URL}/courses/${id}/reviews`));
  }

  async submit(input: { courseId: string; rating: number; comment?: string; attachments?: File[] }): Promise<CourseRating> {
    const courseId = String(input.courseId || '').trim();
    const form = new FormData();
    form.append('rating', String(input.rating));
    if (input.comment) form.append('comment', input.comment);
    (input.attachments || []).forEach((file) => {
      form.append('attachments', file, file.name);
    });
    return firstValueFrom(this.http.post<CourseRating>(`${API_BASE_URL}/courses/${courseId}/reviews`, form));
  }

  async addReply(input: { courseId: string; ratingId: string; body: string; attachments?: File[] }): Promise<void> {
    const courseId = String(input.courseId || '').trim();
    const ratingId = String(input.ratingId || '').trim();
    const form = new FormData();
    form.append('body', input.body);
    (input.attachments || []).forEach((file) => {
      form.append('attachments', file, file.name);
    });
    await firstValueFrom(this.http.post(`${API_BASE_URL}/courses/${courseId}/reviews/${ratingId}/replies`, form));
  }

  async toggleReaction(input: { courseId: string; ratingId: string; type: ReviewReactionType }): Promise<void> {
    const courseId = String(input.courseId || '').trim();
    const ratingId = String(input.ratingId || '').trim();
    await firstValueFrom(
      this.http.post(`${API_BASE_URL}/courses/${courseId}/reviews/${ratingId}/reactions`, { type: input.type })
    );
  }

  async getSummary(courseId: string): Promise<CourseRatingSummary> {
    const list = await this.listForCourse(courseId);
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of list) {
      const score = Math.max(1, Math.min(5, Math.floor(r.rating || 0)));
      distribution[score] = (distribution[score] || 0) + 1;
      sum += score;
    }
    const count = list.length;
    const average = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
    return { average, count, distribution };
  }
}
