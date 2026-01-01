import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface LessonProgress {
  completed?: boolean;
  watchedSeconds?: number;
  durationSeconds?: number;
  updatedAtIso?: string;
  quizScorePercent?: number;
  quizScoreText?: string;
}

export interface CourseProgress {
  courseId: string;
  percent: number;
  lessons: Record<string, LessonProgress>;
}

@Injectable({ providedIn: 'root' })
export class CourseProgressService {
  constructor(private http: HttpClient) {}

  async getCourseProgress(courseId: string): Promise<CourseProgress> {
    const id = String(courseId || '').trim();
    return firstValueFrom(this.http.get<CourseProgress>(`${API_BASE_URL}/progress/${id}`));
  }

  async getLessonProgress(courseId: string, lessonId: string): Promise<LessonProgress | null> {
    const progress = await this.getCourseProgress(courseId);
    return progress.lessons?.[lessonId] || null;
  }

  async upsertLessonProgress(courseId: string, lessonId: string, patch: LessonProgress): Promise<void> {
    const course = String(courseId || '').trim();
    const lesson = String(lessonId || '').trim();
    await firstValueFrom(
      this.http.put(`${API_BASE_URL}/progress/${course}/lessons/${lesson}`, {
        completed: patch.completed,
        watchedSeconds: patch.watchedSeconds,
        durationSeconds: patch.durationSeconds
      })
    );
  }

  async markLessonCompleted(courseId: string, lessonId: string): Promise<void> {
    await this.upsertLessonProgress(courseId, lessonId, { completed: true });
  }
}
