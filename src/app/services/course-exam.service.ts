import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface ExamQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface FinalExam {
  courseId: string;
  title: string;
  passingScore: number;
  durationMinutes: number;
  questions: ExamQuestion[];
}

@Injectable({ providedIn: 'root' })
export class CourseExamService {
  constructor(private http: HttpClient) {}

  async getExam(courseId: string): Promise<FinalExam> {
    const id = String(courseId || '').trim();
    return firstValueFrom(this.http.get<FinalExam>(`${API_BASE_URL}/exams/${id}`));
  }

  async submitAttempt(courseId: string, input: { answers: Record<string, number> }): Promise<{ scorePercent: number; pass: boolean }> {
    const id = String(courseId || '').trim();
    return firstValueFrom(this.http.post<{ scorePercent: number; pass: boolean }>(`${API_BASE_URL}/exams/${id}/attempts`, input));
  }
}
