import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        auth.clearSession();
        router.navigate(['/login']);
      } else if (err.status === 403) {
        // Avoid noisy toasts for background GETs (e.g., nav counters).
        if (req.method !== 'GET') {
          toast.error('Access denied', 'You do not have permission to perform this action.');
        }
      } else if (err.status >= 500) {
        toast.error('Server error', 'Please try again shortly.');
      }
      return throwError(() => err);
    })
  );
};
