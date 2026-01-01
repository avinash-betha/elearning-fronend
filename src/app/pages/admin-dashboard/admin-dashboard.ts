import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, AppUser } from '../../services/auth.service';
import { AdminUsersService } from '../../services/admin-users.service';
import { AdminCourseSubmissionsService, CourseSubmission } from '../../services/admin-course-submissions.service';
import { InstructorApplication, InstructorApplicationService } from '../../services/instructor-application.service';
import { ToastService } from '../../services/toast.service';
import { ExportRow, ExportService } from '../../services/export.service';
import { SupportChatMessage, SupportChatService, SupportChatThread } from '../../services/support-chat.service';
import { CommerceEvent, CommerceEventsService, CoursePurchaseEvent, SubscriptionChangeEvent } from '../../services/commerce-events.service';
import { AnnouncementAudience, AnnouncementRecord, AnnouncementsService } from '../../services/announcements.service';
import { CourseService } from '../../services/course.service';
import { EnrollmentService } from '../../services/enrollment.service';
import { CurrencyService } from '../../services/currency.service';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
  status: 'active' | 'suspended';
  joined: string;
}

interface CourseApproval {
  id: string;
  courseTitle: string;
  instructor: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'in-review';
}

interface SupportChat {
  id: number;
  user: string;
  avatar: string;
  message: string;
  time: string;
  status: 'urgent' | 'pending' | 'resolved';
  unread: boolean;
  courseId?: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css']
})
export class AdminDashboard implements OnInit {
  userName = '';
  userEmail = '';

  totalUsers = 0;
  totalCourses = 0;
  totalRevenueLabel = '$0.00';
  activeStudents = 0;
  
  // Filter state
  currentFilter: 'all' | 'student' | 'instructor' | 'admin' = 'all';
  filteredUsers: User[] = [];
  
  // Modal states
  showEditModal = false;
  showSuspendModal = false;
  showReplyModal = false;
  showApprovalModal = false;

  showInstructorApprovalModal = false;
  
  // Selected items for modals
  selectedUser: User | null = null;
  selectedChat: SupportChat | null = null;
  selectedApproval: CourseApproval | null = null;

  selectedInstructorApplication: InstructorApplication | null = null;
  
  // Form data
  editForm = { name: '', email: '', role: 'student' as 'student' | 'instructor' | 'admin', status: 'active' as 'active' | 'suspended' };
  suspendReason = '';
  replyMessage = '';
  approvalAction: 'approve' | 'reject' | 'review' = 'approve';
  approvalNotes = '';

  pendingInstructorApplications: InstructorApplication[] = [];
  instructorApprovalAction: 'approve' | 'reject' = 'approve';
  instructorAdminNotes = '';

  announcementForm: {
    title: string;
    body: string;
    audience: AnnouncementAudience;
    courseId: string;
    pinned: boolean;
  } = {
    title: '',
    body: '',
    audience: 'all',
    courseId: '',
    pinned: false
  };

  recentAnnouncements: AnnouncementRecord[] = [];
  showExports = false;

  constructor(
    private auth: AuthService,
    private adminUsers: AdminUsersService,
    private courseSubmissions: AdminCourseSubmissionsService,
    private instructorApps: InstructorApplicationService,
    private toast: ToastService,
    private exportService: ExportService,
    private supportChat: SupportChatService,
    private commerceEvents: CommerceEventsService,
    private announcements: AnnouncementsService,
    private courses: CourseService,
    private enrollments: EnrollmentService,
    private currency: CurrencyService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const currentUser = await this.auth.fetchCurrentUser();
    this.userName = currentUser?.name || localStorage.getItem('userName') || 'Admin';
    this.userEmail = currentUser?.email || localStorage.getItem('userEmail') || '';

    await this.refreshUsers();
    await this.refreshInstructorApplications();
    await this.refreshCourseApprovals();
    this.refreshSupportChats();
    await this.refreshAnnouncements();
    await this.refreshStats();
    this.applyFilter('all');
  }

  private async refreshAnnouncements(): Promise<void> {
    const userKey = (this.userEmail || 'admin').trim().toLowerCase() || 'admin';
    const res = await this.announcements.listForUser({ userKey, userRole: 'admin', enrolledCourseIds: [] });
    this.recentAnnouncements = res.announcements.slice(0, 6);
  }

