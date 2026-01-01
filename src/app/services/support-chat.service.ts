import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

export type SupportChatRole = 'student' | 'instructor' | 'admin';
export type SupportThreadStatus = 'OPEN' | 'PENDING' | 'RESOLVED';

export interface SupportChatThread {
  id: string;
  requesterEmail: string;
  requesterName: string;
  requesterRole: Exclude<SupportChatRole, 'admin'>;
  status: SupportThreadStatus;
  createdAtIso: string;
  updatedAtIso: string;
  lastMessagePreview?: string;
  unreadForAdmin: boolean;
  unreadForRequester: boolean;
  courseId?: string;
}

export interface SupportChatMessage {
  id: string;
  threadId: string;
  fromRole: SupportChatRole;
  fromEmail?: string;
  fromName?: string;
  body: string;
  sentAtIso: string;
}

const THREADS_KEY = 'support_threads_v1';
const MESSAGES_KEY = 'support_messages_v1';

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

@Injectable({ providedIn: 'root' })
export class SupportChatService {
  constructor(private storage: StorageService) {}

  listThreadsForAdmin(): SupportChatThread[] {
    return this.getAllThreads().sort((a, b) => (a.updatedAtIso < b.updatedAtIso ? 1 : -1));
  }

  listThreadsForRequester(email: string): SupportChatThread[] {
    const e = normalizeEmail(email);
    return this.getAllThreads().filter((t) => normalizeEmail(t.requesterEmail) === e);
  }

  getThreadById(threadId: string): SupportChatThread | null {
    const id = String(threadId || '').trim();
    if (!id) return null;
    return this.getAllThreads().find((t) => t.id === id) || null;
  }

  getOrCreateMyThread(input: {
    requesterEmail: string;
    requesterName: string;
    requesterRole: Exclude<SupportChatRole, 'admin'>;
  }): SupportChatThread {
    const requesterEmail = normalizeEmail(input.requesterEmail);
    if (!requesterEmail) throw new Error('Not logged in');

    const existing = this.getAllThreads().find((t) => normalizeEmail(t.requesterEmail) === requesterEmail);
    if (existing) return existing;

    const now = new Date().toISOString();
    const thread: SupportChatThread = {
      id: newId('th'),
      requesterEmail,
      requesterName: String(input.requesterName || '').trim() || 'User',
      requesterRole: input.requesterRole,
      status: 'OPEN',
      createdAtIso: now,
      updatedAtIso: now,
      lastMessagePreview: undefined,
      unreadForAdmin: false,
      unreadForRequester: false,
      courseId: undefined
    };

    const all = this.getAllThreads();
    all.push(thread);
    this.saveAllThreads(all);
    return thread;
  }

  listMessages(threadId: string): SupportChatMessage[] {
    const id = String(threadId || '').trim();
    return this.getAllMessages().filter((m) => m.threadId === id).sort((a, b) => (a.sentAtIso > b.sentAtIso ? 1 : -1));
  }

  sendMessage(input: {
    threadId: string;
    fromRole: SupportChatRole;
    fromEmail?: string;
    fromName?: string;
    body: string;
  }): SupportChatMessage {
    const threadId = String(input.threadId || '').trim();
    const body = String(input.body || '').trim();
    if (!threadId) throw new Error('Invalid thread');
    if (!body) throw new Error('Message is required');

    const msg: SupportChatMessage = {
      id: newId('msg'),
      threadId,
      fromRole: input.fromRole,
      fromEmail: input.fromEmail ? normalizeEmail(input.fromEmail) : undefined,
      fromName: input.fromName ? String(input.fromName).trim() : undefined,
      body,
      sentAtIso: new Date().toISOString()
    };

    const allMessages = this.getAllMessages();
    allMessages.push(msg);
    this.saveAllMessages(allMessages);

    const threads = this.getAllThreads();
    const idx = threads.findIndex((t) => t.id === threadId);
    if (idx !== -1) {
      const preview = body.length > 80 ? `${body.slice(0, 77)}...` : body;
      threads[idx] = {
        ...threads[idx],
        updatedAtIso: msg.sentAtIso,
        lastMessagePreview: preview,
        unreadForAdmin: input.fromRole !== 'admin',
        unreadForRequester: input.fromRole === 'admin',
        status: threads[idx].status === 'RESOLVED' ? 'PENDING' : threads[idx].status
      };
      this.saveAllThreads(threads);
    }

    return msg;
  }

  markRead(threadId: string, role: SupportChatRole): void {
    const id = String(threadId || '').trim();
    const threads = this.getAllThreads();
    const idx = threads.findIndex((t) => t.id === id);
    if (idx === -1) return;

    if (role === 'admin') {
      threads[idx] = { ...threads[idx], unreadForAdmin: false };
    } else {
      threads[idx] = { ...threads[idx], unreadForRequester: false };
    }
    this.saveAllThreads(threads);
  }

  setStatus(threadId: string, status: SupportThreadStatus): void {
    const id = String(threadId || '').trim();
    const threads = this.getAllThreads();
    const idx = threads.findIndex((t) => t.id === id);
    if (idx === -1) return;
    threads[idx] = { ...threads[idx], status, updatedAtIso: new Date().toISOString() };
    this.saveAllThreads(threads);
  }

  setCourseId(threadId: string, courseId: string): void {
    const id = String(threadId || '').trim();
    const cid = String(courseId || '').trim();
    const threads = this.getAllThreads();
    const idx = threads.findIndex((t) => t.id === id);
    if (idx === -1) return;
    threads[idx] = { ...threads[idx], courseId: cid || undefined, updatedAtIso: new Date().toISOString() };
    this.saveAllThreads(threads);
  }

  private getAllThreads(): SupportChatThread[] {
    return this.storage.getJson<SupportChatThread[]>(THREADS_KEY, []);
  }

  private saveAllThreads(threads: SupportChatThread[]): void {
    this.storage.setJson(THREADS_KEY, threads);
  }

  private getAllMessages(): SupportChatMessage[] {
    return this.storage.getJson<SupportChatMessage[]>(MESSAGES_KEY, []);
  }

  private saveAllMessages(messages: SupportChatMessage[]): void {
    this.storage.setJson(MESSAGES_KEY, messages);
  }
}
