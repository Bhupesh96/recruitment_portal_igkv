import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { LoaderService } from "./loader.service";
import { catchError, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { moduleMapping } from "environment";
import { CookieService } from "ngx-cookie-service";
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  // 1. Add a static flag to track if we are already handling a logout
  private static isLoggingOut = false;

  constructor(
    private cookie: CookieService,
    private auth: AuthService,
    private loaderService: LoaderService
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (
      request.url.includes('/google-api') ||
      request.url.includes('inputtools.google.com')
    ) {
      return next.handle(request);
    }
    const designation_id = this.cookie.get('designation_id');
    const token = this.auth.getToken || this.cookie.get('token') || localStorage.getItem('token');
    const headers: Record<string, string> = {};

    if (designation_id) {
      headers['x-designation-id'] = designation_id;
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const modifiedRequest = Object.keys(headers).length
      ? request.clone({ setHeaders: headers })
      : request;

    this.loaderService.show();

    return next.handle(modifiedRequest).pipe(
      catchError((err: HttpErrorResponse) => {

        // 2. Handle 401 (Unauthorized) - Only execute if not already logging out
        if (err.status === 401) {
          if (!AuthInterceptor.isLoggingOut) {
            AuthInterceptor.isLoggingOut = true; // Lock the door

            // Optional: Hide loader immediately so it doesn't get stuck
            this.loaderService.hide();

            Swal.fire({
              title: 'Session Expired',
              text: 'You have been logged out (possibly logged in elsewhere).',
              icon: 'warning',
              allowOutsideClick: false,
              allowEscapeKey: false,
              confirmButtonText: 'Login Again'
            }).then(() => {
              // Clear cookies and redirect
              this.cookie.deleteAll('/');
              window.open(moduleMapping.loginModule, '_self');

              // Reset flag after redirect (though page reload usually clears it)
              AuthInterceptor.isLoggingOut = false;
            });
          }
          // If isLoggingOut is already true, we suppress subsequent 401 alerts
          return throwError(() => new Error('Session expired - multiple requests cancelled'));
        }

        // 3. Handle 0 (Server Connection Error)
        if (err.status === 0) {
           Swal.fire({ title: 'Server Not Connected', icon: 'error' });
        }

        const error = err.error?.message || err.statusText;
        return throwError(() => new Error(error));
      }),
      finalize(() => {
        // Only hide loader if we aren't in the middle of a logout redirect sequence
        if (!AuthInterceptor.isLoggingOut) {
            this.loaderService.hide();
        }
      })
    );
  }
}
