import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CourseService } from '../../services/course.service';
import { EnrollmentService } from '../../services/enrollment.service';
import { SkillsAssessment, SkillsAssessmentRecord, SkillsAssessmentService } from '../../services/skills-assessment.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-skills-path',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './skills-path.html',
  styleUrls: ['./skills-path.css']
})
export class SkillsPathPage implements OnInit {
  courseId = '';
  courseTitle = '';
  assessment: SkillsAssessment | null = null;
  record: SkillsAssessmentRecord | null = null;
  preAnswers: Record<string, number> = {};
  postAnswers: Record<string, number> = {};
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private courses: CourseService,
    private enrollments: EnrollmentService,
    private skills: SkillsAssessmentService,
    private toast: ToastService
  ) {}

  async ngOnInit(): Promise<void> {
    this.courseId = String(this.route.snapshot.paramMap.get('courseId') || '').trim();
    const user = this.auth.getCurrentUser();
    if (!this.courseId) {
      this.router.navigate(['/courses']);
      return;
    }
    if (!user?.email) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/skills-path/${this.courseId}` } });
      return;
    }
    if (!(await this.enrollments.isEnrolled(user.email, this.courseId))) {
      this.toast.info('Enroll required', 'Enroll in the course to access the skills path.');
      this.router.navigate(['/courses', this.courseId]);
      return;
    }

    const course = await this.courses.getById(this.courseId);
    this.courseTitle = course?.title || 'Course';
    this.assessment = await this.skills.getAssessment(this.courseId);
    this.loading = false;
  }

  get hasPreTest(): boolean {
    return !!this.record?.preCompletedAtIso;
  }

  get hasPostTest(): boolean {
    return !!this.record?.postCompletedAtIso;
  }

  async submitPreTest(): Promise<void> {
    if (!this.assessment) return;
    const unanswered = this.assessment.preTest.find((q) => this.preAnswers[q.id] === undefined);
    if (unanswered) {
      this.toast.info('Complete the pre-test', 'Answer all questions before submitting.');
      return;
    }

    const correct = this.assessment.preTest.filter((q) => this.preAnswers[q.id] === q.correctIndex);
    const scorePercent = Math.round((correct.length / this.assessment.preTest.length) * 100);
    const wrongTags = new Set<string>();
    this.assessment.preTest.forEach((q) => {
      if (this.preAnswers[q.id] !== q.correctIndex) {
        (q.tags || []).forEach((t) => wrongTags.add(t));
      }
    });

    this.record = await this.skills.savePreResult({
      courseId: this.courseId,
      scorePercent,
      weakTags: Array.from(wrongTags),
      recommendations: Array.from(wrongTags)
    });
    this.toast.success('Pre-test saved', `Score ${scorePercent}%`);
  }

  async submitPostTest(): Promise<void> {
    if (!this.assessment || !this.record) return;
    const unanswered = this.assessment.postTest.find((q) => this.postAnswers[q.id] === undefined);
    if (unanswered) {
      this.toast.info('Complete the post-test', 'Answer all questions before submitting.');
      return;
    }

    const correct = this.assessment.postTest.filter((q) => this.postAnswers[q.id] === q.correctIndex);
    const scorePercent = Math.round((correct.length / this.assessment.postTest.length) * 100);
    this.record = await this.skills.savePostResult({
      courseId: this.courseId,
      scorePercent
    });
    this.toast.success('Post-test saved', `Score ${scorePercent}%`);
  }
}
