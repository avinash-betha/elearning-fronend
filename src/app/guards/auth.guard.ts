import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  // Check if user is logged in (UI-level only, using localStorage)
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  
  if (isLoggedIn) {
    return true;
  } else {
    // Redirect to login page with return URL
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
};
