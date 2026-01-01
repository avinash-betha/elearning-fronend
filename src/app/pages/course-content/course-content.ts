import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { CourseProgressService } from '../../services/course-progress.service';
import { LearningStreakService } from '../../services/learning-streak.service';
import { EnrollmentService } from '../../services/enrollment.service';
import { LessonNotesService } from '../../services/lesson-notes.service';
import { CertificateRecord, CertificateService } from '../../services/certificate.service';
import { StudyPlan, StudyPlanService } from '../../services/study-plan.service';

interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

interface Lesson {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
  active: boolean;
  type: 'video' | 'article' | 'quiz' | 'resource';
  contentType?: 'upload' | 'youtube' | 'vimeo' | 'url';
  videoUrl?: string;
  articleContent?: string;
  isPreview?: boolean;
}

interface Module {
  title: string;
  completedLessons: number;
  totalLessons: number;
  lessons: Lesson[];
}

type LessonTab = 'overview' | 'resources' | 'qa' | 'notes' | 'coach';

@Component({
  selector: 'app-course-content',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './course-content.html',
  styleUrls: ['./course-content.css']
})
export class CourseContent implements OnInit {
  @ViewChild('html5Video') html5Video?: ElementRef<HTMLVideoElement>;
  @ViewChild('embedIframe') embedIframe?: ElementRef<HTMLIFrameElement>;

  currentLesson: Lesson | null = null;
  safeVideoUrl: SafeResourceUrl | null = null;
  selectedTab: LessonTab = 'overview';
  readonly lastUpdatedText = 'Updated 2 weeks ago';

  courseId = '1';
  courseTitle = 'Course';
  isLoggedIn = false;
  isEnrolled = false;
  userEmail = '';
  previewMode = false;
  focusMode = false;

