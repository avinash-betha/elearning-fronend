import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppCourse, CourseService } from '../../services/course.service';
import { EnrollmentRecord, EnrollmentService } from '../../services/enrollment.service';
import { CurrencyService } from '../../services/currency.service';
import { ExportRow, ExportService } from '../../services/export.service';
import { ToastService } from '../../services/toast.service';
import { AnnouncementAudience, AnnouncementsService } from '../../services/announcements.service';
import { CourseRatingsService } from '../../services/course-ratings.service';
import { AuthService } from '../../services/auth.service';

interface InstructorCourseRow {
  course: AppCourse;
  students: number;
  revenueCents: number;
  revenueLabel: string;
}

@Component({
  selector: 'app-instructor-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './instructor-dashboard.html',
  styleUrls: ['./instructor-dashboard.css']
})
export class InstructorDashboard implements OnInit {
  userName = '';
  userEmail = '';

  showAnalyticsModal = false;
  analyticsCourse: InstructorCourseRow | null = null;

  myCourses: InstructorCourseRow[] = [];
  myCourseOptions: Array<{ id: string; title: string }> = [];

  totalCourses = 0;
  totalStudents = 0;
  totalRevenueLabel = '$0.00';
  averageRatingLabel = "-";

  announcementForm: {
    title: string;
    body: string;
    audience: AnnouncementAudience;
    courseId: string;
    pinned: boolean;
  } = {
    title: '',
    body: '',
    audience: 'students',
    courseId: '',
    pinned: false
  };

  constructor(
    private router: Router,
    private auth: AuthService,
    private courseService: CourseService,
    private enrollments: EnrollmentService,
    private currency: CurrencyService,
    private exportService: ExportService,
    private toast: ToastService,
    private announcements: AnnouncementsService,
    private ratings: CourseRatingsService
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await this.auth.fetchCurrentUser();
    this.userName = user?.name || localStorage.getItem('userName') || 'Instructor';
    this.userEmail = (user?.email || localStorage.getItem('userEmail') || '').trim().toLowerCase();

    await this.refreshCourses();
  }

  private async refreshCourses(): Promise<void> {
    const mine = this.userEmail ? await this.courseService.listCreatedByInstructor(this.userEmail) : [];

    const enrollmentLists = await Promise.all(mine.map((c) => this.enrollments.listByCourse(String(c.id))));
    const rows: InstructorCourseRow[] = mine.map((c, idx) => {
      const es = enrollmentLists[idx] || [];
      const students = es.length;
      const revenueCents = es.reduce((sum, r) => sum + Math.max(0, Math.floor(r.amountCents || 0)), 0);
      return {
        course: c,
        students,
        revenueCents,
        revenueLabel: this.currency.formatMoney(revenueCents, c.currency)
      };
    });

    this.myCourses = rows;
    this.myCourseOptions = rows.map((r) => ({ id: String(r.course.id), title: r.course.title }));
    this.totalCourses = rows.length;
    this.totalStudents = rows.reduce((sum, r) => sum + r.students, 0);

    const totalRevenueCents = rows.reduce((sum, r) => sum + r.revenueCents, 0);
    this.totalRevenueLabel = this.currency.formatMoney(totalRevenueCents, this.currency.resolveDefaultCurrency());

    let weightedSum = 0;
    let totalReviews = 0;
    for (const row of rows) {
      const summary = await this.ratings.getSummary(String(row.course.id));
      if (summary.count > 0) {
        weightedSum += summary.average * summary.count;
        totalReviews += summary.count;
      }
    }
    this.averageRatingLabel = totalReviews > 0 ? (Math.round((weightedSum / totalReviews) * 10) / 10).toFixed(1) : '-';

    await this.refreshReviews(rows.map((r) => r.course));
  }

  async postAnnouncement(): Promise<void> {
    if (!this.userEmail) {
      this.toast.error('Not signed in', 'Please sign in as an instructor');
      return;
    }

    if (this.announcementForm.audience !== 'students') {
      this.toast.error('Not allowed', 'Instructors can announce to students only');
      this.announcementForm.audience = 'students';
      return;
    }

    try {
      const created = await this.announcements.create({
        title: this.announcementForm.title,
        body: this.announcementForm.body,
        audience: 'students',
        courseId: this.announcementForm.courseId?.trim() ? this.announcementForm.courseId.trim() : undefined,
        pinned: this.announcementForm.pinned
      });

      this.toast.success('Announcement posted', created.title);
      this.announcementForm.title = '';
      this.announcementForm.body = '';
      this.announcementForm.courseId = '';
      this.announcementForm.pinned = false;
    } catch (e: any) {
      this.toast.error('Could not post announcement', e?.message || 'Please try again');
    }
  }

  reviews: Array<{
    student: string;
    courseId: number;
    course: string;
    rating: number;
    comment: string;
    date: string;
  }> = [];

  private async refreshReviews(courses: AppCourse[]): Promise<void> {
    const reviews = await Promise.all(
      courses.map(async (course) => {
        const list = await this.ratings.listForCourse(String(course.id));
        return list.map((r) => ({
          student: r.name || r.email || 'Student',
          courseId: Number(course.id),
          course: course.title,
          rating: r.rating,
          comment: r.comment || '',
          date: new Date(r.createdAtIso).toLocaleDateString()
        }));
      })
    );
    this.reviews = reviews.flat().slice(0, 8);
  }

