import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { CourseSection, CourseService } from '../../services/course.service';
import { CouponService } from '../../services/coupon.service';
import { EnrollmentService } from '../../services/enrollment.service';
import { PaymentService } from '../../services/payment.service';
import { CommerceEventsService } from '../../services/commerce-events.service';
import { CurrencyService } from '../../services/currency.service';
import { CourseRatingsService, ReviewAttachment, ReviewReactionType } from '../../services/course-ratings.service';

interface CourseModuleView {
  title: string;
  lessons: number;
  duration: string;
  lessonItems: Array<{ title: string; duration: string; isPreview: boolean }>;
}

interface CourseDetailsView {
  id: string;
  title: string;
  subtitle?: string;
  instructor: string;
  instructorEmail?: string;
  rating: number;
  reviews: number;
  students: number;
  description: string;
  learningPoints: string[];
  requirements: string[];
  modules: CourseModuleView[];
  recentReviews: Array<{ student: string; rating: number; comment: string; date: string }>;
  videoHours: number;
  articles: number;
  resources: number;
}

interface PendingAttachment {
  file: File;
  name: string;
  type: string;
  size: number;
  previewUrl: string;
}

@Component({
  selector: 'app-course-details',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './course-details.html',
  styleUrls: ['./course-details.css']
})
export class CourseDetails implements OnInit, OnDestroy {
  courseId: string = '';
  course: CourseDetailsView | null = null;
  expandedModuleIndex: number | null = 0;

  isLoggedIn = false;
  isEnrolled = false;

  showPaymentModal = false;
  paymentMethods: Array<{ id: string; label: string }> = [];
  selectedPaymentMethodId = '';

  payForm = {
    nameOnCard: '',
    cardNumber: '',
    expMonth: 1,
    expYear: new Date().getFullYear() + 1,
    saveMethod: true,
    couponCode: ''
  };

  pricing = {
    isFree: false,
    currency: 'USD',
    priceCents: 0,
    discountedCents: 0,
    appliedCouponCode: ''
  };

  ratingSummary: {
    average: number;
    count: number;
    distribution: Record<number, number>;
  } = {
    average: 0,
    count: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  };

  courseReviews: Array<{
    id: string;
    student: string;
    rating: number;
    comment: string;
    date: string;
    attachments: ReviewAttachment[];
    replies: Array<{ id: string; author: string; body: string; date: string; attachments: ReviewAttachment[] }>;
    reactions: Record<ReviewReactionType, string[]>;
  }> = [];