  // Video tracking state
  videoDurationSeconds = 0;
  videoWatchedSeconds = 0;
  canAutoCompleteVideo = false;
  private lastVideoTime = 0;
  private youTubePlayer: any | null = null;
  private vimeoPlayer: any | null = null;
  private pollTimer: number | null = null;
  private visibilityHandler: (() => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private contextMenuHandler: ((e: MouseEvent) => void) | null = null;
  contentProtected = true;
  contentBlurred = false;

  quizQuestions: QuizQuestion[] = [];
  quizAnswers: Record<string, number> = {};
  quizSubmitted = false;
  quizScoreText = '';
  notesText = '';
  notesUpdatedAtIso: string | null = null;
  hasCertificate = false;
  certificate: CertificateRecord | null = null;
  studyPlan: StudyPlan | null = null;

  constructor(
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router,
    private toast: ToastService,
    private auth: AuthService,
    private progress: CourseProgressService,
    private streak: LearningStreakService,
    private enrollments: EnrollmentService,
    private notes: LessonNotesService,
    private certificates: CertificateService,
    private studyPlans: StudyPlanService
  ) {}

  async ngOnInit() {
    this.isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    this.userEmail = this.auth.getCurrentUser()?.email || '';
    this.previewMode = this.route.snapshot.queryParamMap.get('preview') === '1';

    if (this.userEmail) {
      try {
        this.streak.touch(this.userEmail);
      } catch {
        // Non-blocking
      }
    }
    const qpCourseId = this.route.snapshot.queryParamMap.get('courseId');
    const stored = localStorage.getItem('activeCourseId');
    this.courseId = (qpCourseId || stored || '1').toString();
    localStorage.setItem('activeCourseId', this.courseId);

    if (this.isLoggedIn && this.userEmail) {
      this.isEnrolled = await this.enrollments.isEnrolled(this.userEmail, this.courseId);
      this.certificate = await this.certificates.getByCourse(this.userEmail, this.courseId);
      this.hasCertificate = !!this.certificate;
      if (this.isEnrolled) {
        this.studyPlan = await this.studyPlans.getPlan(this.courseId);
      }
    }

    this.courseTitle = this.getCourseTitle(this.courseId);

    await this.applyStoredProgress();

    if (this.contentProtected) {
      this.installContentProtection();
    }

    this.normalizeProgressCounts();

    // Set the first active lesson
    const activeLesson = this.modules
      .flatMap((m): Lesson[] => m.lessons)
      .find((l: Lesson) => l.active);

    this.loadLesson(activeLesson ?? this.allLessons[0] ?? null);
  }

  ngOnDestroy(): void {
    this.teardownPlayers();
    this.uninstallContentProtection();
  }

  private getCourseTitle(courseId: string): string {
    const map: Record<string, string> = {
      '1': 'Complete Web Development Bootcamp',
      '2': 'UI/UX Design Masterclass',
      '3': 'Python for Data Science',
      '4': 'Digital Marketing Strategy',
      '5': 'Business Management Essentials',
      '6': 'Mobile App Development'
    };
    return map[courseId] || 'Course Content';
  }

  get allLessons(): Lesson[] {
    return this.modules.flatMap((m) => m.lessons);
  }

  get progressPercent(): number {
    const total = this.allLessons.length;
    if (total === 0) return 0;
    const completed = this.allLessons.filter((l) => l.completed).length;
    return Math.round((completed / total) * 100);
  }

  get progressText(): string {
    const total = this.allLessons.length;
    const completed = this.allLessons.filter((l) => l.completed).length;
    return `${completed}/${total}`;
  }

  get currentLessonWatchedPercent(): number {
    if (!this.videoDurationSeconds) return 0;
    return Math.min(100, Math.round((this.videoWatchedSeconds / this.videoDurationSeconds) * 100));
  }

  get canMarkCurrentLessonComplete(): boolean {
    if (!this.currentLesson) return false;
    if (!this.isLoggedIn) return false;
    if (this.currentLesson.completed) return false;

    if (this.currentLesson.type === 'video') {
      // Only allow completion after we've seen the video genuinely finish.
      return this.canAutoCompleteVideo;
    }

    if (this.currentLesson.type === 'quiz') return false;
    return true;
  }

  setTab(tab: LessonTab) {
    this.selectedTab = tab;
  }

  async togglePlanSession(sessionId: string, completed: boolean): Promise<void> {
    if (!this.studyPlan) return;
    try {
      this.studyPlan = await this.studyPlans.markSessionComplete(this.studyPlan.id, sessionId, completed);
    } catch (e: any) {
      this.toast.error('Update failed', e?.message || 'Please try again');
    }
  }

  tryLoadLesson(lesson: Lesson | null) {
    if (!lesson) {
      this.loadLesson(null);
      return;
    }

    if (!this.canAccessLesson(lesson)) {
      if (!this.isLoggedIn) {
        this.toast.info('Preview only', 'Login to access this lesson');
        this.router.navigate(['/login'], { queryParams: { returnUrl: `/course-content?courseId=${this.courseId}` } });
        return;
      }
      this.toast.info('Enrollment required', 'Enroll to unlock this lesson');
      this.router.navigate(['/courses', this.courseId]);
      return;
    }

    if (!this.isLoggedIn && !lesson.isPreview) {
      this.toast.info('Preview only', 'Login to access this lesson');
      return;
    }

    this.loadLesson(lesson);
  }

  private loadLesson(lesson: Lesson | null) {
    if (!lesson) {
      this.currentLesson = null;
      this.safeVideoUrl = null;
      this.teardownPlayers();
      return;
    }

    // Update active state across all lessons
    for (const module of this.modules) {
      for (const l of module.lessons) {
        l.active = false;
      }
    }
    lesson.active = true;

    this.currentLesson = lesson;
    this.selectedTab = 'overview';

    this.teardownPlayers();
    this.resetVideoTracking();

    // Reset quiz state on lesson change
    this.quizQuestions = lesson.type === 'quiz' ? this.getQuizForLesson(lesson) : [];
    this.quizAnswers = {};
    this.quizSubmitted = false;
    this.quizScoreText = '';
    this.loadNotesForLesson();

    if (lesson.type === 'video' && lesson.videoUrl) {
      this.safeVideoUrl = this.getSafeVideoUrl(lesson.videoUrl, lesson.contentType || 'url');
    } else {
      this.safeVideoUrl = null;
    }

    // Attach tracking after view updates.
    setTimeout(() => this.attachTrackingForCurrentLesson(), 0);

    // TODO: Mark lesson as viewed via API
    // await this.courseService.markLessonViewed(courseId, lessonId);
  }

  getSafeVideoUrl(url: string, contentType: string): SafeResourceUrl | null {
    let embedUrl = '';

    switch (contentType) {
      case 'youtube':
        const youtubeId = this.getYouTubeVideoId(url);
        if (youtubeId) {
          embedUrl = `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&enablejsapi=1`;
        }
        break;
      
      case 'vimeo':
        const vimeoId = this.getVimeoVideoId(url);
        if (vimeoId) {
          embedUrl = `https://player.vimeo.com/video/${vimeoId}?api=1&player_id=vimeo-player`;
        }
        break;
      
      case 'url':
      case 'upload':
        embedUrl = url;
        break;
    }

    return embedUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl) : null;
  }

