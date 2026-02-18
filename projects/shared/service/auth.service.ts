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

logout() {
  // Attempt to tell server to logout, but clear client cookies regardless
  this.http
    .getData('/scoreCardEntry/logout', 'recruitement')
    .pipe(
      // finalize runs whether the API succeeds OR fails (401)
      finalize(() => {
        this.clearLocalSession();
      })
    )
    .subscribe({
      next: () => console.log('Server logout successful'),
      error: (err) => console.log('Server logout failed (likely already expired)', err)
    });
}
private clearLocalSession() {
  this.cookie.delete('session', '/');
  this.cookie.delete('user', '/');
  this.cookie.delete('designation_id', '/');
  this.cookie.delete('module_id', '/');
  this.cookie.deleteAll('/'); // Nuclear option

  this.alertService
    .alert(false, 'Session Expired. Please login again.', 1500)
    .then(() => {
      // Use router to navigate to avoid full page reload if possible, 
      // or standard window.open if you need to switch modules
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