  ratingForm = {
    rating: 0,
    comment: '',
    attachments: [] as PendingAttachment[]
  };
  ratingError = '';
  ratingInfo = '';
  replyForms: Record<string, { open: boolean; body: string; attachments: PendingAttachment[] }> = {};
  currentUserEmail = '';
  currentUserName = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toast: ToastService,
    private auth: AuthService,
    private cart: CartService,
    private coursesService: CourseService,
    private coupons: CouponService,
    private enrollments: EnrollmentService,
    private payments: PaymentService,
    private commerce: CommerceEventsService,
    private currency: CurrencyService,
    private ratings: CourseRatingsService
  ) {}

  async ngOnInit() {
    this.courseId = this.route.snapshot.paramMap.get('id') || '';
    this.isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const current = this.auth.getCurrentUser();
    this.currentUserEmail = current?.email || '';
    this.currentUserName = current?.name || 'Learner';
    await this.loadCourse();
    if (current?.email) {
      this.isEnrolled = await this.enrollments.isEnrolled(current.email, this.courseId);
    }
    await this.refreshRatings();
  }

  ngOnDestroy(): void {
    this.clearPendingAttachments(this.ratingForm.attachments);
    Object.values(this.replyForms).forEach((form) => this.clearPendingAttachments(form.attachments));
  }

  private async loadCourse(): Promise<void> {
    const course = await this.coursesService.getById(this.courseId);
    if (!course) return;
    const curriculum = await this.coursesService.getCurriculum(this.courseId).catch(() => []);
    const modules = curriculum.length ? this.mapCurriculum(curriculum) : [];
    const counts = curriculum.length ? this.getMediaCounts(curriculum) : { videoHours: 0, articles: 0, resources: 0 };

    this.course = {
      id: String(course.id),
      title: course.title,
      subtitle: course.subtitle || '',
      instructor: course.instructorName || 'Instructor',
      instructorEmail: course.instructorEmail || '',
      rating: 0,
      reviews: 0,
      students: 0,
      description: course.description || '',
      learningPoints: course.learningPoints || [],
      requirements: course.requirements || [],
      modules,
      recentReviews: [],
      videoHours: counts.videoHours,
      articles: counts.articles,
      resources: counts.resources
    };

    this.pricing.isFree = !!course.isFree;
    this.pricing.currency = course.currency || 'USD';
    this.pricing.priceCents = Math.max(0, course.priceCents || 0);
    this.pricing.discountedCents = this.pricing.priceCents;
    this.pricing.appliedCouponCode = '';
  }

  private mapCurriculum(curriculum: CourseSection[]): CourseModuleView[] {
    return curriculum.map((s) => {
      const lectures = Array.isArray(s.lectures) ? s.lectures : [];
      const lessonItems = lectures.map((l) => ({
        title: String(l.title || 'Lesson'),
        duration: String(l.duration || '--'),
        isPreview: !!l.isFree
      }));

      return {
        title: String(s.sectionTitle || 'Section'),
        lessons: lessonItems.length,
        duration: this.estimateSectionDuration(lectures.map((l) => String(l.duration || ''))),
        lessonItems
      };
    });
  }

  private estimateSectionDuration(durations: string[]): string {
    const totalMinutes = durations.reduce((sum, d) => sum + this.parseDurationMinutes(d), 0);
    if (!totalMinutes) return 'Self-paced';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    if (hours <= 0) return `${minutes}m`;
    if (!minutes) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  private parseDurationMinutes(input: string): number {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) return 0;

    if (/^\d+:\d+$/.test(raw)) {
      const [mm, ss] = raw.split(':').map((n) => Number(n));
      if (Number.isFinite(mm)) return mm + Math.round((Number(ss) || 0) / 60);
    }

    const hMatch = raw.match(/(\d+)\s*h/);
    const mMatch = raw.match(/(\d+)\s*m/);
    const hours = hMatch ? Number(hMatch[1]) : 0;
    const mins = mMatch ? Number(mMatch[1]) : 0;
    if (hours || mins) return hours * 60 + mins;

    const numeric = Number(raw.replace(/[^0-9.]/g, ''));
    return Number.isFinite(numeric) ? Math.round(numeric) : 0;
  }

  private getMediaCounts(curriculum: CourseSection[]): { videoHours: number; articles: number; resources: number } {
    let videoMinutes = 0;
    let articles = 0;
    let resources = 0;

    for (const section of curriculum) {
      for (const lecture of section.lectures || []) {
        if (lecture.type === 'video') {
          videoMinutes += this.parseDurationMinutes(String(lecture.duration || ''));
        } else if (lecture.type === 'article') {
          articles += 1;
        } else if (lecture.type === 'resource') {
          resources += 1;
        }
      }
    }

    return {
      videoHours: videoMinutes > 0 ? Math.max(1, Math.round(videoMinutes / 60)) : 0,
      articles,
      resources
    };
  }

  private async refreshRatings(): Promise<void> {
    this.ratingSummary = await this.ratings.getSummary(this.courseId);
    const all = await this.ratings.listForCourse(this.courseId);
    this.courseReviews = all.map((r) => ({
      id: r.id,
      student: r.name || r.email,
      rating: r.rating,
      comment: r.comment || 'No comment',
      date: new Date(r.updatedAtIso).toLocaleDateString(),
      attachments: r.attachments || [],
      replies: (r.replies || []).map((reply) => ({
        id: reply.id,
        author: reply.authorName,
        body: reply.body,
        date: new Date(reply.createdAtIso).toLocaleDateString(),
        attachments: reply.attachments || []
      })),
      reactions: r.reactions || { helpful: [], insightful: [], love: [] }
    }));

    if (this.course && this.ratingSummary.count > 0) {
      this.course = {
        ...this.course,
        rating: this.ratingSummary.average,
        reviews: this.ratingSummary.count
      };
    }
  }

  setRating(value: number): void {
    this.ratingForm.rating = value;
  }

  async submitRating(): Promise<void> {
    this.ratingError = '';
    this.ratingInfo = '';

    const current = this.auth.getCurrentUser();
    if (!current?.email) {
      this.ratingError = 'Login required to rate this course.';
      return;
    }
    if (!this.isEnrolled) {
      this.ratingError = 'Only enrolled learners can rate this course.';
      return;
    }

    try {
      await this.ratings.submit({
        courseId: this.courseId,
        rating: this.ratingForm.rating,
        comment: this.ratingForm.comment,
        attachments: this.ratingForm.attachments.map((att) => att.file)
      });
      this.ratingInfo = 'Thanks for your feedback!';
      this.clearPendingAttachments(this.ratingForm.attachments);
      this.ratingForm.attachments = [];
      await this.refreshRatings();
    } catch (e: any) {
      this.ratingError = e?.message || 'Could not save rating';
    }
  }

  async onReviewFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    const attachments = this.readAttachments(files);
    this.ratingForm.attachments = [...this.ratingForm.attachments, ...attachments];
    input.value = '';
  }

  removeReviewAttachment(index: number): void {
    const [removed] = this.ratingForm.attachments.splice(index, 1);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
  }

  toggleReplyForm(reviewId: string): void {
    const existing = this.replyForms[reviewId] || { open: false, body: '', attachments: [] };
    this.replyForms[reviewId] = { ...existing, open: !existing.open };
  }

  async onReplyFilesSelected(reviewId: string, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    const attachments = this.readAttachments(files);
    const existing = this.replyForms[reviewId] || { open: true, body: '', attachments: [] };
    this.replyForms[reviewId] = { ...existing, attachments: [...existing.attachments, ...attachments] };
    input.value = '';
  }

  removeReplyAttachment(reviewId: string, index: number): void {
    const existing = this.replyForms[reviewId];
    if (!existing) return;
    const [removed] = existing.attachments.splice(index, 1);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
  }

  async submitReply(reviewId: string): Promise<void> {
    const current = this.auth.getCurrentUser();
    if (!current?.email) {
      this.toast.info('Login required', 'Please login to reply to reviews.');
      return;
    }

    const form = this.replyForms[reviewId];
    if (!form?.body?.trim()) {
      this.toast.info('Reply required', 'Write a reply before submitting.');
      return;
    }

    try {
      await this.ratings.addReply({
        courseId: this.courseId,
        ratingId: reviewId,
        body: form.body,
        attachments: form.attachments.map((att) => att.file)
      });
      this.clearPendingAttachments(form.attachments);
      this.replyForms[reviewId] = { open: false, body: '', attachments: [] };
      await this.refreshRatings();
    } catch (e: any) {
      this.toast.error('Reply failed', e?.message || 'Please try again');
    }
  }

  async toggleReaction(reviewId: string, type: ReviewReactionType): Promise<void> {
    const current = this.auth.getCurrentUser();
    if (!current?.email) {
      this.toast.info('Login required', 'Please login to react.');
      return;
    }
    try {
      await this.ratings.toggleReaction({
        courseId: this.courseId,
        ratingId: reviewId,
        type
      });
      await this.refreshRatings();
    } catch (e: any) {
      this.toast.error('Reaction failed', e?.message || 'Please try again');
    }
  }

  hasReacted(review: { reactions: Record<ReviewReactionType, string[]> }, type: ReviewReactionType): boolean {
    if (!this.currentUserEmail) return false;
    return (review.reactions?.[type] || []).includes(this.currentUserEmail.toLowerCase());
  }

  reactionCount(review: { reactions: Record<ReviewReactionType, string[]> }, type: ReviewReactionType): number {
    return (review.reactions?.[type] || []).length;
  }

  private readAttachments(files: FileList): PendingAttachment[] {
    return Array.from(files).map((file) => ({
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl: URL.createObjectURL(file)
    }));
  }

  private clearPendingAttachments(list: PendingAttachment[]): void {
    for (const att of list) {
      if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
    }
  }

  getRatingPercent(star: number): number {
    const total = this.ratingSummary.count || 0;
    if (!total) return 0;
    const count = this.ratingSummary.distribution[star] || 0;
    return Math.round((count / total) * 100);
  }

  get priceLabel(): string {
    if (this.pricing.isFree || this.pricing.priceCents === 0) return 'Free';
    return this.currency.formatMoney(this.pricing.priceCents, this.pricing.currency);
  }

  get discountedPriceLabel(): string {
    if (this.pricing.discountedCents === 0) return 'Free';
    return this.currency.formatMoney(this.pricing.discountedCents, this.pricing.currency);
  }

  toggleModule(index: number): void {
    this.expandedModuleIndex = this.expandedModuleIndex === index ? null : index;
  }

  startLesson(isPreview: boolean): void {
    const courseId = this.courseId || '1';
    localStorage.setItem('activeCourseId', courseId);
    this.router.navigate(['/course-content'], { queryParams: { courseId, preview: isPreview ? '1' : '0' } });
  }

  openSkillsPath(): void {
    const courseId = this.courseId || '1';
    const current = this.auth.getCurrentUser();
    if (!current?.email) {
      this.toast.info('Login required', 'Please login to access the skills path.');
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/skills-path/${courseId}` } });
      return;
    }
    if (!this.isEnrolled) {
      this.toast.info('Enroll required', 'Enroll to unlock the skills path.');
      return;
    }
    this.router.navigate(['/skills-path', courseId]);
  }

  openProject(): void {
    const courseId = this.courseId || '1';
    const current = this.auth.getCurrentUser();
    if (!current?.email) {
      this.toast.info('Login required', 'Please login to submit the project.');
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/course-project/${courseId}` } });
      return;
    }
    if (!this.isEnrolled) {
      this.toast.info('Enroll required', 'Enroll to submit the completion project.');
      return;
    }
    this.router.navigate(['/course-project', courseId]);
  }

  openCohort(): void {
    const courseId = this.courseId || '1';
    const current = this.auth.getCurrentUser();
    if (!current?.email) {
      this.toast.info('Login required', 'Please login to join the cohort.');
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/cohort/${courseId}` } });
      return;
    }
    if (!this.isEnrolled) {
      this.toast.info('Enroll required', 'Enroll to join the cohort.');
      return;
    }
    this.router.navigate(['/cohort', courseId]);
  }

  async enrollNow(): Promise<void> {
    const courseId = this.courseId || '1';
    localStorage.setItem('activeCourseId', courseId);

    const current = this.auth.getCurrentUser();
    if (!current?.email) {
      this.toast.info('Login required', 'Please login to enroll');
      this.router.navigate(['/login']);
      return;
    }

    if (await this.enrollments.isEnrolled(current.email, courseId)) {
      this.toast.success('Already enrolled');
      this.router.navigate(['/course-content'], { queryParams: { courseId } });
      return;
    }

    if (this.pricing.isFree || this.pricing.priceCents === 0) {
      await this.enrollments.enroll({ courseId });

      this.commerce.recordCoursePurchase({
        actor: {
          userId: current.id,
          email: current.email,
          role: current.role,
          name: current.name
        },
        source: 'course-details',
        amountCents: 0,
        currency: this.pricing.currency,
        items: [
          {
            courseId: String(courseId),
            title: this.course?.title,
            basePriceCents: this.pricing.priceCents,
            finalPriceCents: 0,
            currency: this.pricing.currency
          }
        ],
        metadata: {
          reason: 'free'
        }
      });

      this.isEnrolled = true;
      this.toast.success('Enrolled', 'You can start learning now');
      this.router.navigate(['/course-content'], { queryParams: { courseId } });
      return;
    }

    this.openPaymentModal();
  }

  async addToCart(): Promise<void> {
    const courseId = this.courseId || '1';
    const current = this.auth.getCurrentUser();
    if (!current?.email) {
      this.toast.info('Login required', 'Please login to add items to your cart');
      this.router.navigate(['/login']);
      return;
    }
    try {
      const res = await this.cart.add(courseId);
      if (res.added) {
        this.toast.success('Added to cart');
      } else {
        this.toast.info('Already in cart');
      }
    } catch (e: any) {
      this.toast.error('Failed', e?.message || 'Unable to add to cart');
    }
  }

  async openPaymentModal(): Promise<void> {
    const methods = await this.payments.listMethods();
    this.paymentMethods = methods.map((m) => ({
      id: m.id,
      label: `${m.brand} **** ${m.last4} (exp ${m.expMonth}/${m.expYear})`
    }));
    this.selectedPaymentMethodId = this.paymentMethods[0]?.id || '';
    this.payForm.couponCode = '';
    this.pricing.discountedCents = this.pricing.priceCents;
    this.pricing.appliedCouponCode = '';
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
  }

  async applyCoupon(): Promise<void> {
    const current = this.auth.getCurrentUser();
    if (!current?.email) return;

    const code = String(this.payForm.couponCode || '').trim();
    if (!code) {
      this.toast.info('Enter a coupon code');
      return;
    }

    const res = await this.coupons.validateForUser(code, this.courseId, current.email);
    if (!res.ok || !res.coupon) {
      this.toast.error('Invalid coupon', res.error || 'Not applicable');
      return;
    }

    const coupon = res.coupon;
    let discounted = this.pricing.priceCents;
    if (coupon.discountType === 'percent') {
      discounted = Math.round(discounted * (1 - coupon.value / 100));
    } else {
      discounted = Math.max(0, discounted - Math.round(coupon.value * 100));
    }

    this.pricing.discountedCents = discounted;
    this.pricing.appliedCouponCode = coupon.code;
    this.toast.success('Coupon applied');
  }

  async confirmPaymentAndEnroll(): Promise<void> {
    const current = this.auth.getCurrentUser();
    if (!current?.email) return;

    try {
      let methodId = this.selectedPaymentMethodId;
      if (!methodId) {
        const created = await this.payments.addCardMethod({
          nameOnCard: this.payForm.nameOnCard,
          cardNumber: this.payForm.cardNumber,
          expMonth: Number(this.payForm.expMonth),
          expYear: Number(this.payForm.expYear)
        });
        methodId = created.id;
      }

      const payment = await this.payments.createPayment({
        amountCents: this.pricing.discountedCents,
        currency: this.pricing.currency,
        methodId,
        description: `Course enrollment: ${this.course?.title || 'Course'}`,
        metadata: {
          courseId: this.courseId,
          coupon: this.pricing.appliedCouponCode || ''
        }
      });

      if (this.pricing.appliedCouponCode) {
        await this.coupons.redeem(this.pricing.appliedCouponCode);
      }

      await this.enrollments.enroll({ courseId: this.courseId });

      this.commerce.recordCoursePurchase({
        actor: {
          userId: current.id,
          email: current.email,
          role: current.role,
          name: current.name
        },
        source: 'course-details',
        paymentId: payment.id,
        paymentMethodId: methodId,
        amountCents: this.pricing.discountedCents,
        currency: this.pricing.currency,
        items: [
          {
            courseId: String(this.courseId),
            title: this.course?.title,
            basePriceCents: this.pricing.priceCents,
            finalPriceCents: this.pricing.discountedCents,
            currency: this.pricing.currency,
            couponCode: this.pricing.appliedCouponCode || undefined
          }
        ],
        metadata: {
          paymentStatus: payment.status
        }
      });

      this.isEnrolled = true;
      this.toast.success('Payment successful', 'Enrollment completed');
      this.closePaymentModal();
      this.router.navigate(['/course-content'], { queryParams: { courseId: this.courseId } });
    } catch (e: any) {
      this.toast.error('Payment failed', e?.message || 'Please check your details');
    }
  }
}
