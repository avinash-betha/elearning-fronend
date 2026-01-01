import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

interface StreakRecord {
  lastActiveDate: string; // YYYY-MM-DD
  streakDays: number;
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function key(email: string): string {
  return `learning_streak_v1_${normalizeEmail(email)}`;
}

function todayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ymdToUtcDate(ymd: string): Date {
  // Parse YYYY-MM-DD as UTC midnight to make day-diff stable across timezones.
  const [yy, mm, dd] = String(ymd).split('-').map((x) => Number(x));
  return new Date(Date.UTC(yy || 1970, (mm || 1) - 1, dd || 1));
}

function dayDiff(aYmd: string, bYmd: string): number {
  const a = ymdToUtcDate(aYmd).getTime();
  const b = ymdToUtcDate(bYmd).getTime();
  const ms = b - a;
  return Math.round(ms / 86400000);
}

@Injectable({ providedIn: 'root' })
export class LearningStreakService {
  constructor(private storage: StorageService) {}

  getStreak(email: string): { streakDays: number; lastActiveDate: string | null } {
    const e = normalizeEmail(email);
    if (!e) return { streakDays: 0, lastActiveDate: null };

    const rec = this.storage.getJson<StreakRecord | null>(key(e), null);
    if (!rec?.lastActiveDate) return { streakDays: 0, lastActiveDate: null };

    const today = todayYmd();
    const diff = dayDiff(rec.lastActiveDate, today);

    // If the user hasn't been active since yesterday, the streak has lapsed.
    if (diff >= 2) return { streakDays: 0, lastActiveDate: rec.lastActiveDate };

    return { streakDays: Math.max(0, Math.floor(rec.streakDays || 0)), lastActiveDate: rec.lastActiveDate };
  }

  touch(email: string): { streakDays: number; lastActiveDate: string } {
    const e = normalizeEmail(email);
    if (!e) throw new Error('Not logged in');

    const today = todayYmd();
    const current = this.storage.getJson<StreakRecord | null>(key(e), null);

    if (!current?.lastActiveDate) {
      const next: StreakRecord = { lastActiveDate: today, streakDays: 1 };
      this.storage.setJson(key(e), next);
      return next;
    }

    const diff = dayDiff(current.lastActiveDate, today);
    if (diff <= 0) {
      // Already counted for today.
      return { lastActiveDate: current.lastActiveDate, streakDays: Math.max(1, current.streakDays || 1) };
    }

    const streakDays = diff === 1 ? Math.max(1, (current.streakDays || 1) + 1) : 1;
    const next: StreakRecord = { lastActiveDate: today, streakDays };
    this.storage.setJson(key(e), next);
    return next;
  }
}
