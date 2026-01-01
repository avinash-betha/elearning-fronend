import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface ProjectAttachment {
  id?: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface ProjectRubricItem {
  criterion: string;
  maxScore: number;
  score?: number;
  notes?: string;
}

export interface ProjectSubmission {
  id: string;
  courseId: string;
  email: string;
  name: string;
  title: string;
  description: string;
  attachments: ProjectAttachment[];
  status: 'submitted' | 'in_review' | 'approved' | 'needs_changes';
  submittedAtIso: string;
  reviewedAtIso?: string;
  rubric: ProjectRubricItem[];
  instructorNotes?: string;
}

@Injectable({ providedIn: 'root' })
export class CourseProjectsService {
  constructor(private http: HttpClient) {}

  async submit(input: { courseId: string; title: string; description: string; attachments: ProjectAttachment[] }): Promise<ProjectSubmission> {
    const id = String(input.courseId || '').trim();
    return firstValueFrom(
      this.http.post<ProjectSubmission>(`${API_BASE_URL}/projects/${id}`, {
        title: input.title,
        description: input.description,
        attachments: input.attachments
      })
    );
  }

  async getMine(courseId: string): Promise<ProjectSubmission | null> {
    const id = String(courseId || '').trim();
    return firstValueFrom(this.http.get<ProjectSubmission>(`${API_BASE_URL}/projects/${id}/me`));
  }

  async listByCourse(courseId: string): Promise<ProjectSubmission[]> {
    const id = String(courseId || '').trim();
    return firstValueFrom(this.http.get<ProjectSubmission[]>(`${API_BASE_URL}/instructor/projects/${id}`));
  }

  async review(input: { submissionId: string; status: ProjectSubmission['status']; rubric: ProjectRubricItem[]; instructorNotes?: string }): Promise<ProjectSubmission> {
    const id = String(input.submissionId || '').trim();
    return firstValueFrom(
      this.http.put<ProjectSubmission>(`${API_BASE_URL}/instructor/projects/${id}/review`, {
        status: input.status,
        rubric: input.rubric,
        instructorNotes: input.instructorNotes
      })
    );
  }
}
