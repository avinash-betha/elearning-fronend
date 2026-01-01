import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface StudyPlanSession {
  id: string;
  title: string;
  description: string;
  focusTag: string;
  completed: boolean;
}

export interface StudyPlan {
  id: string;
  courseId: string;
  email: string;
  createdAtIso: string;
  focusAreas: string[];
  sessions: StudyPlanSession[];
  coachingTips: string[];
}

@Injectable({ providedIn: 'root' })
export class StudyPlanService {
  constructor(private http: HttpClient) {}

  async getPlan(courseId: string): Promise<StudyPlan> {
    const id = String(courseId || '').trim();
    return firstValueFrom(this.http.get<StudyPlan>(`${API_BASE_URL}/study-plans/${id}`));
  }

  async markSessionComplete(planId: string, sessionId: string, completed: boolean): Promise<StudyPlan> {
    const plan = String(planId || '').trim();
    const session = String(sessionId || '').trim();
    return firstValueFrom(
      this.http.put<StudyPlan>(`${API_BASE_URL}/study-plans/${plan}/sessions/${session}`, { completed })
    );
  }
}
