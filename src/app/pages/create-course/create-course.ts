import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { CoursePreviewVideoType, CourseSection, CourseService } from '../../services/course.service';

interface Lecture {
  title: string;
  duration: string;
  type: 'video' | 'article' | 'quiz' | 'resource';
  contentType: 'upload' | 'youtube' | 'vimeo' | 'url';
  videoUrl?: string;
  videoFile?: File | null;
  articleContent?: string;
  resourceFile?: File | null;
  isFree?: boolean;
}

interface Section {
  sectionTitle: string;
  lectures: Lecture[];
}

@Component({
  selector: 'app-create-course',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-course.html',
  styleUrls: ['./create-course.css']
})
export class CreateCourse {
  isEditMode = false;
  editingCourseId: string | null = null;

  course = {
    title: '',
    subtitle: '',
    description: '',
    category: '',
    level: 'beginner',
    price: '',
    language: 'English',
    thumbnail: null as File | null,
    thumbnailPreview: '',
    previewVideo: null as File | null,
    previewVideoUrl: '',
    previewVideoType: 'upload' as CoursePreviewVideoType,
    requirements: [''],
    learningPoints: [''],
    curriculum: [
      {
        sectionTitle: 'Introduction',
        lectures: [
          {
            title: '',
            duration: '',
            type: 'video' as 'video' | 'article' | 'quiz' | 'resource',
            contentType: 'upload' as 'upload' | 'youtube' | 'vimeo' | 'url',
            videoUrl: '',
            videoFile: null,
            articleContent: '',
            resourceFile: null,
            isFree: false
          }
        ]
      }
    ] as Section[]
  };

  categories = ['Web Development', 'Mobile Development', 'Data Science', 'Design', 'Marketing', 'Business'];
  levels = ['beginner', 'intermediate', 'advanced'];

  formErrors: any = {};
  isSubmitting = false;

