import { Injectable } from '@angular/core';
import CryptoJS from 'crypto-js';
import { CookieService } from 'ngx-cookie-service';
import { moduleMapping } from 'environment';
import { Observable, take } from 'rxjs';
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
    this.http
      .getData('/scoreCardEntry/logout', 'recruitement')
      .subscribe(() => {
        this.cookie.deleteAll('/');

        this.alertService
          .alert(false, 'You have been logged out successfully!', 1500)
          .then(() => {
            window.open(moduleMapping.loginModule, '_self');
          });
      });
  }
  isLoggedIn(): boolean {
    const cookie = this.cookie.get('session');
    return !!cookie;
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
    const user_cookie = this.cookie.get('user');
    const cookie = this.cookie.get('session');
    if (user_cookie && cookie) {
      // Decrypt the data first
      const decryptedData = this.decryptCookie(user_cookie);

      // ✅ ADD THIS LINE to log the data to your browser console
      // console.log('--- DECRYPTED USER DATA ---', decryptedData);

      return decryptedData;
    } else {
      this.logout();
    }
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
