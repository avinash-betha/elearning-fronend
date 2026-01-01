import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CohortPostAttachment, CohortRecord, CohortService } from '../../services/cohort.service';
import { CourseService } from '../../services/course.service';
import { EnrollmentService } from '../../services/enrollment.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-cohort',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cohort.html',
  styleUrls: ['./cohort.css']
})
export class CohortPage implements OnInit {
  courseId = '';
  courseTitle = '';
  cohort: CohortRecord | null = null;
  message = '';
  attachments: CohortPostAttachment[] = [];
  userEmail = '';
  userName = '';

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private courses: CourseService,
    private enrollments: EnrollmentService,
    private cohorts: CohortService,
    private toast: ToastService
  ) {}

  async ngOnInit(): Promise<void> {
    this.courseId = String(this.route.snapshot.paramMap.get('courseId') || '').trim();
    const user = this.auth.getCurrentUser();
    this.userEmail = user?.email || localStorage.getItem('userEmail') || '';
    this.userName = user?.name || localStorage.getItem('userName') || 'Learner';
    const course = await this.courses.getById(this.courseId);
    this.courseTitle = course?.title || 'Course';

    if (!this.userEmail || !(await this.enrollments.isEnrolled(this.userEmail, this.courseId))) {
      this.toast.info('Enroll required', 'Enroll to access cohort mode.');
    }

    this.cohort = await this.cohorts.getCohort(this.courseId);
  }

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    const attachments = await this.readAttachments(files);
    this.attachments = [...this.attachments, ...attachments];
    input.value = '';
  }

  removeAttachment(index: number): void {
    this.attachments.splice(index, 1);
  }

  async postMessage(): Promise<void> {
    if (!this.userEmail) {
      this.toast.info('Login required', 'Please login to post.');
      return;
    }
    try {
      this.cohort = await this.cohorts.addPost({
        courseId: this.courseId,
        message: this.message,
        attachments: this.attachments
      });
      this.message = '';
      this.attachments = [];
    } catch (e: any) {
      this.toast.error('Post failed', e?.message || 'Please try again');
    }
  }

  async toggleReaction(postId: string, type: 'support' | 'insight' | 'celebrate'): Promise<void> {
    if (!this.userEmail) return;
    try {
      this.cohort = await this.cohorts.toggleReaction({
        courseId: this.courseId,
        postId,
        type
      });
    } catch (e: any) {
      this.toast.error('Reaction failed', e?.message || 'Please try again');
    }
  }

  reactionCount(post: { reactions: Record<'support' | 'insight' | 'celebrate', string[]> }, type: 'support' | 'insight' | 'celebrate'): number {
    return post.reactions?.[type]?.length || 0;
  }

  private readAttachments(files: FileList): Promise<CohortPostAttachment[]> {
    const tasks = Array.from(files).map((file) => this.readAttachment(file));
    return Promise.all(tasks);
  }

  private readAttachment(file: File): Promise<CohortPostAttachment> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: '',
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: String(reader.result || '')
        });
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }
}