  getYouTubeVideoId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  }

  getVimeoVideoId(url: string): string | null {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
  }

  async markLessonComplete(lesson: Lesson) {
    if (!this.isLoggedIn) {
      this.toast.info('Login required', 'Login to track your progress');
      return;
    }

    if (lesson.type === 'video' && !this.canAutoCompleteVideo) {
      this.toast.info('Watch required', 'Finish the video to complete this lesson');
      return;
    }

    lesson.completed = true;
    if (this.userEmail) {
      await this.progress.markLessonCompleted(this.courseId, lesson.id);
    }
    this.normalizeProgressCounts();
    // TODO: Update completion status via API
    // await this.courseService.updateLessonProgress(courseId, lessonId, { completed: true });
  }

  private getQuizForLesson(lesson: Lesson): QuizQuestion[] {
    // TODO: Replace with backend: GET /api/courses/:courseId/lessons/:lessonId/quiz
    // For now, key off the lesson title.
    if (lesson.title.toLowerCase().includes('javascript')) {
      return [
        {
          id: 'q1',
          prompt: 'Which keyword declares a block-scoped variable? ',
          options: ['var', 'let', 'function', 'constantly'],
          correctIndex: 1
        },
        {
          id: 'q2',
          prompt: 'What is the result of typeof null?',
          options: ['null', 'object', 'undefined', 'number'],
          correctIndex: 1
        },
        {
          id: 'q3',
          prompt: 'Which array method creates a new array by transforming each element?',
          options: ['forEach', 'map', 'filter', 'push'],
          correctIndex: 1
        }
      ];
    }

    return [
      {
        id: 'q1',
        prompt: 'A quiz lesson is a set of questions used to check learning progress.',
        options: ['True', 'False'],
        correctIndex: 0
      }
    ];
  }

  selectQuizAnswer(questionId: string, optionIndex: number): void {
    if (this.quizSubmitted) return;
    this.quizAnswers[questionId] = optionIndex;
  }

  async submitQuiz(): Promise<void> {
    if (!this.currentLesson || this.currentLesson.type !== 'quiz') return;

    if (!this.quizQuestions.length) {
      this.toast.info('No quiz', 'This quiz has no questions yet');
      return;
    }

    const unanswered = this.quizQuestions.find((q) => this.quizAnswers[q.id] === undefined);
    if (unanswered) {
      this.toast.error('Incomplete', 'Please answer all questions');
      return;
    }

    const total = this.quizQuestions.length;
    const correct = this.quizQuestions.filter((q) => this.quizAnswers[q.id] === q.correctIndex).length;
    const percent = Math.round((correct / total) * 100);
    this.quizSubmitted = true;
    this.quizScoreText = `${correct}/${total} (${percent}%)`;

    // Mark complete if passed (>= 60%)
    if (percent >= 60) {
      if (this.isLoggedIn) {
        this.currentLesson.completed = true;
        if (this.userEmail) {
          await this.progress.upsertLessonProgress(this.courseId, this.currentLesson.id, {
            completed: true,
            quizScorePercent: percent,
            quizScoreText: this.quizScoreText
          });
        }
        this.normalizeProgressCounts();
      }
      this.toast.success('Quiz passed', this.quizScoreText);
    } else {
      this.toast.info('Try again', this.quizScoreText);
    }
  }

  retryQuiz(): void {
    this.quizAnswers = {};
    this.quizSubmitted = false;
    this.quizScoreText = '';
  }

  goToNextLesson() {
    if (!this.currentLesson) return;
    const lessons = this.allLessons;
    const index = lessons.indexOf(this.currentLesson);
    const next = index >= 0 ? lessons[index + 1] : undefined;
    if (next) this.loadLesson(next);
  }

  goToPreviousLesson() {
    if (!this.currentLesson) return;
    const lessons = this.allLessons;
    const index = lessons.indexOf(this.currentLesson);
    const prev = index > 0 ? lessons[index - 1] : undefined;
    if (prev) this.loadLesson(prev);
  }

  get isFirstLesson(): boolean {
    if (!this.currentLesson) return true;
    return this.allLessons.indexOf(this.currentLesson) <= 0;
  }

  get isLastLesson(): boolean {
    if (!this.currentLesson) return true;
    const index = this.allLessons.indexOf(this.currentLesson);
    return index < 0 || index >= this.allLessons.length - 1;
  }

  private normalizeProgressCounts() {
    for (const module of this.modules) {
      module.totalLessons = module.lessons.length;
      module.completedLessons = module.lessons.filter((l) => l.completed).length;
    }
  }

  get isCourseCompleted(): boolean {
    const total = this.allLessons.length;
    if (!total) return false;
    const completed = this.allLessons.filter((l) => l.completed).length;
    return completed >= total;
  }

  goToFinalExam(): void {
    if (!this.isLoggedIn || !this.userEmail) {
      this.toast.info('Login required', 'Sign in to take the final exam.');
      return;
    }
    if (!this.isEnrolled) {
      this.toast.info('Enrollment required', 'Enroll to unlock the final exam.');
      return;
    }
    if (!this.isCourseCompleted) {
      this.toast.info('Finish all lessons', 'Complete the course to unlock the final exam.');
      return;
    }
    this.router.navigate(['/exam', this.courseId]);
  }

  openCertificate(): void {
    if (!this.certificate) return;
    this.router.navigate(['/verify-certificate', this.certificate.id]);
  }

  canAccessLesson(lesson: Lesson): boolean {
    if (lesson.isPreview) return true;
    if (!this.isLoggedIn) return false;
    return this.isEnrolled;
  }

  private loadNotesForLesson(): void {
    if (!this.currentLesson || !this.isLoggedIn || !this.userEmail) {
      this.notesText = '';
      this.notesUpdatedAtIso = null;
      return;
    }

    const res = this.notes.getNote(this.userEmail, this.courseId, this.currentLesson.id);
    this.notesText = res.text;
    this.notesUpdatedAtIso = res.updatedAtIso;
  }

  saveNotes(): void {
    if (!this.currentLesson || !this.isLoggedIn || !this.userEmail) return;
    try {
      const res = this.notes.saveNote(this.userEmail, this.courseId, this.currentLesson.id, this.notesText);
      this.notesText = res.text;
      this.notesUpdatedAtIso = res.updatedAtIso;
      this.toast.success('Notes saved');
    } catch (e: any) {
      this.toast.error('Could not save notes', e?.message || 'Please try again');
    }
  }

  toggleFocusMode(): void {
    this.focusMode = !this.focusMode;
  }

  private async applyStoredProgress(): Promise<void> {
    if (!this.userEmail) return;
    const course = await this.progress.getCourseProgress(this.courseId);
    for (const lesson of this.allLessons) {
      const lp = course.lessons[lesson.id];
      if (lp?.completed) {
        lesson.completed = true;
      }
    }
  }

  private resetVideoTracking(): void {
    this.videoDurationSeconds = 0;
    this.videoWatchedSeconds = 0;
    this.canAutoCompleteVideo = false;
    this.lastVideoTime = 0;
  }

  private attachTrackingForCurrentLesson(): void {
    if (!this.isLoggedIn || !this.userEmail) return;
    if (!this.currentLesson || this.currentLesson.type !== 'video' || !this.currentLesson.videoUrl) return;

    const contentType = this.currentLesson.contentType || 'url';
    if (contentType === 'url' || contentType === 'upload') {
      const el = this.html5Video?.nativeElement;
      if (!el) return;

      const onLoadedMetadata = () => {
        this.videoDurationSeconds = Number.isFinite(el.duration) ? Math.floor(el.duration) : 0;
        this.persistVideoProgress();
      };

      const onTimeUpdate = () => {
        const t = el.currentTime || 0;
        const delta = t - this.lastVideoTime;
        // Ignore big jumps (seeking).
        if (delta > 0 && delta < 2.5) {
          this.videoWatchedSeconds = Math.min(
            this.videoDurationSeconds || Math.floor(el.duration || 0) || Number.MAX_SAFE_INTEGER,
            this.videoWatchedSeconds + delta
          );
        }
        this.lastVideoTime = t;

        // Periodically persist.
        if (Math.round(t) % 5 === 0) {
          this.persistVideoProgress();
        }
      };

      const onRateChange = () => {
        // Keep playback reasonable; otherwise progress isn't meaningful.
        if (el.playbackRate > 2) el.playbackRate = 1;
      };

      const onEnded = () => {
        this.videoDurationSeconds = Number.isFinite(el.duration) ? Math.floor(el.duration) : this.videoDurationSeconds;
        this.videoWatchedSeconds = Math.max(this.videoWatchedSeconds, this.videoDurationSeconds);
        const watchedPct = this.videoDurationSeconds ? this.videoWatchedSeconds / this.videoDurationSeconds : 0;
        if (watchedPct >= 0.9) {
          this.canAutoCompleteVideo = true;
          this.markLessonComplete(this.currentLesson!);
        }
      };

      el.addEventListener('loadedmetadata', onLoadedMetadata);
      el.addEventListener('timeupdate', onTimeUpdate);
      el.addEventListener('ratechange', onRateChange);
      el.addEventListener('ended', onEnded);

      // Initialize from stored progress.
      void this.progress.getLessonProgress(this.courseId, this.currentLesson.id).then((stored) => {
        if (stored) {
          this.videoDurationSeconds = stored.durationSeconds || this.videoDurationSeconds;
          this.videoWatchedSeconds = stored.watchedSeconds || 0;
        }
        this.persistVideoProgress();
      });
      return;
    }

    if (contentType === 'youtube') {
      this.attachYouTubeTracking();
      return;
    }

    if (contentType === 'vimeo') {
      this.attachVimeoTracking();
      return;
    }
  }

  private persistVideoProgress(): void {
    if (!this.currentLesson || !this.userEmail || this.currentLesson.type !== 'video') return;
    void this.progress.upsertLessonProgress(this.courseId, this.currentLesson.id, {
      watchedSeconds: Math.floor(this.videoWatchedSeconds),
      durationSeconds: Math.floor(this.videoDurationSeconds)
    });
  }

  private teardownPlayers(): void {
    if (this.pollTimer) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    try {
      this.youTubePlayer?.destroy?.();
    } catch {
      // ignore
    }
    this.youTubePlayer = null;

    try {
      this.vimeoPlayer?.unload?.();
      this.vimeoPlayer?.destroy?.();
    } catch {
      // ignore
    }
    this.vimeoPlayer = null;
  }

  private installContentProtection(): void {
    this.visibilityHandler = () => {
      this.contentBlurred = document.visibilityState !== 'visible';
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.keydownHandler = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase();
      // Best-effort: block print/copy/save shortcuts
      if ((e.ctrlKey || e.metaKey) && (key === 'p' || key === 's' || key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', this.keydownHandler, { capture: true });

    this.contextMenuHandler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('contextmenu', this.contextMenuHandler, { capture: true });
  }

  private uninstallContentProtection(): void {
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.keydownHandler) document.removeEventListener('keydown', this.keydownHandler, { capture: true } as any);
    if (this.contextMenuHandler) document.removeEventListener('contextmenu', this.contextMenuHandler, { capture: true } as any);
    this.visibilityHandler = null;
    this.keydownHandler = null;
    this.contextMenuHandler = null;
  }

  private static scriptPromises: Record<string, Promise<void> | undefined> = {};
  private loadScriptOnce(url: string, globalReadyCheck: () => boolean, globalReadyCallbackName?: string): Promise<void> {
    if (CourseContent.scriptPromises[url]) return CourseContent.scriptPromises[url];
    if (globalReadyCheck()) {
      CourseContent.scriptPromises[url] = Promise.resolve();
      return CourseContent.scriptPromises[url];
    }

    CourseContent.scriptPromises[url] = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => {
        if (!globalReadyCallbackName) {
          resolve();
        }
      };
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(script);

      if (globalReadyCallbackName) {
        (window as any)[globalReadyCallbackName] = () => resolve();
      }
    });

    return CourseContent.scriptPromises[url];
  }

  private attachYouTubeTracking(): void {
    const iframe = this.embedIframe?.nativeElement;
    if (!iframe || !this.currentLesson) return;

    const readyCheck = () => Boolean((window as any).YT && (window as any).YT.Player);
    this.loadScriptOnce('https://www.youtube.com/iframe_api', readyCheck, 'onYouTubeIframeAPIReady')
      .then(() => {
        if (!this.currentLesson || this.currentLesson.type !== 'video') return;
        const YT = (window as any).YT;

        this.youTubePlayer = new YT.Player(iframe, {
          events: {
            onReady: () => {
              try {
                this.videoDurationSeconds = Math.floor(this.youTubePlayer.getDuration?.() || 0);
              } catch {
                this.videoDurationSeconds = 0;
              }
              void this.progress.getLessonProgress(this.courseId, this.currentLesson!.id).then((stored) => {
                if (stored) {
                  this.videoDurationSeconds = stored.durationSeconds || this.videoDurationSeconds;
                  this.videoWatchedSeconds = stored.watchedSeconds || 0;
                }
                this.persistVideoProgress();
              });
            },
            onStateChange: (evt: any) => {
              // 0 ended, 1 playing
              if (evt?.data === 1) {
                this.startPoll(() => {
                  const t = this.youTubePlayer.getCurrentTime?.() || 0;
                  const d = this.youTubePlayer.getDuration?.() || 0;
                  this.trackTick(t, d);
                });
              }

              if (evt?.data === 0) {
                const d = this.youTubePlayer.getDuration?.() || this.videoDurationSeconds;
                this.videoDurationSeconds = Math.floor(d || 0);
                this.videoWatchedSeconds = Math.max(this.videoWatchedSeconds, this.videoDurationSeconds);
                const watchedPct = this.videoDurationSeconds ? this.videoWatchedSeconds / this.videoDurationSeconds : 0;
                if (watchedPct >= 0.9) {
                  this.canAutoCompleteVideo = true;
                  this.markLessonComplete(this.currentLesson!);
                }
              }
            }
          }
        });
      })
      .catch(() => {
        // Tracking unavailable
      });
  }

  private attachVimeoTracking(): void {
    const iframe = this.embedIframe?.nativeElement;
    if (!iframe || !this.currentLesson) return;

    const readyCheck = () => Boolean((window as any).Vimeo && (window as any).Vimeo.Player);
    this.loadScriptOnce('https://player.vimeo.com/api/player.js', readyCheck)
      .then(() => {
        if (!this.currentLesson || this.currentLesson.type !== 'video') return;
        const Vimeo = (window as any).Vimeo;
        this.vimeoPlayer = new Vimeo.Player(iframe);

        this.vimeoPlayer.on('loaded', async () => {
          try {
            const d = await this.vimeoPlayer.getDuration();
            this.videoDurationSeconds = Math.floor(d || 0);
          } catch {
            this.videoDurationSeconds = 0;
          }
          void this.progress.getLessonProgress(this.courseId, this.currentLesson!.id).then((stored) => {
            if (stored) {
              this.videoDurationSeconds = stored.durationSeconds || this.videoDurationSeconds;
              this.videoWatchedSeconds = stored.watchedSeconds || 0;
            }
            this.persistVideoProgress();
          });
        });

        this.vimeoPlayer.on('timeupdate', (data: any) => {
          const t = Number(data?.seconds || 0);
          const d = Number(data?.duration || 0);
          this.trackTick(t, d);
        });

        this.vimeoPlayer.on('ended', () => {
          const watchedPct = this.videoDurationSeconds ? this.videoWatchedSeconds / this.videoDurationSeconds : 0;
          if (watchedPct >= 0.9) {
            this.canAutoCompleteVideo = true;
            this.markLessonComplete(this.currentLesson!);
          }
        });
      })
      .catch(() => {
        // Tracking unavailable
      });
  }

  private startPoll(tick: () => void): void {
    if (this.pollTimer) return;
    this.pollTimer = window.setInterval(tick, 1000);
  }

  private trackTick(currentSeconds: number, durationSeconds: number): void {
    if (durationSeconds > 0) this.videoDurationSeconds = Math.floor(durationSeconds);
    const delta = currentSeconds - this.lastVideoTime;
    if (delta > 0 && delta < 2.5) {
      this.videoWatchedSeconds = Math.min(this.videoDurationSeconds || Number.MAX_SAFE_INTEGER, this.videoWatchedSeconds + delta);
    }
    this.lastVideoTime = currentSeconds;

    if (Math.round(currentSeconds) % 5 === 0) {
      this.persistVideoProgress();
    }
  }

  // TODO: Replace with actual API call when backend is ready
  // This is temporary mock data for UI development
  modules: Module[] = [
    {
      title: 'Module 1: Introduction',
      completedLessons: 0,
      totalLessons: 0,
      lessons: [
        { 
          id: 'm1l1',
          title: 'Welcome to the Course', 
          duration: '5:30', 
          completed: false, 
          active: false,
          type: 'video',
          contentType: 'youtube',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          isPreview: true
        },
        { 
          id: 'm1l2',
          title: 'Course Overview', 
          duration: '8:45', 
          completed: false, 
          active: false,
          type: 'video',
          contentType: 'youtube',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          isPreview: true
        },
        { 
          id: 'm1l3',
          title: 'Setting Up Your Environment', 
          duration: '12:20', 
          completed: false, 
          active: false,
          type: 'video',
          contentType: 'youtube',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          isPreview: false
        }
      ]
    },
    {
      title: 'Module 2: JavaScript Fundamentals',
      completedLessons: 0,
      totalLessons: 0,
      lessons: [
        { 
          id: 'm2l1',
          title: 'Introduction to JavaScript', 
          duration: '15:30', 
          completed: false, 
          active: true,
          type: 'video',
          contentType: 'youtube',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          isPreview: true
        },
        {
          id: 'm2l2',
          title: 'JavaScript Fundamentals Quiz',
          duration: '10 questions',
          completed: false,
          active: false,
          type: 'quiz',
          isPreview: true
        },
        { 
          id: 'm2l3',
          title: 'Variables and Data Types', 
          duration: '18:45', 
          completed: false, 
          active: false,
          type: 'video',
          contentType: 'vimeo',
          videoUrl: 'https://vimeo.com/76979871',
          isPreview: false
        },
        { 
          id: 'm2l4',
          title: 'Operators and Expressions', 
          duration: '14:15', 
          completed: false, 
          active: false,
          type: 'article',
          articleContent: '<h2>Understanding Operators</h2><p>Article content here...</p>',
          isPreview: false
        }
      ]
    }
  ];
}
