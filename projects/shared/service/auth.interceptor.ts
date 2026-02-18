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

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  // 1. Add a static flag to track if we are already handling a logout
  private static isLoggingOut = false;

  constructor(private cookie: CookieService, private loaderService: LoaderService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<any>> {
    const designation_id = this.cookie.get('designation_id');
    
    // Safety check for the header
    let modifiedRequest = request;
    if (designation_id) {
      modifiedRequest = request.clone({
        setHeaders: { 'x-designation-id': designation_id }
      });
    }

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