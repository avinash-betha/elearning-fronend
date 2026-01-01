import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoadingService } from '../services/loading.service';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loader-backdrop" *ngIf="loading$ | async">
      <div class="loader-card" role="status" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <div>
          <div class="title">Loading</div>
          <div class="subtitle">Please wait...</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .loader-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 16, 26, 0.35);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .loader-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      border: 1px solid rgba(31, 106, 90, 0.15);
      min-width: 200px;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid rgba(31, 106, 90, 0.2);
      border-top-color: #1f6a5a;
      animation: spin 0.9s linear infinite;
    }

    .title {
      font-weight: 700;
      color: #1f2a2e;
      font-size: 14px;
      letter-spacing: 0.2px;
    }

    .subtitle {
      font-size: 12px;
      color: #5c6b72;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `]
})
export class LoaderComponent {
  readonly loading$;

  constructor(private loading: LoadingService) {
    this.loading$ = this.loading.loading$;
  }
}
