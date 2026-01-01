import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';

export type CourseStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'published' | 'archived';

export type CoursePreviewVideoType = 'upload' | 'youtube' | 'vimeo' | 'url';

export type CourseLectureType = 'video' | 'article' | 'quiz' | 'resource';
export type CourseLectureContentType = 'upload' | 'youtube' | 'vimeo' | 'url';

export interface CourseLecture {
  id?: string;
  title: string;
  duration?: string;
  type: CourseLectureType;
  contentType: CourseLectureContentType;
  videoUrl?: string;
  articleContent?: string;
  isFree?: boolean;
}

export interface CourseSection {
  id?: string;
  sectionTitle: string;
  lectures: CourseLecture[];
}

export interface AppCourse {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  category: string;
  level?: string;
  language?: string;

  thumbnailDataUrl?: string;
  previewVideoType?: CoursePreviewVideoType;
  previewVideoUrl?: string;

  requirements?: string[];
  learningPoints?: string[];
  curriculum?: CourseSection[];

  instructorName: string;
  instructorEmail: string;

  isFree: boolean;
  priceCents: number;
  currency: string;

  isMandatoryOrg: boolean;

  status: CourseStatus;
  createdAtIso: string;
}

interface CourseListResponse {
  items: AppCourse[];
  page: number;
  size: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CourseService {
  constructor(private http: HttpClient) {}

  async listAllCourses(filters?: { category?: string; search?: string; page?: number; size?: number; sort?: string }): Promise<AppCourse[]> {
    let params = new HttpParams();
    if (filters?.category) params = params.set('category', filters.category);
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.page) params = params.set('page', String(filters.page));
    if (filters?.size) params = params.set('size', String(filters.size));
    if (filters?.sort) params = params.set('sort', filters.sort);
    const res = await firstValueFrom(this.http.get<CourseListResponse>(`${API_BASE_URL}/courses`, { params }));
    return res.items || [];
  }

  async getById(id: string): Promise<AppCourse | null> {
    const key = String(id || '').trim();
    if (!key) return null;
    return firstValueFrom(this.http.get<AppCourse>(`${API_BASE_URL}/courses/${key}`));
  }

  async getCurriculum(courseId: string): Promise<CourseSection[]> {
    const id = String(courseId || '').trim();
    const res = await firstValueFrom(
      this.http.get<{ sections: Array<{ id: string; title: string; lessons: CourseLecture[] }> }>(`${API_BASE_URL}/courses/${id}/curriculum`)
    );
    return (res.sections || []).map((s) => ({
      id: s.id,
      sectionTitle: s.title,
      lectures: s.lessons || []
    }));
  }

  async listCreatedByInstructor(instructorEmail: string): Promise<AppCourse[]> {
    const all = await this.listAllCourses();
    const email = String(instructorEmail || '').trim().toLowerCase();
    return all.filter((c) => String(c.instructorEmail || '').toLowerCase() === email);
  }

  async createCourse(input: {
    title: string;
    subtitle?: string;
    description: string;
    category: string;
    level?: string;
    language?: string;
    thumbnailDataUrl?: string;
    previewVideoType?: CoursePreviewVideoType;
    previewVideoUrl?: string;
    requirements?: string[];
    learningPoints?: string[];
    curriculum?: CourseSection[];
    instructorName: string;
    instructorEmail: string;
    isFree: boolean;
    price: string;
  }): Promise<AppCourse> {
    const payload = {
      title: input.title,
      subtitle: input.subtitle,
      description: input.description,
      category: input.category,
      level: input.level,
      language: input.language,
      thumbnailDataUrl: input.thumbnailDataUrl,
      previewVideoType: input.previewVideoType,
      previewVideoUrl: input.previewVideoUrl,
      requirements: input.requirements,
      learningPoints: input.learningPoints,
      curriculum: input.curriculum,
      instructorName: input.instructorName,
      instructorEmail: input.instructorEmail,
      isFree: input.isFree,
      priceCents: input.isFree ? 0 : this.parsePriceToCents(input.price),
      currency: 'USD'
    };
    return firstValueFrom(this.http.post<AppCourse>(`${API_BASE_URL}/instructor/courses`, payload));
  }

  async updateCreatedCourse(
    courseId: string,
    _actorEmail: string,
    patch: Partial<Pick<
      AppCourse,
      | 'title'
      | 'subtitle'
      | 'description'
      | 'category'
      | 'level'
      | 'language'
      | 'thumbnailDataUrl'
      | 'previewVideoType'
      | 'previewVideoUrl'
      | 'requirements'
      | 'learningPoints'
      | 'curriculum'
      | 'isFree'
      | 'priceCents'
      | 'currency'
      | 'status'
    >> & { price?: string }
  ): Promise<AppCourse> {
    const id = String(courseId || '').trim();
    const payload = {
      ...patch,
      priceCents: patch.isFree ? 0 : patch.priceCents ?? (patch.price ? this.parsePriceToCents(patch.price) : undefined)
    };
    return firstValueFrom(this.http.put<AppCourse>(`${API_BASE_URL}/instructor/courses/${id}`, payload));
  }

  async deleteCreatedCourse(courseId: string, _actorEmail: string): Promise<void> {
    const id = String(courseId || '').trim();
    await firstValueFrom(this.http.delete(`${API_BASE_URL}/instructor/courses/${id}`));
  }

  async submitForReview(courseId: string): Promise<void> {
    const id = String(courseId || '').trim();
    await firstValueFrom(this.http.post(`${API_BASE_URL}/instructor/courses/${id}/submit`, {}));
  }

  setMandatory(_courseId: string, _isMandatoryOrg: boolean): void {
    // Backend endpoint not defined in the contract; no-op for now.
  }

  isMandatory(_courseId: string): boolean {
    return false;
  }

  listMandatoryCourses(): AppCourse[] {
    return [];
  }

  private parsePriceToCents(value: unknown): number {
    const raw = String(value ?? '').trim();
    if (!raw) return 0;
    const numeric = raw.replace(/[^0-9.]/g, '');
    const n = Number(numeric);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }
}
