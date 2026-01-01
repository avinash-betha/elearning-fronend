import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../services/auth.service';

function normalizeRole(role: unknown): UserRole | '' {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'student' || value === 'instructor' || value === 'admin') return value;
  return '';
}

export function roleGuard(allowed: UserRole[]): CanActivateFn {
  return (_route, state) => {
    const router = inject(Router);
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    if (!isLoggedIn) {
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const role = normalizeRole(localStorage.getItem('userRole'));
    if (!role || !allowed.includes(role)) {
      router.navigate(['/']);
      return false;
    }

    return true;
  };
}