  async createAnnouncement(): Promise<void> {
    try {
      const created = await this.announcements.create({
        title: this.announcementForm.title,
        body: this.announcementForm.body,
        audience: this.announcementForm.audience,
        courseId: this.announcementForm.courseId?.trim() ? this.announcementForm.courseId.trim() : undefined,
        pinned: this.announcementForm.pinned
      });

      this.toast.success('Announcement posted', created.title);
      this.announcementForm.title = '';
      this.announcementForm.body = '';
      this.announcementForm.courseId = '';
      this.announcementForm.pinned = false;
      await this.refreshAnnouncements();
    } catch (e: any) {
      this.toast.error('Could not post announcement', e?.message || 'Please try again');
    }
  }

  async toggleAnnouncementPin(a: AnnouncementRecord): Promise<void> {
    if (!a?.id) return;
    await this.announcements.update(a.id, { pinned: !a.pinned });
    await this.refreshAnnouncements();
  }

  private async refreshUsers(): Promise<void> {
    const users = await this.adminUsers.listAll();
    this.users = users.map((u) => this.toDashboardUser(u));
    this.totalUsers = this.users.length;
  }

  async refreshInstructorApplications(): Promise<void> {
    this.pendingInstructorApplications = await this.instructorApps.listPending();
  }

  private async refreshCourseApprovals(): Promise<void> {
    const submissions = await this.courseSubmissions.list();
    this.pendingApprovals = submissions.map((s) => this.toCourseApproval(s));
  }

  private refreshSupportChats(): void {
    const threads = this.supportChat.listThreadsForAdmin();
    this.supportChats = threads.map((t) => this.toSupportChat(t));
  }

  private async refreshStats(): Promise<void> {
    try {
      const courses = await this.courses.listAllCourses();
      this.totalCourses = courses.length;

      const enrollmentLists = await Promise.all(courses.map((c) => this.enrollments.listByCourse(String(c.id))));
      const allEnrollments = enrollmentLists.flat();
      const uniqueStudents = new Set(allEnrollments.map((e) => String(e.email || '').toLowerCase()).filter(Boolean));
      this.activeStudents = uniqueStudents.size;

      const revenueCents = allEnrollments.reduce((sum, e) => sum + Math.max(0, Math.floor(e.amountCents || 0)), 0);
      this.totalRevenueLabel = this.currency.formatMoney(revenueCents, this.currency.resolveDefaultCurrency());
    } catch {
      this.totalCourses = 0;
      this.activeStudents = 0;
      this.totalRevenueLabel = '$0.00';
    }
  }

