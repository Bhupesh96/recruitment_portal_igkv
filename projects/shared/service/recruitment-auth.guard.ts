import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, UrlTree } from '@angular/router';
import { AuthService, AlertService } from 'shared'; // ✅ Import AlertService
import {
  RecruitmentStateService
} from '../../recruitmentCandidate/src/app/recruitment-user/components/pages/recruitment-state.service';

@Injectable({
  providedIn: 'root'
})
export class RecruitmentAuthGuard implements CanActivate, CanActivateChild {

  constructor(
    private authService: AuthService,
    private router: Router,
    private stateService: RecruitmentStateService,
    private alertService: AlertService // ✅ Inject AlertService here
  ) {}

  canActivate(): boolean | UrlTree {
    return this.checkLogin();
  }

  canActivateChild(): boolean | UrlTree {
    return this.checkLogin();
  }

  private checkLogin(): boolean | UrlTree {
    // 1. Check if the session cookies exist
    if (this.authService.isLoggedIn()) {

      // Optional: Check if we have the specific recruitment user data loaded
      const userData = this.stateService.getCurrentUserData();
      if (userData && userData.registration_no) {
        return true;
      }

      return true;
    }

    // ✅ 2. Fire the alert so the user knows WHY they are being redirected
    this.alertService.alertMessage(
      'Session Expired',
      'Your session has expired or you are not logged in. Please log in again to continue.',
      'warning'
    );

    // 3. Redirect to the recruitment home/login page
    return this.router.parseUrl('/home');
  }
}
