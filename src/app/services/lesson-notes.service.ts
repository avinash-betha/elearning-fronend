import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

interface LessonNotesState {
  [lessonId: string]: {
    text: string;
    updatedAtIso: string;
  };
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

@Injectable({ providedIn: 'root' })
export class LessonNotesService {
  constructor(private storage: StorageService) {}

  private key(email: string, courseId: string): string {
    return `lesson_notes_v1:${normalizeEmail(email)}:${String(courseId || '').trim()}`;
  }

  getNote(email: string, courseId: string, lessonId: string): { text: string; updatedAtIso: string | null } {
    const e = normalizeEmail(email);
    const id = String(lessonId || '').trim();
    if (!e || !id) return { text: '', updatedAtIso: null };

    const raw = this.storage.getJson<LessonNotesState>(this.key(e, courseId), {});
    const entry = raw[id];
    return entry ? { text: entry.text || '', updatedAtIso: entry.updatedAtIso || null } : { text: '', updatedAtIso: null };
  }

  saveNote(email: string, courseId: string, lessonId: string, text: string): { text: string; updatedAtIso: string } {
    const e = normalizeEmail(email);
    const id = String(lessonId || '').trim();
    if (!e || !id) throw new Error('Not logged in');

    const key = this.key(e, courseId);
    const raw = this.storage.getJson<LessonNotesState>(key, {});
    const updatedAtIso = new Date().toISOString();

    raw[id] = {
      text: String(text || ''),
      updatedAtIso
    };

    this.storage.setJson(key, raw);
    return { text: raw[id].text, updatedAtIso };
  }
}