  exportInstructorApplicationsCsv(): void {
    try {
      const { applications } = this.buildInstructorApplicationExport();
      this.exportService.exportCsv('instructor_applications.csv', applications);
      this.toast.success('Export started', 'CSV download generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  exportUsersCsv(): void {
    try {
      const rows: ExportRow[] = (this.filteredUsers || []).map((u) => ({
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        joined: u.joined,
        exportFilter: this.currentFilter
      }));
      this.exportService.exportCsv(`users_${this.currentFilter}.csv`, rows);
      this.toast.success('Export started', 'CSV download generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  async exportUsersExcel(): Promise<void> {
    try {
      const rows: ExportRow[] = (this.filteredUsers || []).map((u) => ({
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        joined: u.joined,
        exportFilter: this.currentFilter
      }));
      await this.exportService.exportExcel(`users_${this.currentFilter}.xlsx`, [{ name: 'Users', rows }]);
      this.toast.success('Export started', 'Excel download generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  exportCourseApprovalsCsv(): void {
    try {
      const rows: ExportRow[] = (this.pendingApprovals || []).map((a) => ({
        id: a.id,
        courseTitle: a.courseTitle,
        instructor: a.instructor,
        status: a.status,
        description: a.description
      }));
      this.exportService.exportCsv('course_approvals.csv', rows);
      this.toast.success('Export started', 'CSV download generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  exportSupportChatsCsv(): void {
    try {
      const { threads, messages } = this.buildSupportChatExports();
      this.exportService.exportCsv('support_threads.csv', threads);
      // Provide the detailed messages as a second CSV for simplicity.
      this.exportService.exportCsv('support_messages.csv', messages);
      this.toast.success('Export started', 'CSV downloads generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  async exportSupportChatsExcel(): Promise<void> {
    try {
      const { threads, messages } = this.buildSupportChatExports();
      await this.exportService.exportExcel('support_chats.xlsx', [
        { name: 'Threads', rows: threads },
        { name: 'Messages', rows: messages }
      ]);
      this.toast.success('Export started', 'Excel download generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  exportCommerceEventsCsv(): void {
    try {
      const { events, lineItems } = this.buildCommerceExports();
      this.exportService.exportCsv('commerce_events.csv', events);
      this.exportService.exportCsv('commerce_line_items.csv', lineItems);
      this.toast.success('Export started', 'CSV downloads generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  async exportCommerceEventsExcel(): Promise<void> {
    try {
      const { events, lineItems } = this.buildCommerceExports();
      await this.exportService.exportExcel('commerce_events.xlsx', [
        { name: 'Events', rows: events },
        { name: 'LineItems', rows: lineItems }
      ]);
      this.toast.success('Export started', 'Excel download generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  async exportCourseApprovalsExcel(): Promise<void> {
    try {
      const rows: ExportRow[] = (this.pendingApprovals || []).map((a) => ({
        id: a.id,
        courseTitle: a.courseTitle,
        instructor: a.instructor,
        status: a.status,
        description: a.description
      }));
      await this.exportService.exportExcel('course_approvals.xlsx', [{ name: 'CourseApprovals', rows }]);
      this.toast.success('Export started', 'Excel download generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  async exportInstructorApplicationsExcel(): Promise<void> {
    try {
      const { applications, history } = this.buildInstructorApplicationExport();
      await this.exportService.exportExcel('instructor_applications.xlsx', [
        { name: 'Applications', rows: applications },
        { name: 'DecisionHistory', rows: history }
      ]);
      this.toast.success('Export started', 'Excel download generated');
    } catch (e: any) {
      this.toast.error('Export failed', e?.message || 'Please try again');
    }
  }

  private buildSupportChatExports(): { threads: ExportRow[]; messages: ExportRow[] } {
    const allThreads: SupportChatThread[] = this.supportChat.listThreadsForAdmin();
    const threads: ExportRow[] = allThreads.map((t) => ({
      threadId: t.id,
      requesterEmail: t.requesterEmail,
      requesterName: t.requesterName,
      requesterRole: t.requesterRole,
      status: t.status,
      createdAtIso: t.createdAtIso,
      updatedAtIso: t.updatedAtIso,
      lastMessagePreview: t.lastMessagePreview,
      unreadForAdmin: t.unreadForAdmin,
      unreadForRequester: t.unreadForRequester
    }));

    const messages: ExportRow[] = allThreads.flatMap((t) => {
      const ms: SupportChatMessage[] = this.supportChat.listMessages(t.id);
      return ms.map((m) => ({
        threadId: m.threadId,
        messageId: m.id,
        fromRole: m.fromRole,
        fromEmail: m.fromEmail,
        fromName: m.fromName,
        body: m.body,
        sentAtIso: m.sentAtIso,
        requesterEmail: t.requesterEmail,
        requesterRole: t.requesterRole,
        threadStatus: t.status
      }));
    });

    return { threads, messages };
  }

  private buildCommerceExports(): { events: ExportRow[]; lineItems: ExportRow[] } {
    const all: CommerceEvent[] = this.commerceEvents.listAll();

    const events: ExportRow[] = all.map((e) => {
      const base: ExportRow = {
        eventId: e.id,
        type: e.type,
        atIso: e.atIso,
        actorEmail: e.actor.email,
        actorRole: e.actor.role,
        actorUserId: e.actor.userId,
        actorName: e.actor.name,
        source: (e as any).source
      };

      if (e.type === 'COURSE_PURCHASE') {
        const cp = e as CoursePurchaseEvent;
        return {
          ...base,
          paymentId: cp.paymentId,
          paymentMethodId: cp.paymentMethodId,
          amountCents: cp.amountCents,
          currency: cp.currency,
          itemsCount: cp.items.length
        };
      }

      const sc = e as SubscriptionChangeEvent;
      return {
        ...base,
        plan: sc.plan,
        status: sc.status,
        organizationName: sc.organizationName,
        startedAtIso: sc.startedAtIso,
        renewsAtIso: sc.renewsAtIso
      };
    });

    const lineItems: ExportRow[] = all.flatMap((e) => {
      if (e.type !== 'COURSE_PURCHASE') return [];
      const cp = e as CoursePurchaseEvent;
      return (cp.items || []).map((it, idx) => ({
        eventId: cp.id,
        lineItemIndex: idx,
        courseId: it.courseId,
        title: it.title,
        basePriceCents: it.basePriceCents,
        finalPriceCents: it.finalPriceCents,
        currency: it.currency,
        couponCode: it.couponCode
      }));
    });

    return { events, lineItems };
  }

  private buildInstructorApplicationExport(): { applications: ExportRow[]; history: ExportRow[] } {
    const allApps = this.pendingInstructorApplications || [];

    const applications: ExportRow[] = allApps.map((a) => {
      return {
        applicationId: a.id,
        applicantEmail: a.email,
        applicantName: a.name,
        status: a.status,
        submittedAtIso: a.submittedAtIso,
        adminNotes: a.adminNotes,
        highestQualification: a.highestQualification,
        yearsOfExperience: a.yearsOfExperience,
        expertiseAreas: a.expertiseAreas,
        portfolioUrl: a.portfolioUrl,
        documentsCount: a.documents?.length ?? 0
      };
    });

    return { applications, history: [] };
  }

  viewAllChats() {
    const el = document.querySelector('.chats-list');
    if (el && 'scrollIntoView' in el) {
      (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  // TODO: Replace with actual API call when backend is ready
  // This is temporary mock data for UI development
  users: User[] = [];

  pendingApprovals: CourseApproval[] = [];

  supportChats: SupportChat[] = [];

  // User filtering functionality
  applyFilter(filter: 'all' | 'student' | 'instructor' | 'admin') {
    this.currentFilter = filter;
    if (filter === 'all') {
      this.filteredUsers = [...this.users];
    } else {
      this.filteredUsers = this.users.filter(user => user.role === filter);
    }
    // TODO: Replace with API call
    // const response = await this.adminService.getUsers({ role: filter });
  }

  // Edit user functionality
  openEditModal(user: User) {
    this.selectedUser = user;
    this.editForm = { ...user };
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedUser = null;
  }

  async saveEditUser(): Promise<void> {
    if (this.selectedUser) {
      try {
        const updated = await this.adminUsers.update(this.selectedUser.id, {
          name: this.editForm.name,
          email: this.editForm.email,
          role: this.editForm.role,
          status: this.editForm.status
        });
        const idx = this.users.findIndex((u) => u.id === this.selectedUser!.id);
        if (idx !== -1) {
          this.users[idx] = this.toDashboardUser(updated, this.users[idx].joined);
          this.applyFilter(this.currentFilter);
        }
        this.toast.success('Saved', 'User updated');
        this.closeEditModal();
      } catch (e: any) {
        this.toast.error('Save failed', e?.message || 'Please try again');
      }
    }
  }

  // Suspend user functionality
  openSuspendModal(user: User) {
    this.selectedUser = user;
    this.suspendReason = '';
    this.showSuspendModal = true;
  }

  closeSuspendModal() {
    this.showSuspendModal = false;
    this.selectedUser = null;
    this.suspendReason = '';
  }

  async confirmSuspend(): Promise<void> {
    if (this.selectedUser && this.suspendReason.trim()) {
      try {
        const updated = await this.adminUsers.update(this.selectedUser.id, { status: 'suspended' });
        const idx = this.users.findIndex((u) => u.id === this.selectedUser!.id);
        if (idx !== -1) {
          this.users[idx] = this.toDashboardUser(updated, this.users[idx].joined);
          this.applyFilter(this.currentFilter);
        }
        this.toast.success('User suspended', this.selectedUser.name);
        this.closeSuspendModal();
      } catch (e: any) {
        this.toast.error('Suspend failed', e?.message || 'Please try again');
      }
    } else {
      this.toast.error('Reason required', 'Please provide a reason for suspension');
    }
  }

  // Support chat reply functionality
  openReplyModal(chat: SupportChat) {
    this.selectedChat = chat;
    this.replyMessage = '';
    this.showReplyModal = true;
  }

  closeReplyModal() {
    this.showReplyModal = false;
    this.selectedChat = null;
    this.replyMessage = '';
  }

  sendReply(): void {
    if (this.selectedChat && this.replyMessage.trim()) {
      // Mark as read and update status
      const chat = this.supportChats.find(c => c.id === this.selectedChat!.id);
      if (chat) {
        chat.unread = false;
        chat.status = 'resolved';
      }
      this.toast.success('Reply sent', this.selectedChat.user);
      this.closeReplyModal();
    } else {
      this.toast.error('Message required', 'Please enter a reply message');
    }
  }

  openCourseReview(chat: SupportChat, event?: Event): void {
    event?.stopPropagation();
    if (!chat?.courseId) {
      this.toast.info('No course linked', 'This chat is not tied to a course yet.');
      return;
    }
    this.router.navigate(['/courses', chat.courseId], { fragment: 'reviews' });
  }

  // Course approval functionality
  handleCourseAction(approval: CourseApproval, action: 'approve' | 'reject' | 'review') {
    this.selectedApproval = approval;
    this.approvalAction = action;
    this.approvalNotes = '';
    this.showApprovalModal = true;
  }

  closeApprovalModal() {
    this.showApprovalModal = false;
    this.selectedApproval = null;
    this.approvalNotes = '';
  }

  async confirmApprovalAction(): Promise<void> {
    if (this.selectedApproval) {
      const approval = this.pendingApprovals.find(a => a.id === this.selectedApproval!.id);
      if (!approval) return;
      try {
        if (this.approvalAction === 'approve') {
          await this.courseSubmissions.approve(approval.id, this.approvalNotes);
          approval.status = 'approved';
          this.toast.success('Course approved', approval.courseTitle);
        } else if (this.approvalAction === 'reject') {
          if (!this.approvalNotes.trim()) {
            this.toast.error('Reason required', 'Please provide a reason for rejection');
            return;
          }
          await this.courseSubmissions.reject(approval.id, this.approvalNotes.trim());
          approval.status = 'rejected';
          this.toast.success('Course rejected', approval.courseTitle);
        } else if (this.approvalAction === 'review') {
          approval.status = 'in-review';
          this.toast.success('Marked for review', approval.courseTitle);
        }
        this.closeApprovalModal();
      } catch (e: any) {
        this.toast.error('Action failed', e?.message || 'Please try again');
      }
    }
  }

  openInstructorApprovalModal(app: InstructorApplication, action: 'approve' | 'reject') {
    this.selectedInstructorApplication = app;
    this.instructorApprovalAction = action;
    this.instructorAdminNotes = '';
    this.showInstructorApprovalModal = true;
  }

  closeInstructorApprovalModal() {
    this.showInstructorApprovalModal = false;
    this.selectedInstructorApplication = null;
    this.instructorAdminNotes = '';
  }

  async confirmInstructorApprovalAction(): Promise<void> {
    const app = this.selectedInstructorApplication;
    if (!app) return;

    try {
      if (this.instructorApprovalAction === 'approve') {
        await this.instructorApps.approve(app.email, this.instructorAdminNotes);
        this.toast.success('Instructor approved', app.name);
      } else {
        if (!this.instructorAdminNotes.trim()) {
          this.toast.error('Reason required', 'Please enter a rejection reason');
          return;
        }
        await this.instructorApps.reject(app.email, this.instructorAdminNotes);
        this.toast.success('Instructor rejected', app.name);
      }
    } catch (e: any) {
      this.toast.error('Action failed', e?.message || 'Please try again');
    }

    // Refresh lists
    await this.refreshInstructorApplications();
    await this.refreshUsers();
    this.applyFilter(this.currentFilter);

    this.closeInstructorApprovalModal();
  }

  private toDashboardUser(user: AppUser, joinedOverride?: string): User {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: (user.role as 'student' | 'instructor' | 'admin') || 'student',
      status: (user.status as 'active' | 'suspended') || 'active',
      joined: joinedOverride || (user.createdAtIso || new Date().toISOString()).slice(0, 10)
    };
  }

  private toCourseApproval(submission: CourseSubmission): CourseApproval {
    const id = String(submission.courseId || (submission as any).id || '');
    return {
      id,
      courseTitle: submission.title || (submission as any).courseTitle || 'Untitled course',
      instructor: submission.instructorName || submission.instructorEmail || 'Instructor',
      description: submission.description || (submission as any).summary || '',
      status: (submission.status as CourseApproval['status']) || 'pending'
    };
  }

  private toSupportChat(thread: SupportChatThread): SupportChat {
    const initials = thread.requesterName
      ? thread.requesterName.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()
      : (thread.requesterEmail || 'U').slice(0, 2).toUpperCase();
    const status = thread.status === 'RESOLVED' ? 'resolved' : thread.status === 'PENDING' ? 'pending' : 'urgent';
    const time = new Date(thread.updatedAtIso).toLocaleString();
    return {
      id: Number.parseInt(thread.id.replace(/\D/g, ''), 10) || 0,
      user: thread.requesterName || thread.requesterEmail,
      avatar: initials,
      message: thread.lastMessagePreview || 'No messages yet',
      time,
      status,
      unread: thread.unreadForAdmin,
      courseId: thread.courseId
    };
  }

  // Utility to get status display text
  getApprovalBadgeText(status: string): string {
    switch(status) {
      case 'PENDING': return 'Pending Review';
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Rejected';
      case 'pending': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'in-review': return 'In Review';
      default: return status;
    }
  }
}
