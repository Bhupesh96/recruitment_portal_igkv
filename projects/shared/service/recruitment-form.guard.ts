import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, catchError, of, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { HttpService, AuthService, AlertService } from 'shared';

@Injectable({
  providedIn: 'root',
})
export class RecruitmentFormGuard implements CanActivate {
  constructor(
    private httpService: HttpService,
    private authService: AuthService,
    private alertService: AlertService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    const user = this.authService.currentUser;

    // If no user, immediately redirect
    if (!user) {
      return of(this.router.parseUrl('/home'));
    }

    const advId = user?.a_rec_adv_main_id || user?.advertisement_id;
    const sessionId = user?.academic_session_id || user?.session_id;

    const url =
      `/master/get/getRecruitmentLinkManagementList` +
      `?list_adv_session_wise=true` +
      `&a_rec_adv_main_id=${advId}` +
      `&academic_session_id=${sessionId}`;

    return this.httpService.getData(url, 'recruitement').pipe(
      switchMap((res: any): Observable<boolean | UrlTree> => {
        const data = res?.body?.data || res?.data || [];
        const now = new Date();

        const hasAccess = data.some((link: any) => {
          if (link.isHeadingYN === 'R' && link.Live_YN === 'Y') {
            const start = new Date(link.startDate.replace(' ', 'T'));
            const end = new Date(link.endDate.replace(' ', 'T'));
            return now >= start && now <= end;
          }
          return false;
        });

        if (hasAccess) {
          return of(true); // Allow access
        }

        // ACCESS DENIED: Show Alert, then redirect
        // ✅ FIX: Extract the promise and explicitly cast it as Promise<UrlTree>
        const alertPromise = this.alertService.alertMessage(
          'Form Closed',
          'The Recruitment Form is currently closed or not yet active.',
          'info'
        ).then(() => {
          this.authService.logout();
          return this.router.parseUrl('/home');
        }) as Promise<UrlTree>; // <--- Explicit cast here

        return from(alertPromise);
      }),
      catchError((): Observable<UrlTree> => {
        return of(this.router.parseUrl('/home'));
      })
    );
  }
}
