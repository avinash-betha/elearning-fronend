import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { CourseProgressService } from '../../services/course-progress.service';
import { CourseService } from '../../services/course.service';
import { CurrencyService } from '../../services/currency.service';
import { EnrollmentRecord, EnrollmentService } from '../../services/enrollment.service';
import { CertificateService } from '../../services/certificate.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-enrolled-courses',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './enrolled-courses.html',
  styleUrls: ['./enrolled-courses.css']
})
export class EnrolledCourses implements OnInit {
  isLoggedIn = false;
  email = '';

  enrolledCourses: Array<{
    id: string;
    title: string;
    instructor: string;
    progress: number;
    completedLessons: number;
    totalLessons: number;
    timeSpentHours: number;
    enrolledAtIso: string;
    isCompleted: boolean;
    hasCertificate: boolean;
    certificateId: string;
  }> = [];

  recommendedCourses: Array<{ id: string; title: string; instructor: string; isFree: boolean; priceLabel: string }> = [];
  hasMoreRecommended = false;

  // Temporary curriculum sizing until backend provides per-course lesson counts.
  private readonly estimatedTotalLessons = 7;

  constructor(
    private router: Router,
    private auth: AuthService,
    private enrollments: EnrollmentService,
    private courses: CourseService,
    private progress: CourseProgressService,
    private cart: CartService,
    private currency: CurrencyService,
    private certificates: CertificateService,
    private toast: ToastService
  ) {}

  async ngOnInit(): Promise<void> {
    this.isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const user = this.auth.getCurrentUser();
    this.email = user?.email || '';
    await this.load();
  }

  private async load(): Promise<void> {
    if (!this.email) {
      this.enrolledCourses = [];
      this.recommendedCourses = [];
      this.hasMoreRecommended = false;
      return;
    }

    const records: EnrollmentRecord[] = await this.enrollments.listByEmail();
    const enrolledIds = new Set(records.map((r) => String(r.courseId)));
    const rows = await Promise.all(records.map(async (r) => {
        const course = await this.courses.getById(r.courseId);
        const title = course?.title || `Course #${r.courseId}`;
        const instructor = course?.instructorName || 'Instructor';

        const cp = await this.progress.getCourseProgress(String(r.courseId));
        const lessonValues = Object.values(cp.lessons || {});
        const completedLessons = lessonValues.filter((l) => l.completed).length;
        const watchedSeconds = lessonValues.reduce((sum, l) => sum + (Number(l.watchedSeconds) || 0), 0);

        const totalLessons = await this.resolveTotalLessons(String(r.courseId), lessonValues.length);
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        const timeSpentHours = Math.round((watchedSeconds / 3600) * 10) / 10;
        const isCompleted = totalLessons > 0 && completedLessons >= totalLessons;
        const cert = await this.certificates.getByCourse(this.email, String(r.courseId));

        return {
          id: String(r.courseId),
          title,
          instructor,
          progress: Math.min(100, Math.max(0, progress)),
          completedLessons,
          totalLessons,
          timeSpentHours,
          enrolledAtIso: r.enrolledAtIso,
          isCompleted,
          hasCertificate: !!cert,
          certificateId: cert?.id || ''
        };
      }));

    rows.sort((a, b) => (a.enrolledAtIso < b.enrolledAtIso ? 1 : -1));

    this.enrolledCourses = rows;

    const all = (await this.courses.listAllCourses())
      .filter((c) => c.status === 'approved')
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
        priceLabel
      };
    });
  }

  continueCourse(course: { id: string }) {
    if (!course?.id) return;
    localStorage.setItem('activeCourseId', String(course.id));
    this.router.navigate(['/course-content'], { queryParams: { courseId: course.id } });
  }

  takeFinalExam(course: { id: string }, event?: Event): void {
    event?.stopPropagation();
    if (!course?.id) return;
    this.router.navigate(['/exam', course.id]);
  }

  viewCertificate(course: { certificateId: string }, event?: Event): void {
    event?.stopPropagation();
    if (!course?.certificateId) return;
    this.router.navigate(['/verify-certificate', course.certificateId]);
  }

  openCourse(courseId: string): void {
    const id = String(courseId || '').trim();
    if (!id) return;
    this.router.navigate(['/courses', id]);
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

  private async resolveTotalLessons(courseId: string, fallback: number): Promise<number> {
    try {
      const sections = await this.courses.getCurriculum(courseId);
      const total = sections.reduce((sum: number, s) => sum + (s.lectures?.length || 0), 0);
      if (total > 0) return total;
    } catch {
      // Ignore curriculum lookup errors; fall back to progress-based estimate.
    }
    return fallback > 0 ? fallback : this.estimatedTotalLessons;
  }
}
