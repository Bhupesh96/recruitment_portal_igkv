import {
  Component,
  EventEmitter,
  Output,
  OnInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpService, AlertService, AuthService } from 'shared';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from 'environment';
import CryptoJS from 'crypto-js';
import { SweetAlertResult } from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  @Output() loginSuccess = new EventEmitter<void>();
  @Output() signupClicked = new EventEmitter<void>();

  @ViewChild('captchaContainer', { static: false }) dataContainer!: ElementRef;
  public captchaKey: any = environment.CAPTCHA_SECRET_KEY;
  public passwordKey: any = environment.PASSWORD_SECRET_KEY;
  public generatedCaptcha: any = '';

  loginForm!: FormGroup;
  showPassword = false;
  loginError = '';
  isLoggingIn = false; // Prevents multiple clicks while APIs are running

  constructor(
    private httpService: HttpService,
    private authService: AuthService,
    private alertService: AlertService,
    private router: Router,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.createForm();
    this.getCaptcha();
  }

  createForm() {
    this.loginForm = this.fb.group({
      user_id: ['', Validators.required],
      password: ['', Validators.required],
      captcha: ['', Validators.required],
    });
  }

  getCaptcha() {
    this.httpService.getData(`/getCaptcha`).subscribe({
      next: (res: any) => {
        if (res.body && !res.body.error && this.dataContainer) {
          this.dataContainer.nativeElement.innerHTML = res.body.result.svg;
          this.generatedCaptcha = res.body.result.captcha;
        }
      },
      error: (err) => {
        console.error('Failed to load captcha', err);
        this.loginError = 'Could not load captcha. Please refresh.';
      },
    });
  }

  // ========================================================================
  // CORE LOGIN FLOW (3 Steps)
  // ========================================================================

  onLogin() {
    this.loginError = '';

    if (this.loginForm.invalid) {
      this.loginError = 'Please fill in all required fields.';
      return;
    }

    // Local Captcha Validation
    const bytes: any = CryptoJS.AES.decrypt(
      this.generatedCaptcha,
      this.captchaKey
    );
    const txtCaptcha = bytes.toString(CryptoJS.enc.Utf8);

    if (this.loginForm.value.captcha !== txtCaptcha) {
      this.alertService.alert(true, 'Incorrect captcha. Please try again.');
      this.getCaptcha();
      this.loginForm.patchValue({ captcha: '' });
      return;
    }

    this.isLoggingIn = true; // Lock the button

    // STEP 1: Fetch Advertisement & Session ID for the given Registration Number
    const regNo = this.loginForm.value.user_id;
    this.httpService
      .getData(`/publicApi/get/getAdvForLogin?registration_no=${regNo}`, 'recruitement')
      .subscribe({
        next: (res: any) => {
          if (res?.body?.data && res?.body?.data.length > 0) {
            console.log('Recruitement recruitement recruitement', JSON.stringify(res?.body?.data, null, 2));
            const advId = res?.body?.data[0].a_rec_adv_main_id;
            const sessionId = res?.body?.data[0].session_id;

            // Proceed to Step 2
            this.verifyLinkStatus(advId, sessionId);
          } else {
            this.handleFailedVerification('Registration Number not found or no associated advertisement.');
          }
        },
        error: (err) => {
          this.handleFailedVerification('Failed to verify Registration Number. Please try again.');
        },
      });
  }

  // STEP 2: Check Link Management Rules
  private verifyLinkStatus(advId: number, sessionId: number) {
    const linkUrl = `/publicApi/get/getRecruitmentLinkManagementListPublic?list_adv_session_wise=true&a_rec_adv_main_id=${advId}&academic_session_id=${sessionId}`;

    this.httpService.getData(linkUrl, 'recruitement').subscribe({
      next: (res: any) => {
        let isAllowed = false;
        let errorMsg = 'Login configuration not found for this advertisement.';

        if (res && res?.body?.data) {
          const loginLink = res?.body?.data.find((item: any) => item.linkname === 'Login');

          if (loginLink) {
            const now = new Date();
            const startDate = new Date(loginLink.startDate.replace(' ', 'T'));
            const endDate = new Date(loginLink.endDate.replace(' ', 'T'));

            // Helper function to format Date to DD-MM-YYYY HH:mm:ss
            const formatDateTime = (d: Date) => {
              const pad = (n: number) => n.toString().padStart(2, '0');
              return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            };

            if (loginLink.Live_YN !== 'Y') {
              errorMsg = 'Login is currently disabled by administrators.';
            } else if (now < startDate || now > endDate) {
              // Use the formatted dates in the error message
              errorMsg = `Login portal is only available between ${formatDateTime(startDate)} and ${formatDateTime(endDate)}.`;
            } else {
              isAllowed = true;
            }
          }
        }

        if (isAllowed) {
          // Proceed to Step 3
          this.executeFinalLogin();
        } else {
          this.handleFailedVerification(errorMsg);
        }
      },
      error: (err) => {
        this.handleFailedVerification('Failed to verify link status. Please try again.');
      },
    });
  }

  // STEP 3: Execute the Actual Login Payload
  private executeFinalLogin() {
    const encryptedPassword = CryptoJS.AES.encrypt(
      this.loginForm.value.password,
      this.passwordKey
    ).toString();

    const payload = {
      user_id: this.loginForm.value.user_id,
      password: encryptedPassword,
      captcha: this.loginForm.value.captcha,
    };

    this.httpService
      .postData('/scoreCardEntry/login/', payload, 'recruitement')
      .subscribe({
        next: (response: any) => {
          this.isLoggingIn = false; // Unlock button
          if (response.body && !response.body.error) {
            this.alertService.alert(false, 'Login successful!', 2000);
            this.loginSuccess.emit();
          } else {
            this.handleLoginError(response.body.error);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.isLoggingIn = false; // Unlock button
          this.handleLoginError(err.error?.error);
          this.loginForm.patchValue({ password: '' });
          this.getCaptcha();
        },
      });
  }

  // Helper for Steps 1 & 2 Failures
  private handleFailedVerification(message: string) {
    this.isLoggingIn = false;
    this.alertService.alertMessage('Login Unavailable', message,'info');
    this.loginForm.patchValue({ captcha: '' });
    this.getCaptcha();
  }

  // ========================================================================
  // SESSION MANAGEMENT & UTILS
  // ========================================================================

  logoutAllUserByUserId(userId: string) {
    this.httpService.getData(`/logoutAllUserByUserId/${userId}`).subscribe({
      next: (res: any) => {
        if (res.body && !res.body.error) {
          this.alertService.alert(
            false,
            'Other sessions cleared. Logging you in automatically...',
            2000
          );
          this.onLogin(); // Re-trigger the whole flow
        } else {
          this.alertService.alert(
            true,
            'Could not log out other sessions. Please try again later.'
          );
          this.loginForm.patchValue({ password: '', captcha: '' });
          this.getCaptcha();
        }
      },
      error: (err) => {
        console.error('Failed to logout all users:', err);
        this.alertService.alert(
          true,
          'An error occurred while trying to log out other sessions.'
        );
        this.loginForm.patchValue({ password: '', captcha: '' });
        this.getCaptcha();
      },
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  private handleLoginError(error: any) {
    if (error?.code) {
      switch (error.code) {
        case 'sc012':
          this.alertService
            .confirmAlert(
              'Already Logged In',
              'This user is already logged in elsewhere. Do you want to log out all other sessions and log in here?',
              'warning'
            )
            .then((result: SweetAlertResult) => {
              if (result.isConfirmed) {
                this.logoutAllUserByUserId(this.loginForm.value.user_id);
              } else {
                this.loginForm.patchValue({ password: '', captcha: '' });
                this.getCaptcha();
              }
            });
          break;

        case 'sc002':
          this.loginError = 'Invalid Registration No. or Password.';
          this.alertService.alert(true, this.loginError);
          this.loginForm.patchValue({ password: '', captcha: '' });
          this.getCaptcha();
          break;

        case 'sc001':
          this.loginError = 'Invalid Registration No.';
          this.alertService.alert(true, this.loginError);
          this.loginForm.patchValue({ captcha: '' });
          this.getCaptcha();
          break;

        default:
          this.loginError = error.message || 'An unknown login error occurred.';
          this.alertService.alert(true, this.loginError);
          this.loginForm.patchValue({ captcha: '' });
          this.getCaptcha();
          break;
      }
    } else {
      this.loginError = 'An unknown error occurred. Please try again.';
      this.alertService.alert(true, this.loginError);
      this.loginForm.patchValue({ captcha: '' });
      this.getCaptcha();
    }
  }
}
