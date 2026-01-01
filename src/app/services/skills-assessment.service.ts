import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface SkillsTestQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  tags: string[];
}

export interface SkillsAssessment {
  courseId: string;
  preTest: SkillsTestQuestion[];
  postTest: SkillsTestQuestion[];
}

export interface SkillsAssessmentRecord {
  id: string;
  courseId: string;
  email: string;
  preScorePercent?: number;
  postScorePercent?: number;
  weakTags: string[];
  recommendations: string[];
  preCompletedAtIso?: string;
  postCompletedAtIso?: string;
}

@Injectable({ providedIn: 'root' })
export class SkillsAssessmentService {
  constructor(private http: HttpClient) {}

  async getAssessment(courseId: string): Promise<SkillsAssessment> {
    const id = String(courseId || '').trim();
    return firstValueFrom(this.http.get<SkillsAssessment>(`${API_BASE_URL}/skills/${id}`));
  }

  async savePreResult(input: { courseId: string; scorePercent: number; weakTags: string[]; recommendations: string[] }): Promise<SkillsAssessmentRecord> {
    const id = String(input.courseId || '').trim();
    return firstValueFrom(
      this.http.post<SkillsAssessmentRecord>(`${API_BASE_URL}/skills/${id}/pre`, {
        scorePercent: input.scorePercent,
        weakTags: input.weakTags,
        recommendations: input.recommendations
      })
    );
  }

  async savePostResult(input: { courseId: string; scorePercent: number }): Promise<SkillsAssessmentRecord> {
    const id = String(input.courseId || '').trim();
    return firstValueFrom(
      this.http.post<SkillsAssessmentRecord>(`${API_BASE_URL}/skills/${id}/post`, {
        scorePercent: input.scorePercent
      })
    );
  }
}
