import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SupportChatMessage, SupportChatRole, SupportChatService, SupportChatThread } from '../../services/support-chat.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-support-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './support-chat.html',
  styleUrls: ['./support-chat.css']
})
export class SupportChat implements OnInit, OnDestroy {
  role: SupportChatRole = 'student';
  email = '';
  name = '';
  searchQuery = '';
  statusFilter: 'all' | 'open' | 'pending' | 'resolved' = 'all';
  courseLinkId = '';

  threads: SupportChatThread[] = [];
  selectedThread: SupportChatThread | null = null;
  messages: SupportChatMessage[] = [];
  openCount = 0;
  pendingCount = 0;
  resolvedCount = 0;

  lastSyncAtIso = '';

  private pollHandle: any = null;
  private lastRenderedMessageId: string | null = null;

  @ViewChild('messagesPane') messagesPane?: ElementRef<HTMLElement>;

  messageText = '';
  quickReplies: Array<{ label: string; text: string }> = [
    { label: 'Need details', text: 'Thanks for reaching out. Can you share the course name and the steps that led to the issue?' },
    { label: 'Refund info', text: 'I can help with refunds. Please confirm the course title and purchase email.' },
    { label: 'Video issue', text: 'Sorry about the playback issue. Try refreshing and switching networks. Which lesson is affected?' }
  ];

  constructor(
    private auth: AuthService,
    private chat: SupportChatService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const role = (localStorage.getItem('userRole') || 'student') as SupportChatRole;
    this.role = role;

    const current = this.auth.getCurrentUser();
    // Note: admins are not persisted in AuthService; fall back to local storage.
    this.email = (current?.email || localStorage.getItem('userEmail') || '').trim().toLowerCase();
    this.name = (current?.name || localStorage.getItem('userName') || '').trim() || 'User';

    this.loadThreads();

    if (this.role !== 'admin') {
      this.ensureMyThreadAndSelect();
    }

    this.startPolling();
  }

  ngOnDestroy(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  get roleLabel(): string {
    if (this.role === 'admin') return 'Admin';
    if (this.role === 'instructor') return 'Instructor';
    return 'Student';
  }

  loadThreads(): void {
    if (this.role === 'admin') {
      this.threads = this.chat.listThreadsForAdmin();
    } else {
      this.threads = this.chat.listThreadsForRequester(this.email);
    }
    this.updateThreadStats();
  }

  get filteredThreads(): SupportChatThread[] {
    const q = this.searchQuery.trim().toLowerCase();
    return (this.threads || []).filter((t) => {
      const statusMatch = this.statusFilter === 'all' || String(t.status).toLowerCase() === this.statusFilter;
      const text = `${t.requesterName} ${t.requesterEmail} ${t.lastMessagePreview || ''}`.toLowerCase();
      const queryMatch = !q || text.includes(q);
      return statusMatch && queryMatch;
    });
  }

  ensureMyThreadAndSelect(): void {
    if (!this.email) return;

    const current = this.auth.getCurrentUser();
    const requesterRole = (current?.role || this.role) as Exclude<SupportChatRole, 'admin'>;

    const t = this.chat.getOrCreateMyThread({
      requesterEmail: this.email,
      requesterName: this.name,
      requesterRole
    });

    this.selectThread(t);
    this.loadThreads();
  }

  selectThread(t: SupportChatThread): void {
    this.selectedThread = t;
    this.courseLinkId = t.courseId || '';
    this.messages = this.chat.listMessages(t.id);
    this.lastRenderedMessageId = this.messages.length ? this.messages[this.messages.length - 1].id : null;
    this.chat.markRead(t.id, this.role);
    this.loadThreads();
    this.scrollToBottom();
  }

  send(): void {
    if (!this.selectedThread) {
      if (this.role === 'admin') {
        this.toast.error('Select a thread', 'Choose a conversation');
        return;
      }
      this.ensureMyThreadAndSelect();
      if (!this.selectedThread) return;
    }

    try {
      this.chat.sendMessage({
        threadId: this.selectedThread.id,
        fromRole: this.role,
        fromEmail: this.email,
        fromName: this.name,
        body: this.messageText
      });

      this.messageText = '';
      this.messages = this.chat.listMessages(this.selectedThread.id);
      this.lastRenderedMessageId = this.messages.length ? this.messages[this.messages.length - 1].id : null;
      this.loadThreads();
      this.scrollToBottom();
    } catch (e: any) {
      this.toast.error('Message not sent', e?.message || 'Please try again');
    }
  }

  markResolved(): void {
    if (this.role !== 'admin' || !this.selectedThread) return;
    this.chat.setStatus(this.selectedThread.id, 'RESOLVED');
    this.selectedThread = this.chat.getThreadById(this.selectedThread.id);
    this.loadThreads();
  }

  saveCourseLink(): void {
    if (this.role !== 'admin' || !this.selectedThread) return;
    this.chat.setCourseId(this.selectedThread.id, this.courseLinkId);
    this.selectedThread = this.chat.getThreadById(this.selectedThread.id);
    this.loadThreads();
  }

  openCourseReview(): void {
    if (!this.selectedThread?.courseId) {
      this.toast.info('No course linked', 'Add a course ID to open its reviews.');
      return;
    }
    this.router.navigate(['/courses', this.selectedThread.courseId], { fragment: 'reviews' });
  }

  applyQuickReply(text: string): void {
    this.messageText = text;
  }

  manualRefresh(): void {
    this.refreshFromStorage();
  }

  private startPolling(): void {
    if (this.pollHandle) return;
    this.pollHandle = setInterval(() => {
      this.refreshFromStorage();
    }, 1500);
  }

  private refreshFromStorage(): void {
    this.loadThreads();

    if (this.selectedThread) {
      const next = this.chat.listMessages(this.selectedThread.id);
      const nextLastId = next.length ? next[next.length - 1].id : null;
      const changed = nextLastId !== this.lastRenderedMessageId || next.length !== this.messages.length;

      if (changed) {
        this.messages = next;
        this.lastRenderedMessageId = nextLastId;
        this.scrollToBottom();
      }
    }

    this.lastSyncAtIso = new Date().toISOString();
  }

  private updateThreadStats(): void {
    const list = this.threads || [];
    this.openCount = list.filter((t) => t.status === 'OPEN').length;
    this.pendingCount = list.filter((t) => t.status === 'PENDING').length;
    this.resolvedCount = list.filter((t) => t.status === 'RESOLVED').length;
  }

  private scrollToBottom(): void {
    const el = this.messagesPane?.nativeElement;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }
}
