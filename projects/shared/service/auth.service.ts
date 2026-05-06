import { Injectable } from '@angular/core';
import CryptoJS from 'crypto-js';
import { CookieService } from 'ngx-cookie-service';
import { moduleMapping } from 'environment';
import { finalize, Observable, take } from 'rxjs';
import { HttpService } from './http.service';
import { Router } from '@angular/router';
import { EncryptionService } from './encryption.service';
import { AlertService } from 'shared';
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(
    private cookie: CookieService,
    private http: HttpService,
    private router: Router,
    private es: EncryptionService,
    private alertService: AlertService
  ) {}

// projects/shared/src/lib/services/auth.service.ts

  logout() {
    this.http
      .getData('/scoreCardEntry/logout', 'recruitement')
      .pipe(
        finalize(() => {
          // We pass 'false' to indicate this is a intentional logout, not an accidental expiry
          this.clearLocalSession(true);
        })
      )
      .subscribe();
  }

  private clearLocalSession(isManualLogout: boolean = false) {
    this.cookie.deleteAll('/');

    const message = isManualLogout
      ? 'Logged out successfully.'
      : 'Session Expired. Please login again.';

    this.alertService
      .alert(false, message, 1500)
      .then(() => {
        window.open(moduleMapping.loginModule, '_self');
      });
  }
isLoggedIn(): boolean {
  const session = this.cookie.get('session');
  const user = this.cookie.get('user');

  return !!session && !!user;
}

  decryptCookie(cookie: string) {
    try {
      const bytes = CryptoJS.AES.decrypt(cookie, 'UFP_secret_key');
      if (bytes.toString())
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (e) {
      console.log(e);
    }
  }
get currentUser() {
  console.log("Current user function called")
  const user_cookie = this.cookie.get('user');
  const session_cookie = this.cookie.get('session');

  console.group('🔍 AuthService Cookie Debug');
  console.log('1. Raw User Cookie String:', user_cookie);
  console.log('2. Raw Session Cookie String:', session_cookie);

  if (user_cookie && session_cookie) {
    try {
      const decrypted = this.decryptCookie(user_cookie);
      console.log('3. ✅ Decrypted User Object:', decrypted);
      console.groupEnd();
      return decrypted;
    } catch (err) {
      console.error('❌ Decryption Failed:', err);
      console.groupEnd();
      return null;
    }
  } else {
    console.warn('⚠️ No cookies found!');
    console.groupEnd();
  }
  return null;
}

  resetPassword(credentials: any): Observable<any> {
    return this.http.postData(
      '/security/login/changePassword',
      credentials,
      'common'
    );
  }

  refreshCookie(): void {
    this.http
      .getData('/security/refreshSession', 'common')
      .pipe(take(1))
      .subscribe();
  }

  redirect() {
    this.cookie.delete('designation_id');
    // let designation_arr = this.currentUser.designation_arr
    // this.setDesignationID(this.currentUser.designation_arr[0]);
    //console.log(this.currentUser)
    if (this.router.url.includes('user')) {
      this.setModuleID(10);
      this.router.navigate(['/common/']).then();
    } else {
    }
  }

  setDesignationID(designation_id: any) {
    this.cookie.set('designation_id', this.es.encrypt(designation_id), {
      path: '/',
    });
    if (designation_id)
      this.cookie.set('is_extra', String(false), { path: '/' });
    else this.cookie.set('is_extra', String(true), { path: '/' });
  }

  getDesignationID() {
    return this.es.decrypt(this.cookie.get('designation_id')) || undefined;
  }

  setModuleID(module_id: any) {
    this.cookie.set('module_id', this.es.encrypt(module_id), { path: '/' });
  }

  getModuleID(is_decrypt = true) {
    if (is_decrypt) {
      return this.es.decrypt(this.cookie.get('module_id')) || undefined;
    } else {
      return this.cookie.get('module_id') || undefined;
    }
  }
}
