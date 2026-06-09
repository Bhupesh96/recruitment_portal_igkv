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
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpService, AlertService, AuthService } from 'shared';
import { Router } from '@angular/router';
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

  @ViewChild('captchaContainer', { static: false }) set content(content: ElementRef) {
    if (content) {
      this.dataContainer = content;
      if (this.currentCaptchaSvg) {
        this.dataContainer.nativeElement.innerHTML = this.currentCaptchaSvg;
      }
    }
  }

  private dataContainer!: ElementRef;
  public captchaKey: any = environment.CAPTCHA_SECRET_KEY;
  public passwordKey: any = environment.PASSWORD_SECRET_KEY;
  public generatedCaptcha: any = '';
  private currentCaptchaSvg: string = '';

  // --- Login State ---
  loginForm!: FormGroup;
  showPassword = false;
  loginError = '';
  isLoggingIn = false;
  otpSent = false;
  loginOtp = '';
  tempLoginPayload: any = null;
  verifiedUserData: any = null;

  // --- OTP Modal State ---
  resendSeconds = 30;
  showOtpModal = false;
  canResendOtp = false;
  private resendInterval: any;

  // --- Forgot Password State ---
  isForgotPasswordMode = false;
  forgotPasswordStep = 1; // 1: RegNo, 2: OTP, 3: New Password
  forgotPasswordForm!: FormGroup;
  showNewPassword = false;
  showConfirmPassword = false;
  isProcessingForgotPw = false;
  forgotPasswordUserData: any = null; // ✅ Store fetched user details silently

  constructor(
    private httpService: HttpService,
    private authService: AuthService,
    private httpClient: HttpClient,
    private alertService: AlertService,
    private router: Router,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.createForms();
    this.getCaptcha();
  }

  createForms() {
    this.loginForm = this.fb.group({
      user_id: ['', Validators.required],
      password: ['', Validators.required],
      captcha: ['', Validators.required],
    });

    // ✅ REMOVED mobile_no from the form!
    this.forgotPasswordForm = this.fb.group({
      registration_no: ['', Validators.required],
      captcha: ['', Validators.required],
      otp: [''],
      new_password: [''],
      confirm_password: ['']
    });
  }

  getCaptcha() {
    this.httpService.getData(`/getCaptcha`).subscribe({
      next: (res: any) => {
        if (res.body && !res.body.error) {
          this.currentCaptchaSvg = res.body.result.svg;
          this.generatedCaptcha = res.body.result.captcha;
          if (this.dataContainer) {
            this.dataContainer.nativeElement.innerHTML = this.currentCaptchaSvg;
          }
        }
      },
      error: (err) => {
        console.error('Failed to load captcha', err);
        this.loginError = 'Could not load captcha. Please refresh.';
      },
    });
  }

  validateCaptchaLocally(userInput: string): boolean {
    const bytes: any = CryptoJS.AES.decrypt(this.generatedCaptcha, this.captchaKey);
    const txtCaptcha = bytes.toString(CryptoJS.enc.Utf8);
    return userInput === txtCaptcha;
  }
