import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { InstructorApplicationService } from '../../services/instructor-application.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-apply-instructor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './apply-instructor.html',
  styleUrls: ['./apply-instructor.css']
})
export class ApplyInstructor implements OnInit {
  userName = '';
  userEmail = '';

  existingStatus: 'none' | 'pending' | 'approved' | 'rejected' = 'none';

  form = {
    highestQualification: '',
    yearsOfExperience: 0,
    expertiseAreas: '',
    portfolioUrl: ''
  };

  selectedFiles: File[] = [];

  constructor(
    private auth: AuthService,
    private apps: InstructorApplicationService,
    private toast: ToastService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    let user = null;
    try {
      user = await this.auth.fetchCurrentUser();
    } catch {
      user = null;
    }
    if (!user) return;

    this.userName = user.name;
    this.userEmail = user.email;
    this.existingStatus = user.instructorApplicationStatus || 'none';

    const existing = await this.apps.getMine();
    if (existing) {
      this.form.highestQualification = existing.highestQualification;
      this.form.yearsOfExperience = existing.yearsOfExperience;
      this.form.expertiseAreas = existing.expertiseAreas;
      this.form.portfolioUrl = existing.portfolioUrl || '';
    }
  }

  onDocsSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    const maxSize = 10 * 1024 * 1024; // 10MB per file

    for (const f of files) {
      if (!validTypes.includes(f.type)) {
        this.toast.error('Invalid document', 'Upload PDF, DOCX, PPTX, or image files');
        input.value = '';
        return;
      }
      if (f.size > maxSize) {
        this.toast.error('File too large', 'Max size is 10MB per file');
        input.value = '';
        return;
      }
    }

    this.selectedFiles = files;
  }

  async submit(): Promise<void> {
    try {
      await this.apps.submit({
        highestQualification: this.form.highestQualification,
        yearsOfExperience: Number(this.form.yearsOfExperience),
        expertiseAreas: this.form.expertiseAreas,
        portfolioUrl: this.form.portfolioUrl,
        files: this.selectedFiles
      });
      this.toast.success('Application submitted', 'Admin will review your documents');
      this.router.navigate(['/profile']);
    } catch (e: any) {
      this.toast.error('Failed to submit application', e?.message || 'Please try again');
    }
  }

  back(): void {
    this.router.navigate(['/profile']);
  }
}
