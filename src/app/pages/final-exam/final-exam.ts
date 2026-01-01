import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CourseExamService, FinalExam } from '../../services/course-exam.service';
import { CourseProgressService } from '../../services/course-progress.service';
import { CourseService } from '../../services/course.service';
import { EnrollmentService } from '../../services/enrollment.service';
import { CertificateRecord, CertificateService } from '../../services/certificate.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-final-exam',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './final-exam.html',
  styleUrls: ['./final-exam.css']
})
export class FinalExamPage implements OnInit, OnDestroy {
  @ViewChild('proctorVideo') proctorVideo?: ElementRef<HTMLVideoElement>;
  exam: FinalExam | null = null;
  courseTitle = '';
  answers: Record<string, number> = {};
  submitted = false;
  scorePercent = 0;
  pass = false;
  isEligible = false;
  loading = true;
  certificate: CertificateRecord | null = null;
  proctorEnabled = true;
  proctorConsent = false;
  proctorStarted = false;
  proctorWarnings = 0;
  proctorMaxWarnings = 2;
  proctorFlagged = false;
  cameraStream: MediaStream | null = null;
  cameraError = '';
  private visibilityHandler: (() => void) | null = null;
  private blurHandler: (() => void) | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private exams: CourseExamService,
    private progress: CourseProgressService,
    private courses: CourseService,
    private enrollments: EnrollmentService,
    private certificates: CertificateService,
    private toast: ToastService
  ) {}

  async ngOnInit(): Promise<void> {
    const courseId = String(this.route.snapshot.paramMap.get('courseId') || '').trim();
    const user = this.auth.getCurrentUser();
    if (!courseId || !user?.email) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/exam/${courseId}` } });
      return;
    }

    if (!(await this.enrollments.isEnrolled(user.email, courseId))) {
      this.toast.info('Enroll required', 'Complete enrollment to unlock the final exam.');
      this.router.navigate(['/courses', courseId]);
      return;
    }

    const course = await this.courses.getById(courseId);
    this.courseTitle = course?.title || 'Course';
    this.exam = await this.exams.getExam(courseId);
    this.isEligible = await this.isCourseCompleted(courseId);
    this.certificate = await this.certificates.getByCourse(user.email, courseId);
    this.loading = false;
  }

  ngOnDestroy(): void {
    this.stopProctoring();
  }

  private async isCourseCompleted(courseId: string): Promise<boolean> {
    const progress = await this.progress.getCourseProgress(courseId);
    const completedLessons = Object.values(progress.lessons || {}).filter((l) => l.completed).length;
    const totalLessons = Object.values(progress.lessons || {}).length;
    if (totalLessons === 0) return completedLessons > 0;
    return completedLessons >= totalLessons;
  }

  selectAnswer(questionId: string, optionIndex: number): void {
    if (this.submitted) return;
    this.answers[questionId] = optionIndex;
  }

  async submit(): Promise<void> {
    if (!this.exam) return;
    if (this.proctorEnabled && !this.proctorStarted) {
      this.toast.info('Proctoring required', 'Start proctored mode before submitting.');
      return;
    }
    if (this.proctorFlagged) {
      this.toast.error('Exam locked', 'Proctoring flagged too many tab switches. Restart to try again.');
      return;
    }

    const unanswered = this.exam.questions.find((q) => this.answers[q.id] === undefined);
    if (unanswered) {
      this.toast.error('Incomplete', 'Please answer all questions before submitting.');
      return;
    }

    try {
      const result = await this.exams.submitAttempt(this.exam.courseId, { answers: this.answers });
      this.scorePercent = result.scorePercent;
      this.submitted = true;
      this.pass = result.pass;

      const user = this.auth.getCurrentUser();
      if (this.pass && user?.email) {
        this.certificate = await this.certificates.getByCourse(user.email, this.exam.courseId);
      }
    } catch (e: any) {
      this.toast.error('Submission failed', e?.message || 'Please try again');
    }
  }

  openCourse(): void {
    if (!this.exam) return;
    this.router.navigate(['/courses', this.exam.courseId], { fragment: 'reviews' });
  }

  viewCertificate(): void {
    if (!this.certificate) return;
    this.router.navigate(['/verify-certificate', this.certificate.id]);
  }

  handleProctorToggle(): void {
    if (!this.proctorEnabled) {
      this.stopProctoring();
    }
  }

  async startProctoring(): Promise<void> {
    if (!this.proctorConsent) {
      this.toast.info('Consent required', 'Please consent to webcam proctoring.');
      return;
    }
    this.cameraError = '';
    this.proctorWarnings = 0;
    this.proctorFlagged = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError = 'Camera access not supported in this browser.';
      this.toast.error('Unsupported', 'Camera access not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      this.cameraStream = stream;
      const videoEl = this.proctorVideo?.nativeElement;
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.play().catch(() => undefined);
      }
      this.proctorStarted = true;
      this.attachProctorListeners();
    } catch (e: any) {
      this.cameraError = e?.message || 'Unable to access camera.';
      this.toast.error('Camera blocked', 'Allow camera access to continue.');
    }
  }

  stopProctoring(): void {
    this.proctorStarted = false;
    this.detachProctorListeners();
    if (this.cameraStream) {
      for (const track of this.cameraStream.getTracks()) {
        track.stop();
      }
      this.cameraStream = null;
    }
    const videoEl = this.proctorVideo?.nativeElement;
    if (videoEl) {
      videoEl.srcObject = null;
    }
  }

  private attachProctorListeners(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState !== 'visible') {
        this.recordProctorWarning();
      }
    };
    this.blurHandler = () => this.recordProctorWarning();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('blur', this.blurHandler);
  }

  private detachProctorListeners(): void {
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.blurHandler) window.removeEventListener('blur', this.blurHandler);
    this.visibilityHandler = null;
    this.blurHandler = null;
  }

  private recordProctorWarning(): void {
    if (!this.proctorStarted || this.proctorFlagged) return;
    this.proctorWarnings += 1;
    if (this.proctorWarnings > this.proctorMaxWarnings) {
      this.proctorFlagged = true;
      this.toast.error('Exam locked', 'Too many tab switches detected.');
      this.stopProctoring();
      return;
    }
    this.toast.info('Tab switch detected', `Warning ${this.proctorWarnings}/${this.proctorMaxWarnings + 1}`);
  }
}