  showSubmitConfirmModal = false;
  showCancelConfirmModal = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private toast: ToastService,
    private courses: CourseService
  ) {
    const id = String(this.route.snapshot.paramMap.get('id') || '').trim();
    if (id) {
      this.isEditMode = true;
      this.editingCourseId = id;
      void this.loadExistingCourse(id);
    }
  }

  private async loadExistingCourse(id: string): Promise<void> {
    const course = await this.courses.getById(id);
    if (!course) {
      this.toast.error('Not found', 'Course does not exist');
      this.router.navigate(['/instructor']);
      return;
    }

    const actorEmail = String(localStorage.getItem('userEmail') || '').trim().toLowerCase();
    if (!actorEmail || String(course.instructorEmail || '').toLowerCase() !== actorEmail) {
      this.toast.error('Not allowed', 'You can only edit your own courses');
      this.router.navigate(['/instructor']);
      return;
    }

    this.course.title = course.title || '';
    this.course.subtitle = course.subtitle || '';
    this.course.description = course.description || '';
    this.course.category = course.category || '';
    this.course.level = (course.level as any) || 'beginner';
    this.course.language = course.language || 'English';
    this.course.thumbnailPreview = course.thumbnailDataUrl || '';
    this.course.previewVideoType = (course.previewVideoType as CoursePreviewVideoType) || 'upload';
    this.course.previewVideoUrl = course.previewVideoUrl || '';
    this.course.requirements = (course.requirements && course.requirements.length > 0) ? [...course.requirements] : [''];
    this.course.learningPoints = (course.learningPoints && course.learningPoints.length > 0) ? [...course.learningPoints] : [''];

    if (course.curriculum && course.curriculum.length > 0) {
      this.course.curriculum = (course.curriculum || []).map((s) => ({
        sectionTitle: s.sectionTitle,
        lectures: (s.lectures || []).map((l) => ({
          title: l.title,
          duration: l.duration || '',
          type: l.type as any,
          contentType: l.contentType as any,
          videoUrl: l.videoUrl || '',
          videoFile: null,
          articleContent: (l as any).articleContent || '',
          resourceFile: null,
          isFree: !!l.isFree
        }))
      })) as any;
    }

    if (course.isFree) {
      this.course.price = '0';
    } else {
      const cents = Math.max(0, Math.floor(course.priceCents || 0));
      this.course.price = (cents / 100).toFixed(2);
    }
  }

  addRequirement() {
    this.course.requirements.push('');
  }

  removeRequirement(index: number) {
    if (this.course.requirements.length > 1) {
      this.course.requirements.splice(index, 1);
    }
  }

  addLearningPoint() {
    this.course.learningPoints.push('');
  }

  removeLearningPoint(index: number) {
    if (this.course.learningPoints.length > 1) {
      this.course.learningPoints.splice(index, 1);
    }
  }

  addSection() {
    this.course.curriculum.push({
      sectionTitle: '',
      lectures: [{
        title: '',
        duration: '',
        type: 'video',
        contentType: 'upload',
        videoUrl: '',
        videoFile: null,
        articleContent: '',
        resourceFile: null,
        isFree: false
      }]
    });
  }

  removeSection(index: number) {
    if (this.course.curriculum.length > 1) {
      this.course.curriculum.splice(index, 1);
    }
  }

  addLecture(sectionIndex: number) {
    this.course.curriculum[sectionIndex].lectures.push({
      title: '',
      duration: '',
      type: 'video',
      contentType: 'upload',
      videoUrl: '',
      videoFile: null,
      articleContent: '',
      resourceFile: null,
      isFree: false
    });
  }

  removeLecture(sectionIndex: number, lectureIndex: number) {
    if (this.course.curriculum[sectionIndex].lectures.length > 1) {
      this.course.curriculum[sectionIndex].lectures.splice(lectureIndex, 1);
    }
  }

  onThumbnailSelect(event: any) {
    const file = event.target.files[0];
    if (file && this.validateImage(file)) {
      this.course.thumbnail = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.course.thumbnailPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  onPreviewVideoSelect(event: any) {
    const file = event.target.files[0];
    if (file && this.validateVideo(file)) {
      this.course.previewVideo = file;
    }
  }

  onLectureVideoSelect(event: any, sectionIndex: number, lectureIndex: number) {
    const file = event.target.files[0];
    if (file && this.validateVideo(file)) {
      this.course.curriculum[sectionIndex].lectures[lectureIndex].videoFile = file;
    }
  }

  onResourceFileSelect(event: any, sectionIndex: number, lectureIndex: number) {
    const file = event.target.files[0];
    if (file && this.validateDocument(file)) {
      this.course.curriculum[sectionIndex].lectures[lectureIndex].resourceFile = file;
    }
  }

  validateImage(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      this.toast.error('Invalid image', 'Upload JPG, PNG, or WebP');
      return false;
    }

    if (file.size > maxSize) {
      this.toast.error('Image too large', 'Max 5MB');
      return false;
    }

    return true;
  }

  validateVideo(file: File): boolean {
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const maxSize = 500 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      this.toast.error('Invalid video', 'Upload MP4, WebM, or MOV');
      return false;
    }

    if (file.size > maxSize) {
      this.toast.error('Video too large', 'Max 500MB');
      return false;
    }

    return true;
  }

  validateDocument(file: File): boolean {
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip'
    ];
    const maxSize = 50 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      this.toast.error('Invalid document', 'Upload PDF, DOCX, PPTX, or ZIP');
      return false;
    }

    if (file.size > maxSize) {
      this.toast.error('Document too large', 'Max 50MB');
      return false;
    }

    return true;
  }

  validateYouTubeUrl(url: string): boolean {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+(&[\w=]*)*$/;
    return youtubeRegex.test(url);
  }

  validateVimeoUrl(url: string): boolean {
    const vimeoRegex = /^(https?:\/\/)?(www\.)?vimeo\.com\/\d+$/;
    return vimeoRegex.test(url);
  }

  validateGenericUrl(url: string): boolean {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  }

  validateForm(): boolean {
    this.formErrors = {};
    let isValid = true;

    if (!this.course.title.trim()) {
      this.formErrors.title = 'Course title is required';
      isValid = false;
    }

    if (!this.course.description.trim()) {
      this.formErrors.description = 'Course description is required';
      isValid = false;
    }

    if (!this.course.category) {
      this.formErrors.category = 'Please select a category';
      isValid = false;
    }

    if (!this.course.price || parseFloat(this.course.price) < 0) {
      this.formErrors.price = 'Please enter a valid price';
      isValid = false;
    }

    // In edit mode, allow existing thumbnail preview.
    if (!this.course.thumbnail && !String(this.course.thumbnailPreview || '').trim()) {
      this.formErrors.thumbnail = 'Course thumbnail is required';
      isValid = false;
    }

    for (let i = 0; i < this.course.curriculum.length; i++) {
      const section = this.course.curriculum[i];
      if (!section.sectionTitle.trim()) {
        this.formErrors[`section_${i}`] = 'Section title is required';
        isValid = false;
      }

      for (let j = 0; j < section.lectures.length; j++) {
        const lecture = section.lectures[j];
        if (!lecture.title.trim()) {
          this.formErrors[`lecture_${i}_${j}`] = 'Lecture title is required';
          isValid = false;
        }

        if (lecture.type === 'video') {
          if (lecture.contentType === 'youtube' && lecture.videoUrl && !this.validateYouTubeUrl(lecture.videoUrl)) {
            this.formErrors[`lecture_video_${i}_${j}`] = 'Invalid YouTube URL';
            isValid = false;
          } else if (lecture.contentType === 'vimeo' && lecture.videoUrl && !this.validateVimeoUrl(lecture.videoUrl)) {
            this.formErrors[`lecture_video_${i}_${j}`] = 'Invalid Vimeo URL';
            isValid = false;
          } else if (lecture.contentType === 'url' && lecture.videoUrl && !this.validateGenericUrl(lecture.videoUrl)) {
            this.formErrors[`lecture_video_${i}_${j}`] = 'Invalid video URL';
            isValid = false;
          }
        }
      }
    }

    if (!isValid) {
      this.toast.error('Fix form errors', 'Please correct required fields');
    }

    return isValid;
  }

  async saveDraft() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    try {
      const res = await this.persistCourse('draft');
      this.toast.success('Draft saved', res.isEdit ? 'Course updated' : 'Course created');
    } catch (error: any) {
      this.toast.error('Save failed', error?.message || 'Please try again');
    } finally {
      this.isSubmitting = false;
    }
  }

  async submitForReview() {
    if (this.isSubmitting) return;
    if (!this.validateForm()) return;
    this.showSubmitConfirmModal = true;
  }

  closeSubmitConfirmModal() {
    this.showSubmitConfirmModal = false;
  }

  async confirmSubmitForReview() {
    if (this.isSubmitting) return;
    this.showSubmitConfirmModal = false;
    this.isSubmitting = true;

    try {
      await this.persistCourse('pending');
      this.toast.success('Submitted', 'Course submitted for admin review');
      this.router.navigate(['/instructor']);
    } catch (error: any) {
      this.toast.error('Submit failed', error?.message || 'Please try again');
    } finally {
      this.isSubmitting = false;
    }
  }

  private async persistCourse(status: 'draft' | 'pending'): Promise<{ isEdit: boolean; id: string }> {
    const instructorName = String(localStorage.getItem('userName') || 'Instructor').trim() || 'Instructor';
    const instructorEmail = String(localStorage.getItem('userEmail') || '').trim().toLowerCase();
    if (!instructorEmail) throw new Error('Not logged in');

    const requirements = this.course.requirements.map((r) => String(r || '').trim()).filter(Boolean);
    const learningPoints = this.course.learningPoints.map((p) => String(p || '').trim()).filter(Boolean);

    const curriculum: CourseSection[] = (this.course.curriculum || []).map((s) => ({
      sectionTitle: String(s.sectionTitle || '').trim(),
      lectures: (s.lectures || []).map((l) => ({
        title: String(l.title || '').trim(),
        duration: String(l.duration || '').trim(),
        type: l.type as any,
        contentType: l.contentType as any,
        videoUrl: l.videoUrl ? String(l.videoUrl || '').trim() : undefined,
        articleContent: l.articleContent ? String(l.articleContent || '').trim() : undefined,
        isFree: !!l.isFree
      }))
    }));

    const rawPrice = String(this.course.price ?? '').trim();
    const numeric = Number(String(rawPrice || '0').replace(/[^0-9.]/g, ''));
    const isFree = !Number.isFinite(numeric) || numeric <= 0;

    if (this.isEditMode && this.editingCourseId) {
      const updated = await this.courses.updateCreatedCourse(this.editingCourseId, instructorEmail, {
        title: this.course.title,
        subtitle: this.course.subtitle,
        description: this.course.description,
        category: this.course.category,
        level: this.course.level,
        language: this.course.language,
        thumbnailDataUrl: this.course.thumbnailPreview || undefined,
        previewVideoType: this.course.previewVideoType,
        previewVideoUrl: this.course.previewVideoUrl || undefined,
        requirements,
        learningPoints,
        curriculum,
        isFree,
        price: rawPrice,
        status
      });
      return { isEdit: true, id: updated.id };
    }

    const created = await this.courses.createCourse({
      title: this.course.title,
      subtitle: this.course.subtitle,
      description: this.course.description,
      category: this.course.category,
      level: this.course.level,
      language: this.course.language,
      thumbnailDataUrl: this.course.thumbnailPreview || undefined,
      previewVideoType: this.course.previewVideoType,
      previewVideoUrl: this.course.previewVideoUrl || undefined,
      requirements,
      learningPoints,
      curriculum,
      instructorName,
      instructorEmail,
      isFree,
      price: rawPrice
    });

    if (status !== created.status) {
      await this.courses.updateCreatedCourse(created.id, instructorEmail, { status });
    }

    this.isEditMode = true;
    this.editingCourseId = created.id;
    return { isEdit: false, id: created.id };
  }

  cancel() {
    this.showCancelConfirmModal = true;
  }

  closeCancelConfirmModal() {
    this.showCancelConfirmModal = false;
  }

  confirmCancel() {
    this.showCancelConfirmModal = false;
    this.router.navigate(['/instructor']);
  }
}
