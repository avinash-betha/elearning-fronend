import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  createdAt: number;
}

function newId(): string {
  return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly subject = new BehaviorSubject<ToastMessage[]>([]);
  readonly toasts$ = this.subject.asObservable();

  show(type: ToastType, title: string, message?: string, timeoutMs = 3500): void {
    const toast: ToastMessage = {
      id: newId(),
      type,
      title,
      message,
      createdAt: Date.now()
    };

    this.subject.next([...this.subject.value, toast]);

    window.setTimeout(() => {
      this.dismiss(toast.id);
    }, timeoutMs);
  }

  success(title: string, message?: string): void {
    this.show('success', title, message);
  }

  error(title: string, message?: string): void {
    this.show('error', title, message, 5000);
  }

  info(title: string, message?: string): void {
    this.show('info', title, message);
  }

  dismiss(id: string): void {
    this.subject.next(this.subject.value.filter((t) => t.id !== id));
  }

  clear(): void {
    this.subject.next([]);
  }
}