//  New helper to enforce 6-digit limit strictly
  public onOtpInput(event: any): void {
    const input = event.target as HTMLInputElement;
    if (input.value.length > 6) {
      input.value = input.value.slice(0, 6);

      // Sync back to the model if using [(ngModel)] (for loginOtp)
      if (this.otpSent) {
        this.loginOtp = input.value;
      }
    }
  }

  //  Keeps your existing number restriction
  public restrictToNumbers(event: KeyboardEvent): void {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }
  // ========================================================================
  // CORE LOGIN FLOW
  // ========================================================================

  onLogin() {
    this.loginError = '';
    if (this.otpSent) {
      this.verifyLoginOtp();
      return;
    }

    if (this.loginForm.invalid) {
      this.loginError = 'Please fill in all required fields.';
      return;
    }

    if (!this.validateCaptchaLocally(this.loginForm.value.captcha)) {
      this.alertService.alert(true, 'Incorrect captcha. Please try again.');
      this.getCaptcha();
      this.loginForm.patchValue({ captcha: '' });
      return;
    }

    this.isLoggingIn = true;

    const regNo = this.loginForm.value.user_id;
    this.httpService
      .getData(`/publicApi/get/getAdvForLogin?registration_no=${regNo}`, 'recruitement')
      .subscribe({
        next: (res: any) => {
          if (res?.body?.data && res?.body?.data.length > 0) {
            const advId = res?.body?.data[0].a_rec_adv_main_id;
            const sessionId = res?.body?.data[0].session_id;
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

  private verifyLinkStatus(advId: number, sessionId: number) {
    const linkUrl = `/publicApi/get/getRecruitmentLinkManagementListPublic?list_adv_session_wise=true&a_rec_adv_main_id=${advId}&academic_session_id=${sessionId}`;

    this.httpService.getData(linkUrl, 'recruitement').subscribe({
      next: (res: any) => {
        let isLoginAllowed = false;
        let hasActiveModules = false;
        let errorMsg = 'Login configuration not found for this advertisement.';

        if (res && res?.body?.data) {
          const now = new Date();
          const loginLink = res?.body?.data.find((item: any) => item.isHeadingYN === 'A');

          if (loginLink) {
            const startDate = new Date(loginLink.startDate.replace(' ', 'T'));
            const endDate = new Date(loginLink.endDate.replace(' ', 'T'));

            const formatDateTime = (d: Date) => {
              const pad = (n: number) => n.toString().padStart(2, '0');
              return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            };

            if (loginLink.Live_YN !== 'Y') {
              errorMsg = 'Login is currently disabled by administrators.';
            } else if (now < startDate || now > endDate) {
              errorMsg = `Login portal is only available between ${formatDateTime(startDate)} and ${formatDateTime(endDate)}.`;
            } else {
              isLoginAllowed = true;
            }
          }

          res.body.data.forEach((link: any) => {
            const type = link.isHeadingYN;
            if (link.Live_YN === 'Y' && ['R', 'SC', 'D'].includes(type)) {
              const startDate = new Date(link.startDate.replace(' ', 'T'));
              const endDate = new Date(link.endDate.replace(' ', 'T'));
              if (now >= startDate && now <= endDate) hasActiveModules = true;
            }
          });
        }

        if (isLoginAllowed && hasActiveModules) {
          this.validateLoginCredentials();
        } else if (isLoginAllowed && !hasActiveModules) {
          this.handleFailedVerification('There are no active application forms, score cards, or objection links open at this time.');
        } else {
          this.handleFailedVerification(errorMsg);
        }
      },
      error: (err) => {
        this.handleFailedVerification('Failed to verify link status. Please try again.');
      },
    });
  }

  private validateLoginCredentials() {
    const encryptedPassword = CryptoJS.AES.encrypt(
      this.loginForm.value.password,
      this.passwordKey
    ).toString();

    const payload = {
      user_id: this.loginForm.value.user_id,
      password: encryptedPassword
    };

    this.alertService.showLoading('Please wait...', 'Validating credentials');

    this.httpService.postData('/publicApi/post/validateLoginCredentials', payload, 'recruitement').subscribe({
      next: (res: any) => {
        if (res?.body?.error) {
          this.alertService.closeAlert();
          this.handleLoginError(res.body.error);
          return;
        }

        this.tempLoginPayload = {
          password: this.loginForm.value.password,
          captcha: this.loginForm.value.captcha
        };

        this.loginForm.disable();
        this.verifiedUserData = res?.body?.data;
        this.sendOtp('LOGIN');
      },
      error: (err) => {
        this.alertService.closeAlert();
        this.handleLoginError(err?.error?.error);
      }
    });
  }

  private verifyLoginOtp() {
    if (!this.loginOtp) {
      this.alertService.alert(true, 'Please enter OTP.');
      return;
    }

    this.alertService.showLoading('Please wait...', 'Verifying OTP');

    this.httpService.postData(
      '/publicapi/post/verifyRecruitmentOtp',
      {
        mobile_no: this.verifiedUserData.mobile_no,
        otp: this.loginOtp,
        registration_no: this.verifiedUserData.registration_no
      },
      'recruitement'
    ).subscribe({
      next: (res: any) => {
        this.alertService.closeAlert();
        if (!res?.body?.data || res.body.data.length === 0) {
          this.alertService.alert(true, 'Invalid or expired OTP.');
          return;
        }
        this.executeFinalLogin();
      },
      error: () => {
        this.alertService.closeAlert();
        this.alertService.alert(true, 'Unable to verify OTP.');
      }
    });
  }

  private executeFinalLogin() {
    const encryptedPassword = CryptoJS.AES.encrypt(
      this.tempLoginPayload.password,
      this.passwordKey
    ).toString();

    const payload = {
      user_id: this.verifiedUserData.registration_no,
      password: encryptedPassword,
      captcha: this.tempLoginPayload.captcha,
    };

    this.httpService.postData('/scoreCardEntry/login/', payload, 'recruitement').subscribe({
      next: (response: any) => {
        this.isLoggingIn = false;
        this.loginForm.enable();
        if (response.body && !response.body.error) {
          this.alertService.alert(false, 'Login successful!', 2000);
          this.loginSuccess.emit();
        } else {
          this.handleLoginError(response.body.error);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isLoggingIn = false;
        this.loginForm.enable();
        this.handleLoginError(err.error?.error);
        this.loginForm.patchValue({ password: '' });
        this.getCaptcha();
      },
    });
  }

  // ========================================================================
  // FORGOT PASSWORD FLOW (Streamlined)
  // ========================================================================

  toggleForgotPasswordMode(enable: boolean) {
    this.isForgotPasswordMode = enable;
    this.loginError = '';

    if (enable) {
      this.forgotPasswordStep = 1;
      this.forgotPasswordForm.reset();
      this.forgotPasswordForm.enable();
      this.forgotPasswordUserData = null; // Clear cached user data
      this.getCaptcha();
    } else {
      this.loginForm.reset();
      this.loginForm.enable();
      this.otpSent = false;
      this.loginOtp = '';
      this.getCaptcha();
    }
  }

  onForgotPasswordRequestOtp() {
    const form = this.forgotPasswordForm;
    if (form.get('registration_no')?.invalid || form.get('captcha')?.invalid) {
      form.markAllAsTouched();
      return;
    }

    if (!this.validateCaptchaLocally(form.value.captcha)) {
      this.alertService.alert(true, 'Incorrect captcha. Please try again.');
      this.getCaptcha();
      form.patchValue({ captcha: '' });
      return;
    }

    this.isProcessingForgotPw = true;
    this.alertService.showLoading('Please wait...', 'Locating account details');

    // ✅ NEW: Fetch the user's mobile number silently before sending OTP
    const regNo = form.value.registration_no;
    this.httpService.getParam('/publicApi/get/getRegistration', { registration_no: regNo }, 'recruitement').subscribe({
      next: (res: any) => {
        if (!res.body.error && res.body.data && res.body.data.length > 0) {
          this.forgotPasswordUserData = res.body.data[0];

          if (!this.forgotPasswordUserData.mobile_no) {
            this.alertService.closeAlert();
            this.alertService.alert(true, 'No mobile number is linked to this account.');
            this.isProcessingForgotPw = false;
            return;
          }

          // Move to sending OTP
          this.sendOtp('FORGOT_PASSWORD');
        } else {
          this.alertService.closeAlert();
          this.alertService.alert(true, 'Registration Number not found in our records.');
          this.isProcessingForgotPw = false;
          this.getCaptcha();
          form.patchValue({ captcha: '' });
        }
      },
      error: () => {
        this.alertService.closeAlert();
        this.alertService.alert(true, 'Failed to connect to server. Please try again.');
        this.isProcessingForgotPw = false;
      }
    });
  }

  onForgotPasswordVerifyOtp() {
    const form = this.forgotPasswordForm;
    if (!form.value.otp) {
      this.alertService.alert(true, 'Please enter the OTP.');
      return;
    }

    this.alertService.showLoading('Please wait...', 'Verifying OTP');

    this.httpService.postData(
      '/publicapi/post/verifyRecruitmentOtp',
      {
        mobile_no: this.forgotPasswordUserData.mobile_no, // ✅ Use the fetched mobile
        otp: form.value.otp,
        registration_no: this.forgotPasswordUserData.registration_no
      },
      'recruitement'
    ).subscribe({
      next: (res: any) => {
        this.alertService.closeAlert();
        if (!res?.body?.data || res.body.data.length === 0) {
          this.alertService.alert(true, 'Invalid or expired OTP.');
          return;
        }
        // Success
        this.forgotPasswordStep = 3;

        // Add dynamic validators for passwords now that we reached step 3
        this.forgotPasswordForm.get('new_password')?.setValidators([Validators.required, Validators.minLength(6)]);
        this.forgotPasswordForm.get('confirm_password')?.setValidators([Validators.required]);
        this.forgotPasswordForm.get('new_password')?.updateValueAndValidity();
        this.forgotPasswordForm.get('confirm_password')?.updateValueAndValidity();

      },
      error: () => {
        this.alertService.closeAlert();
        this.alertService.alert(true, 'Unable to verify OTP.');
      }
    });
  }

  onResetPasswordSubmit() {
    const form = this.forgotPasswordForm;
    if (form.get('new_password')?.invalid || form.get('confirm_password')?.invalid) {
      form.markAllAsTouched();
      return;
    }

    if (form.value.new_password !== form.value.confirm_password) {
      this.alertService.alert(true, 'Passwords do not match.');
      return;
    }

    this.isProcessingForgotPw = true;
    this.alertService.showLoading('Please wait...', 'Resetting Password');

    const encryptedPassword = CryptoJS.AES.encrypt(
      form.value.new_password,
      this.passwordKey
    ).toString();

    const payload = {
      registration_no: this.forgotPasswordUserData.registration_no,
      new_password: encryptedPassword
    };

    this.httpService.postData('/publicApi/post/resetCandidatePassword', payload, 'recruitement').subscribe({
      next: (res: any) => {
        this.isProcessingForgotPw = false;
        this.alertService.closeAlert();

        if (res?.body?.error) {
          this.alertService.alert(true, res.body.error.message || 'Failed to reset password.');
        } else {
          this.alertService.alert(false, 'Password reset successfully! You can now log in.');
          this.toggleForgotPasswordMode(false); // Return to login
        }
      },
      error: (err) => {
        this.isProcessingForgotPw = false;
        this.alertService.closeAlert();
        this.alertService.alert(true, err?.error?.message || 'Failed to reset password.');
      }
    });
  }

  // ========================================================================
  // SHARED OTP LOGIC
  // ========================================================================

  private sendOtp(purpose: 'LOGIN' | 'FORGOT_PASSWORD') {
    let payload: any = {};

    if (purpose === 'LOGIN') {
      payload = {
        mobile_no: this.verifiedUserData.mobile_no,
        email_id: this.verifiedUserData.email_id,
        registration_no: this.verifiedUserData.registration_no,
        purpose: 'LOGIN',
        action_remark: 'Login OTP'
      };
    } else {
      payload = {
        mobile_no: this.forgotPasswordUserData.mobile_no, // ✅ Use fetched mobile
        registration_no: this.forgotPasswordUserData.registration_no,
        purpose: 'FORGOT_PASSWORD',
        action_remark: 'Password Reset OTP'
      };
    }

    // No need to call showLoading again if it's already active from previous steps
    if (purpose === 'LOGIN') {
      this.alertService.showLoading('Please wait...', 'Sending OTP');
    }

    this.httpService.postData('/publicapi/post/saveRecruitmentOtpVerification', payload, 'recruitement').subscribe({
      next: (res: any) => {
        this.alertService.closeAlert();

        const resString = (typeof res === 'string') ? res : JSON.stringify(res);
        if (resString.includes('GEN016') || resString.includes('User not registered')) {
          this.handleOtpError(resString);
          return;
        }
        if (res?.body?.error) {
          this.handleOtpError(res.body.error);
          return;
        }

        this.startOtpTimer();
        this.alertService.alert(false, 'OTP sent successfully.');

        if (purpose === 'LOGIN') {
          this.otpSent = true;
          this.isLoggingIn = false;
        } else {
          this.forgotPasswordStep = 2;
          this.isProcessingForgotPw = false;
        }
      },
      error: (err: any) => {
        this.alertService.closeAlert();
        const errorData = err?.error?.error || err?.error || err?.message || JSON.stringify(err);
        this.handleOtpError(errorData);
      }
    });
  }

  private handleOtpError(errorData: any) {
    this.isLoggingIn = false;
    this.isProcessingForgotPw = false;

    if (this.isForgotPasswordMode && this.forgotPasswordStep === 2) {
      this.forgotPasswordStep = 1; // Kick back to step 1
    } else {
      this.otpSent = false;
    }

    const errString = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);

    if (errString.includes('GEN016') || errString.includes('User not registered')) {
      this.alertService.alertMessage('App Registration Required', 'User not registered in Sandes app. Please get registered first.', 'info');
      this.showOtpModal = true;
    } else {
      const defaultMsg = errorData?.message || 'Unable to send OTP.';
      this.alertService.alert(true, defaultMsg);
    }
  }

  startOtpTimer() {
    this.canResendOtp = false;
    this.resendSeconds = 30;
    clearInterval(this.resendInterval);
    this.resendInterval = setInterval(() => {
      if (this.resendSeconds > 0) {
        this.resendSeconds--;
      } else {
        this.canResendOtp = true;
        clearInterval(this.resendInterval);
      }
    }, 1000);
  }

  resendOtp() {
    if (!this.canResendOtp) return;
    this.sendOtp(this.isForgotPasswordMode ? 'FORGOT_PASSWORD' : 'LOGIN');
  }

  // ========================================================================
  // UTILS
  // ========================================================================

  togglePasswordVisibility() { this.showPassword = !this.showPassword; }
  toggleNewPasswordVisibility() { this.showNewPassword = !this.showNewPassword; }
  toggleConfirmPasswordVisibility() { this.showConfirmPassword = !this.showConfirmPassword; }

  private handleFailedVerification(message: string) {
    this.isLoggingIn = false;
    this.alertService.alertMessage('Login Unavailable', message,'info');
    this.loginForm.patchValue({ captcha: '' });
    this.getCaptcha();
  }

  logoutAllUserByUserId(userId: string) {
    this.httpService.getData(`/logoutAllUserByUserId/${userId}`).subscribe({
      next: (res: any) => {
        if (res.body && !res.body.error) {
          this.alertService.alert(false, 'Other sessions cleared. Logging you in automatically...', 2000);
          this.onLogin();
        } else {
          this.alertService.alert(true, 'Could not log out other sessions. Please try again later.');
          this.loginForm.patchValue({ password: '', captcha: '' });
          this.getCaptcha();
        }
      },
      error: (err) => {
        this.alertService.alert(true, 'An error occurred while trying to log out other sessions.');
        this.loginForm.patchValue({ password: '', captcha: '' });
        this.getCaptcha();
      },
    });
  }

  private handleLoginError(error: any) {
    this.isLoggingIn = false;
    this.loginForm.enable();

    if (error?.code) {
      switch (error.code) {
        case 'sc012':
          this.alertService
            .confirmAlert('Already Logged In', 'This user is already logged in elsewhere. Do you want to log out all other sessions and log in here?', 'warning')
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