  openReviewCourse(review: { courseId: number }) {
    if (!review?.courseId) return;
    this.router.navigate(['/courses', review.courseId]);
  }

  createNewCourse() {
    // Navigate to course creation page
    this.router.navigate(['/instructor/create-course']);
  }

  editCourse(row: InstructorCourseRow): void {
    const id = String(row?.course?.id || '').trim();
    if (!id) return;
    this.router.navigate(['/instructor/edit-course', id]);
  }

  async deleteCourse(row: InstructorCourseRow): Promise<void> {
    const id = String(row?.course?.id || '').trim();
    if (!id) return;

    const ok = window.confirm('Delete this course? This cannot be undone.');
    if (!ok) return;

    try {
      await this.courseService.deleteCreatedCourse(id, this.userEmail);
      this.toast.success('Deleted', 'Course removed');
      await this.refreshCourses();
    } catch (e: any) {
      this.toast.error('Delete failed', e?.message || 'Please try again');
    }
  }

  openAnalyticsModal(row: InstructorCourseRow) {
    this.analyticsCourse = row;
    this.showAnalyticsModal = true;
  }

  closeAnalyticsModal() {
    this.showAnalyticsModal = false;
    this.analyticsCourse = null;
  }

  exportMyCoursesCsv(): void {
    try {
      const rows: ExportRow[] = (this.myCourses || []).map((r) => ({
        id: r.course.id,
        title: r.course.title,
        subtitle: r.course.subtitle,
        description: r.course.description,
        category: r.course.category,
        level: r.course.level,
        language: r.course.language,
        status: r.course.status,
        isFree: r.course.isFree,
        priceCents: r.course.priceCents,
        currency: r.course.currency,
        instructorName: r.course.instructorName,
        instructorEmail: r.course.instructorEmail,
        createdAtIso: r.course.createdAtIso,
        previewVideoType: r.course.previewVideoType,
        previewVideoUrl: r.course.previewVideoUrl,
        requirementsCount: (r.course.requirements || []).length,
        learningPointsCount: (r.course.learningPoints || []).length,
        sectionsCount: (r.course.curriculum || []).length,
        students: r.students,
        revenueCents: r.revenueCents
      }));
      this.exportService.exportCsv('my_courses.csv', rows);
      this.toast.success('Export started', 'CSV download generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  async exportMyCoursesExcel(): Promise<void> {
    try {
      const rows: ExportRow[] = (this.myCourses || []).map((r) => ({
        id: r.course.id,
        title: r.course.title,
        subtitle: r.course.subtitle,
        description: r.course.description,
        category: r.course.category,
        level: r.course.level,
        language: r.course.language,
        status: r.course.status,
        isFree: r.course.isFree,
        priceCents: r.course.priceCents,
        currency: r.course.currency,
        createdAtIso: r.course.createdAtIso,
        previewVideoType: r.course.previewVideoType,
        previewVideoUrl: r.course.previewVideoUrl,
        requirementsCount: (r.course.requirements || []).length,
        learningPointsCount: (r.course.learningPoints || []).length,
        sectionsCount: (r.course.curriculum || []).length,
        students: r.students,
        revenueCents: r.revenueCents
      }));
      await this.exportService.exportExcel('my_courses.xlsx', [{ name: 'Courses', rows }]);
      this.toast.success('Export started', 'Excel download generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  async exportMyEnrollmentsCsv(): Promise<void> {
    try {
      const rows = await this.buildMyEnrollmentExportRows();
      this.exportService.exportCsv('my_course_enrollments.csv', rows);
      this.toast.success('Export started', 'CSV download generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  async exportMyEnrollmentsExcel(): Promise<void> {
    try {
      const rows = await this.buildMyEnrollmentExportRows();
      await this.exportService.exportExcel('my_course_enrollments.xlsx', [{ name: 'Enrollments', rows }]);
      this.toast.success('Export started', 'Excel download generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  private async buildMyEnrollmentExportRows(): Promise<ExportRow[]> {
    const myIds = new Set((this.myCourses || []).map((r) => String(r.course.id)));
    const enrollmentLists = await Promise.all(Array.from(myIds).map((id) => this.enrollments.listByCourse(id)));
    const all: EnrollmentRecord[] = enrollmentLists.flat();
    const byCourseId = new Map<string, AppCourse>();
    (this.myCourses || []).forEach((r) => byCourseId.set(String(r.course.id), r.course));

    return all
      .filter((e) => myIds.has(String(e.courseId)))
      .map((e) => {
        const c = byCourseId.get(String(e.courseId));
        return {
          enrollmentId: e.id,
          courseId: e.courseId,
          courseTitle: c?.title,
          studentEmail: e.email,
          enrolledAtIso: e.enrolledAtIso,
          amountCents: e.amountCents,
          currency: e.currency,
          couponCode: e.couponCode,
          paymentId: e.paymentId
        };
      });
  }
}

