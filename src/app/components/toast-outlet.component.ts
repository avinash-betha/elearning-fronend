import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-outlet',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite" aria-relevant="additions removals">
      <div
        class="toast"
        *ngFor="let t of (toastService.toasts$ | async)"
        [class.success]="t.type === 'success'"
        [class.error]="t.type === 'error'"
        [class.info]="t.type === 'info'"
        role="status"
      >
        <div class="toast-body">
          <div class="toast-title">{{ t.title }}</div>
          <div class="toast-message" *ngIf="t.message">{{ t.message }}</div>
        </div>
        <button type="button" class="toast-close" (click)="toastService.dismiss(t.id)" aria-label="Dismiss">
          <span class="material-icons">close</span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .toast-stack {
        position: fixed;
        top: 16px;
        right: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        z-index: 2000;
        width: min(360px, calc(100vw - 32px));
      }

      .toast {
        background: white;
        border: 1px solid #e2e8f0;
        border-left-width: 4px;
        border-radius: 12px;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
        padding: 12px 12px 12px 14px;
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }

      .toast.success {
        border-left-color: #22c55e;
      }

      .toast.error {
        border-left-color: #ef4444;
      }

      .toast.info {
        border-left-color: #1f6a5a;
      }

      .toast-title {
        font-weight: 700;
        color: #1f2937;
        font-size: 14px;
        margin-bottom: 2px;
      }

      .toast-message {
        color: #4b5563;
        font-size: 13px;
        line-height: 1.4;
      }

      .toast-close {
        margin-left: auto;
        border: none;
        background: none;
        cursor: pointer;
        color: #64748b;
        padding: 4px;
        border-radius: 8px;
      }

      .toast-close:hover {
        background: #f1f5f9;
        color: #334155;
      }

      .toast-close .material-icons {
        font-size: 18px;
      }
    `
  ]
})
export class ToastOutletComponent {
  constructor(public toastService: ToastService) {}
}

