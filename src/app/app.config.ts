import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authTokenInterceptor } from './interceptors/auth-token.interceptor';
import { httpErrorInterceptor } from './interceptors/http-error.interceptor';
import { loadingInterceptor } from './interceptors/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([loadingInterceptor, authTokenInterceptor, httpErrorInterceptor])),
    provideRouter(routes)
  ]
};
