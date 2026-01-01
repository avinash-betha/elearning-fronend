import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CourseService } from '../../services/course.service';
import { CourseProjectsService, ProjectAttachment, ProjectRubricItem, ProjectSubmission } from '../../services/course-projects.service';
import { EnrollmentService } from '../../services/enrollment.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-course-project',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './course-project.html',
  styleUrls: ['./course-project.css']
})
export class CourseProjectPage implements OnInit {
  courseId = '';
  courseTitle = '';
  userEmail = '';
  userName = '';
  userRole = '';
  submission: ProjectSubmission | null = null;
  attachments: ProjectAttachment[] = [];
  allSubmissions: ProjectSubmission[] = [];
  selectedSubmission: ProjectSubmission | null = null;

  form = {
    title: '',
    description: ''
  };

  reviewForm: {
    status: ProjectSubmission['status'];
    rubric: ProjectRubricItem[];
    instructorNotes: string;
  } = { status: 'in_review', rubric: [], instructorNotes: '' };

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private courses: CourseService,
    private projects: CourseProjectsService,
    private enrollments: EnrollmentService,
    private toast: ToastService
  ) {}

  async ngOnInit(): Promise<void> {
    this.courseId = String(this.route.snapshot.paramMap.get('courseId') || '').trim();
    const user = this.auth.getCurrentUser();
    this.userEmail = user?.email || localStorage.getItem('userEmail') || '';
    this.userName = user?.name || localStorage.getItem('userName') || 'Learner';
    this.userRole = user?.role || localStorage.getItem('userRole') || 'student';
    const course = await this.courses.getById(this.courseId);
    this.courseTitle = course?.title || 'Course';

    if (this.userRole === 'student' && this.userEmail) {
      if (!(await this.enrollments.isEnrolled(this.userEmail, this.courseId))) {
        this.toast.info('Enroll required', 'Enroll in the course to submit the project.');
      }
      this.submission = await this.projects.getMine(this.courseId);
    }

    if (this.userRole !== 'student') {
      this.allSubmissions = await this.projects.listByCourse(this.courseId);
    }
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

  async submitProject(): Promise<void> {
    if (!this.userEmail) return;
    try {
      this.submission = await this.projects.submit({
        courseId: this.courseId,
        title: this.form.title,
        description: this.form.description,
        attachments: this.attachments
      });
      this.attachments = [];
      this.form = { title: '', description: '' };
      this.toast.success('Project submitted', 'Your instructor will review it soon.');
    } catch (e: any) {
      this.toast.error('Submit failed', e?.message || 'Please try again');
    }
  }

  selectSubmission(sub: ProjectSubmission): void {
    this.selectedSubmission = sub;
    this.reviewForm = {
      status: sub.status,
      rubric: sub.rubric.map((r) => ({ ...r })),
      instructorNotes: sub.instructorNotes || ''
    };
  }

  updateScore(index: number, value: number): void {
    const item = this.reviewForm.rubric[index];
    const safe = Math.max(0, Math.min(item.maxScore, Math.floor(value || 0)));
    item.score = safe;
  }

  async saveReview(): Promise<void> {
    if (!this.selectedSubmission) return;
    try {
      const updated = await this.projects.review({
        submissionId: this.selectedSubmission.id,
        status: this.reviewForm.status,
        rubric: this.reviewForm.rubric,
        instructorNotes: this.reviewForm.instructorNotes
      });
      this.selectedSubmission = updated;
      this.allSubmissions = await this.projects.listByCourse(this.courseId);
      this.toast.success('Review saved');
    } catch (e: any) {
      this.toast.error('Review failed', e?.message || 'Please try again');
    }
  }

  totalRubricScore(rubric: ProjectRubricItem[]): number {
    return rubric.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
  }

  private readAttachments(files: FileList): Promise<ProjectAttachment[]> {
    const tasks = Array.from(files).map((file) => this.readAttachment(file));
    return Promise.all(tasks);
  }

  private readAttachment(file: File): Promise<ProjectAttachment> {
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
