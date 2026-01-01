import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { CourseService } from '../../services/course.service';
import { CourseProgressService } from '../../services/course-progress.service';
import { CurrencyService } from '../../services/currency.service';
import { EnrollmentRecord, EnrollmentService } from '../../services/enrollment.service';
import { LearningStreakService } from '../../services/learning-streak.service';
import { AnnouncementRecord, AnnouncementsService } from '../../services/announcements.service';
import { CertificateRecord, CertificateService } from '../../services/certificate.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit {
  userName = '';

  email = '';
  streakDays = 0;
  enrolledCount = 0;
  completedCount = 0;
  hoursLearned = 0;
  certificatesCount = 0;

  weeklyGoalHours = 6;
  weeklyProgressHours = 0;
  weeklyProgressPercent = 0;

  continueCourses: Array<{ id: string; title: string; instructor: string; progress: number }> = [];
  hasMoreContinue = false;
  primaryCourseId = '';
  primaryCourseTitle = '';

  recommendedCourses: Array<{ id: string; title: string; instructor: string; isFree: boolean; isEnrolled: boolean; priceLabel: string }> = [];
  hasMoreRecommended = false;

  announcements: AnnouncementRecord[] = [];
  unreadAnnouncementsCount = 0;
  certificates: CertificateRecord[] = [];

  private readonly estimatedTotalLessons = 7;

  constructor(
    private router: Router,
    private auth: AuthService,
    private enrollments: EnrollmentService,
    private progress: CourseProgressService,
    private courses: CourseService,
    private cart: CartService,
    private currency: CurrencyService,
    private streak: LearningStreakService,
    private announcementsService: AnnouncementsService,
    private certificatesService: CertificateService,
    private toast: ToastService
  ) {}

  async ngOnInit(): Promise<void> {
    this.userName = localStorage.getItem('userName') || 'Student';
    this.email = this.auth.getCurrentUser()?.email || '';

    this.loadWeeklyGoal();

    if (this.email) {
      try {
        this.streakDays = this.streak.touch(this.email).streakDays;
      } catch {
        this.streakDays = this.streak.getStreak(this.email).streakDays;
      }
    }

    await this.refreshContinueLearning();
    await this.refreshRecommended();
    await this.refreshAnnouncements();
    await this.refreshCertificates();
    await this.refreshStats();
  }

  private async refreshAnnouncements(): Promise<void> {
    const enrolledCourseIds = this.email ? (await this.enrollments.listByEmail()).map((r) => String(r.courseId)) : [];
    const userKey = this.email || 'anonymous';

    const res = await this.announcementsService.listForUser({
      userKey,
      userRole: 'student',
      enrolledCourseIds
    });

    this.announcements = res.announcements.slice(0, 4);
    this.unreadAnnouncementsCount = res.unreadCount;
  }

  async markAnnouncementRead(announcementId: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!announcementId) return;
    const userKey = this.email || 'anonymous';
    await this.announcementsService.markRead(userKey, announcementId);
    await this.refreshAnnouncements();
  }

  private async refreshContinueLearning(): Promise<void> {
    if (!this.email) {
      this.continueCourses = [];
      this.hasMoreContinue = false;
      return;
    }

    const records: EnrollmentRecord[] = await this.enrollments.listByEmail();
    const rows = await Promise.all(records.map(async (r) => {
      const course = await this.courses.getById(r.courseId);
      const title = course?.title || `Course #${r.courseId}`;
      const instructor = course?.instructorName || 'Instructor';

      const cp = await this.progress.getCourseProgress(String(r.courseId));
      const lessonValues = Object.values(cp.lessons || {});
      const completedLessons = lessonValues.filter((l) => l.completed).length;
      const progressPct = this.estimatedTotalLessons > 0 ? Math.round((completedLessons / this.estimatedTotalLessons) * 100) : 0;

      return {
        id: String(r.courseId),
        title,
        instructor,
        progress: Math.min(100, Math.max(0, progressPct)),
        enrolledAtIso: r.enrolledAtIso
      };
    }));

    rows.sort((a, b) => (a.enrolledAtIso < b.enrolledAtIso ? 1 : -1));

    this.hasMoreContinue = rows.length > 4;
    this.continueCourses = rows.slice(0, 4).map(({ enrolledAtIso: _ignored, ...rest }) => rest);
    this.primaryCourseId = rows[0]?.id || '';
    this.primaryCourseTitle = rows[0]?.title || '';
  }

  private async refreshStats(): Promise<void> {
    if (!this.email) {
      this.enrolledCount = 0;
      this.completedCount = 0;
      this.hoursLearned = 0;
      this.certificatesCount = 0;
      this.weeklyProgressHours = 0;
      this.weeklyProgressPercent = 0;
      return;
    }

    const records = await this.enrollments.listByEmail();
    this.enrolledCount = records.length;

    let watchedSecondsTotal = 0;
    let completedCourses = 0;
    let weeklySeconds = 0;
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;

    for (const r of records) {
      const cp = await this.progress.getCourseProgress(String(r.courseId));
      const lessons = Object.values(cp.lessons || {});
      const totalLessons = this.resolveTotalLessons(lessons.length);
      const completedLessons = lessons.filter((l) => l.completed).length;

      if (totalLessons > 0 && completedLessons >= totalLessons) {
        completedCourses += 1;
      }

      for (const l of lessons) {
        watchedSecondsTotal += Number(l.watchedSeconds) || 0;
        const updatedAt = Date.parse(l.updatedAtIso || '');
        if (!Number.isNaN(updatedAt) && updatedAt >= weekAgo) {
          weeklySeconds += Number(l.watchedSeconds) || 0;
        }
      }
    }

    this.completedCount = completedCourses;
    this.certificatesCount = (await this.certificatesService.listByEmail()).length;
    this.hoursLearned = Math.round((watchedSecondsTotal / 3600) * 10) / 10;

    this.weeklyProgressHours = Math.round((weeklySeconds / 3600) * 10) / 10;
    if (this.weeklyGoalHours > 0) {
      this.weeklyProgressPercent = Math.min(100, Math.round((this.weeklyProgressHours / this.weeklyGoalHours) * 100));
    } else {
      this.weeklyProgressPercent = 0;
    }
  }

  private async refreshCertificates(): Promise<void> {
    if (!this.email) {
      this.certificates = [];
      return;
    }
    this.certificates = (await this.certificatesService.listByEmail())
      .sort((a, b) => (a.issuedAtIso < b.issuedAtIso ? 1 : -1))
      .slice(0, 3);
  }

  viewCertificate(certId: string): void {
    if (!certId) return;
    this.router.navigate(['/verify-certificate', certId]);
  }

  private resolveTotalLessons(fallback: number): number {
    return fallback > 0 ? fallback : this.estimatedTotalLessons;
  }

  private loadWeeklyGoal(): void {
    const raw = localStorage.getItem('weeklyGoalHours');
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) {
      this.weeklyGoalHours = Math.min(40, Math.max(1, Math.floor(value)));
    }
  }

  saveWeeklyGoal(): void {
    const next = Math.min(40, Math.max(1, Math.floor(Number(this.weeklyGoalHours) || 6)));
    this.weeklyGoalHours = next;
    localStorage.setItem('weeklyGoalHours', String(next));
    void this.refreshStats();
  }

  private async refreshRecommended(): Promise<void> {
    const enrolledIds = new Set(
      (this.email ? await this.enrollments.listByEmail() : []).map((r) => String(r.courseId))
    );

    const all = (await this.courses.listAllCourses())
      .filter((c) => c.status === 'approved' || c.status === 'published')
      .filter((c) => !enrolledIds.has(String(c.id)));

    this.hasMoreRecommended = all.length > 4;
    this.recommendedCourses = all.slice(0, 4).map((c) => {
      const isFree = !!c.isFree || (c.priceCents || 0) <= 0;
      const priceLabel = isFree ? 'Free' : this.currency.formatMoney(c.priceCents || 0, c.currency || this.currency.resolveDefaultCurrency());
      return {
        id: String(c.id),
        title: c.title,
        instructor: c.instructorName,
        isFree,
        isEnrolled: false,
        priceLabel
      };
    });
  }

  openCourse(courseId: string): void {
    const id = String(courseId || '').trim();
    if (!id) return;
    this.router.navigate(['/courses', id]);
  }

  continueCourse(courseId: string): void {
    const id = String(courseId || '').trim();
    if (!id) return;
    localStorage.setItem('activeCourseId', id);
    this.router.navigate(['/course-content'], { queryParams: { courseId: id } });
  }

  async addToCart(courseId: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    const id = String(courseId || '').trim();
    if (!id) return;

    if (!this.email) {
      this.toast.info('Sign in required', 'Please login to add items to your cart');
      this.router.navigate(['/login']);
      return;
    }

    try {
      const res = await this.cart.add(id);
      if (res.added) this.toast.success('Added to cart');
      else this.toast.info('Already in cart');
    } catch (e: any) {
      this.toast.error('Could not add to cart', e?.message || 'Please try again');
    }
  }
}
