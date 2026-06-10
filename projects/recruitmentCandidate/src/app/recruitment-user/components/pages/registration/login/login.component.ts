import {
  Component,
  EventEmitter,
  Output,
  OnInit,
  ViewChild,
  ElementRef,
  Input,
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
  // --- Context Inputs (Used for Login, but Forgot Reg fetches its own) ---
  @Input() academicSessionId: number | null = null;
  @Input() advertisementId: string | number = '';
  @Input() postCode: number | null = null;
  @Input() subjectId: number | null = null;

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

  // --- View State Manager ---
  activeView: 'LOGIN' | 'FORGOT_PWD' | 'FORGOT_REG' = 'LOGIN';

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
  forgotPwdStep = 1; // 1: RegNo, 2: OTP, 3: New Password
  forgotPwdForm!: FormGroup;
  showNewPassword = false;
  showConfirmPassword = false;
  isProcessingForgotPwd = false;
  forgotPwdUserData: any = null;

  // --- Forgot Registration Flow State ---
  forgotRegStep = 1; // 1: Form, 2: Security Answer, 3: OTP, 4: Show Reg No
  forgotRegForm!: FormGroup;
  isProcessingForgotReg = false;
  fetchedRegData: any = null;

  // --- Dropdown Lists for Forgot Registration ---
  sessionList: any[] = [];
  advList: any[] = [];
  postList: any[] = [];
  subjectList: any[] = [];
  subjectsAvailable = false;

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

    this.forgotPwdForm = this.fb.group({
      registration_no: ['', Validators.required],
      captcha: ['', Validators.required],
      otp: [''],
      new_password: [''],
      confirm_password: ['']
    });

    this.forgotRegForm = this.fb.group({
      academic_session_id: [null, Validators.required],
      a_rec_adv_main_id: [null, Validators.required],
      post_code: [null, Validators.required],
      subject_id: [null],
      mobile_no: ['', [Validators.required, Validators.pattern('^[6-9][0-9]{9}$')]],
      captcha: ['', Validators.required],
      security_answer: [''],
      otp: ['']
    });
  }

  switchView(view: 'LOGIN' | 'FORGOT_PWD' | 'FORGOT_REG') {
    this.activeView = view;
    this.loginError = '';
    this.otpSent = false;
    this.loginOtp = '';

    // Reset all forms
    this.loginForm.reset();
    this.forgotPwdForm.reset();
    this.forgotRegForm.reset();

    // Reset steps
    this.forgotPwdStep = 1;
    this.forgotRegStep = 1;
    this.subjectsAvailable = false;

    this.getCaptcha();

    if (view === 'FORGOT_REG') {
      this.getSessions(); // Load initial dropdown data
    }
  }

  // ========================================================================
  // UTILS & CAPTCHA
  // ========================================================================

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
      error: () => {
        this.loginError = 'Could not load captcha. Please refresh.';
      },
    });
  }

  validateCaptchaLocally(userInput: string): boolean {
    const bytes: any = CryptoJS.AES.decrypt(this.generatedCaptcha, this.captchaKey);
    const txtCaptcha = bytes.toString(CryptoJS.enc.Utf8);
    return userInput === txtCaptcha;
  }

  public onOtpInput(event: any): void {
    const input = event.target as HTMLInputElement;
    if (input.value.length > 6) {
      input.value = input.value.slice(0, 6);
      if (this.otpSent) this.loginOtp = input.value;
    }
  }

  public restrictToNumbers(event: KeyboardEvent): void {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) event.preventDefault();
  }

  togglePasswordVisibility() { this.showPassword = !this.showPassword; }
  toggleNewPasswordVisibility() { this.showNewPassword = !this.showNewPassword; }
  toggleConfirmPasswordVisibility() { this.showConfirmPassword = !this.showConfirmPassword; }

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

    this.httpService.getData(`/publicApi/get/getAdvForLogin?registration_no=${regNo}`, 'recruitement').subscribe({
      next: (res: any) => {
        if (res?.body?.data && res?.body?.data.length > 0) {
          const advId = res?.body?.data[0].a_rec_adv_main_id;
          const sessionId = res?.body?.data[0].session_id;
          this.verifyLinkStatus(advId, sessionId);
        } else {
          this.handleFailedVerification('Registration Number not found or no associated advertisement.');
        }
      },
      error: () => this.handleFailedVerification('Failed to verify Registration Number. Please try again.'),
    });
  }

  private verifyLinkStatus(advId: number, sessionId: number) {
    this.validateLoginCredentials();
  }

  private validateLoginCredentials() {
    const encryptedPassword = CryptoJS.AES.encrypt(this.loginForm.value.password, this.passwordKey).toString();
    const payload = { user_id: this.loginForm.value.user_id, password: encryptedPassword };

    this.alertService.showLoading('Please wait...', 'Validating credentials');
    this.httpService.postData('/publicApi/post/validateLoginCredentials', payload, 'recruitement').subscribe({
      next: (res: any) => {
        if (res?.body?.error) {
          this.alertService.closeAlert();
          this.handleLoginError(res.body.error);
          return;
        }
        this.tempLoginPayload = { password: this.loginForm.value.password, captcha: this.loginForm.value.captcha };
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

  private verifyLoginOtp(): void {
    if (!this.loginOtp) {
      this.alertService.alert(true, 'Please enter OTP.');
      return;
    }
    this.alertService.showLoading('Please wait...', 'Verifying OTP');

    this.httpService.postData(
      '/publicapi/post/verifyRecruitmentOtp',
      { mobile_no: this.verifiedUserData.mobile_no, otp: this.loginOtp, registration_no: this.verifiedUserData.registration_no },
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

  private executeFinalLogin(): void {
    const encryptedPassword = CryptoJS.AES.encrypt(this.tempLoginPayload.password, this.passwordKey).toString();
    const payload = { user_id: this.verifiedUserData.registration_no, password: encryptedPassword, captcha: this.tempLoginPayload.captcha };

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

  private handleFailedVerification(message: string) {
    this.isLoggingIn = false;
    this.alertService.alertMessage('Login Unavailable', message,'info');
    this.loginForm.patchValue({ captcha: '' });
    this.getCaptcha();
  }

  private handleLoginError(error: any) {
    this.isLoggingIn = false;
    this.loginForm.enable();
    const code = error?.code;

    if (code === 'sc012') {
      this.alertService.confirmAlert('Already Logged In', 'This user is logged in elsewhere. Log out other sessions?', 'warning').then((result: SweetAlertResult) => {
        if (result.isConfirmed) this.logoutAllUserByUserId(this.loginForm.value.user_id);
      });
    } else {
      this.loginError = code === 'sc001' ? 'Invalid Registration No.' : (code === 'sc002' ? 'Invalid Registration No. or Password.' : (error?.message || 'An error occurred.'));
      this.alertService.alert(true, this.loginError);
      this.loginForm.patchValue({ password: '', captcha: '' });
      this.getCaptcha();
    }
  }

  logoutAllUserByUserId(userId: string) {
    this.httpService.getData(`/logoutAllUserByUserId/${userId}`).subscribe({
      next: (res: any) => {
        if (res.body && !res.body.error) {
          this.alertService.alert(false, 'Other sessions cleared.', 2000);
          this.onLogin();
        } else {
          this.alertService.alert(true, 'Could not log out other sessions.');
        }
      }
    });
  }

  // ========================================================================
  // FORGOT PASSWORD FLOW
  // ========================================================================

  onForgotPwdStep1() {
    const form = this.forgotPwdForm;
    if (form.get('registration_no')?.invalid || form.get('captcha')?.invalid) {
      form.markAllAsTouched();
      return;
    }

    if (!this.validateCaptchaLocally(form.value.captcha)) {
      this.alertService.alert(true, 'Incorrect captcha.');
      this.getCaptcha();
      form.patchValue({ captcha: '' });
      return;
    }

    this.isProcessingForgotPwd = true;
    this.alertService.showLoading('Please wait...', 'Locating account details');

    const regNo = form.value.registration_no;
    this.httpService.getParam('/publicApi/get/getRegistration', { registration_no: regNo }, 'recruitement').subscribe({
      next: (res: any) => {
        if (!res.body.error && res.body.data && res.body.data.length > 0) {
          this.forgotPwdUserData = res.body.data[0];

          if (!this.forgotPwdUserData.mobile_no) {
            this.alertService.closeAlert();
            this.alertService.alert(true, 'No mobile number is linked to this account.');
            this.isProcessingForgotPwd = false;
            return;
          }
          this.sendOtp('FORGOT_PWD');
        } else {
          this.alertService.closeAlert();
          this.alertService.alert(true, 'Registration Number not found.');
          this.isProcessingForgotPwd = false;
          this.getCaptcha();
          form.patchValue({ captcha: '' });
        }
      },
      error: () => {
        this.alertService.closeAlert();
        this.alertService.alert(true, 'Failed to connect to server.');
        this.isProcessingForgotPwd = false;
      }
    });
  }

  onForgotPwdStep2() {
    const form = this.forgotPwdForm;
    if (!form.value.otp) {
      this.alertService.alert(true, 'Please enter OTP.');
      return;
    }

    this.alertService.showLoading('Please wait...', 'Verifying OTP');
    this.httpService.postData(
      '/publicapi/post/verifyRecruitmentOtp',
      { mobile_no: this.forgotPwdUserData.mobile_no, otp: form.value.otp, registration_no: this.forgotPwdUserData.registration_no },
      'recruitement'
    ).subscribe({
      next: (res: any) => {
        this.alertService.closeAlert();
        if (!res?.body?.data || res.body.data.length === 0) {
          this.alertService.alert(true, 'Invalid or expired OTP.');
          return;
        }
        this.forgotPwdStep = 3;
        this.forgotPwdForm.get('new_password')?.setValidators([Validators.required, Validators.minLength(6)]);
        this.forgotPwdForm.get('confirm_password')?.setValidators([Validators.required]);
        this.forgotPwdForm.get('new_password')?.updateValueAndValidity();
        this.forgotPwdForm.get('confirm_password')?.updateValueAndValidity();
      },
      error: () => {
        this.alertService.closeAlert();
        this.alertService.alert(true, 'Unable to verify OTP.');
      }
    });
  }

  onForgotPwdStep3() {
    const form = this.forgotPwdForm;
    if (form.get('new_password')?.invalid || form.get('confirm_password')?.invalid) {
      form.markAllAsTouched();
      return;
    }
    if (form.value.new_password !== form.value.confirm_password) {
      this.alertService.alert(true, 'Passwords do not match.');
      return;
    }

    this.isProcessingForgotPwd = true;
    this.alertService.showLoading('Please wait...', 'Resetting Password');

    const encryptedPassword = CryptoJS.AES.encrypt(form.value.new_password, this.passwordKey).toString();
    const payload = { registration_no: this.forgotPwdUserData.registration_no, new_password: encryptedPassword };

    this.httpService.postData('/publicApi/post/resetCandidatePassword', payload, 'recruitement').subscribe({
      next: (res: any) => {
        this.isProcessingForgotPwd = false;
        this.alertService.closeAlert();
        if (res?.body?.error) {
          this.alertService.alert(true, res.body.error.message || 'Failed to reset password.');
        } else {
          this.alertService.alert(false, 'Password reset successfully! You can now log in.');
          this.switchView('LOGIN');
        }
      },
      error: (err) => {
        this.isProcessingForgotPwd = false;
        this.alertService.closeAlert();
        this.alertService.alert(true, err?.error?.message || 'Failed to reset password.');
      }
    });
  }

  // ========================================================================
  // FORGOT REGISTRATION FLOW
  // ========================================================================

  getSessions() {
    this.httpService.getData('/publicApi/get/getAcademicSessionForLogin', 'recruitement').subscribe({
      next: (res: any) => { this.sessionList = res?.body?.data || []; }
    });
  }

  onSessionChange() {
    this.forgotRegForm.patchValue({ a_rec_adv_main_id: null, post_code: null, subject_id: null });
    this.advList = []; this.postList = []; this.subjectList = [];
    this.subjectsAvailable = false;

    const sid = this.forgotRegForm.value.academic_session_id;
    if(sid) {
      this.httpService.getParam('/publicApi/get/getLatestAdvertisementForLogin', { academic_session_id: sid }, 'recruitement').subscribe({
        next: (res: any) => { this.advList = res?.body?.data || []; }
      });
    }
  }

  onAdvChange() {
    this.forgotRegForm.patchValue({ post_code: null, subject_id: null });
    this.postList = []; this.subjectList = [];
    this.subjectsAvailable = false;

    const advId = this.forgotRegForm.value.a_rec_adv_main_id;
    if(advId) {
      this.httpService.getParam('/publicApi/get/getPostByAdvertimentForLogin', { a_rec_adv_main_id: advId }, 'recruitement').subscribe({
        next: (res: any) => { this.postList = res?.body?.data || []; }
      });
    }
  }

  onPostChange() {
    this.forgotRegForm.patchValue({ subject_id: null });
    this.subjectList = [];
    this.subjectsAvailable = false;

    const advId = this.forgotRegForm.value.a_rec_adv_main_id;
    const postCode = this.forgotRegForm.value.post_code;
    const selectedPost = this.postList.find(
      (item: any) => item.post_code == postCode
    );

    const a_rec_adv_post_detail_id =
      selectedPost?.a_rec_adv_post_detail_id;
    if(advId && postCode) {
      this.httpService.getParam('/publicApi/get/getSubjectsByPostDetailIdForLogin', { a_rec_adv_main_id: advId, a_rec_adv_post_detail_id: a_rec_adv_post_detail_id }, 'recruitement').subscribe({
        next: (res: any) => {
          this.subjectList = res?.body?.data || [];
          if (this.subjectList.length > 0) {
            this.subjectsAvailable = true;
            this.forgotRegForm.get('subject_id')?.setValidators([Validators.required]);
          } else {
            this.forgotRegForm.get('subject_id')?.clearValidators();
          }
          this.forgotRegForm.get('subject_id')?.updateValueAndValidity();
        }
      });
    }
  }

  onForgotRegStep1() {
    const form = this.forgotRegForm;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    if (!this.validateCaptchaLocally(form.value.captcha)) {
      this.alertService.alert(true, 'Incorrect captcha.');
      this.getCaptcha();
      form.patchValue({ captcha: '' });
      return;
    }

    this.isProcessingForgotReg = true;
    this.alertService.showLoading('Please wait...', 'Fetching Registration details');

    const val = form.value;
    let url = `/publicApi/get/getForgotRegistration?academic_session_id=${val.academic_session_id}&a_rec_adv_main_id=${val.a_rec_adv_main_id}&post_code=${val.post_code}&mobile_no=${val.mobile_no}`;
    if (this.subjectsAvailable && val.subject_id) {
      url += `&subject_id=${val.subject_id}`;
    }

    this.httpService.getData(url, 'recruitement').subscribe({
      next: (res: any) => {
        if (!res.body.error && res.body.data && res.body.data.length > 0) {
          this.fetchedRegData = res.body.data[0];
          this.forgotRegForm.get('security_answer')?.setValidators([Validators.required]);
          this.forgotRegForm.get('security_answer')?.updateValueAndValidity();
          this.forgotRegStep = 2;
          this.alertService.closeAlert();
        } else {
          this.alertService.closeAlert();
          this.alertService.alert(true, 'No registration found for this mobile number in the selected post.');
          this.getCaptcha();
          form.patchValue({ captcha: '' });
        }
        this.isProcessingForgotReg = false;
      },
      error: () => {
        this.alertService.closeAlert();
        this.alertService.alert(true, 'Failed to connect to server.');
        this.isProcessingForgotReg = false;
      }
    });
  }

  onForgotRegStep2() {
    const form = this.forgotRegForm;

    if (form.get('security_answer')?.invalid) {
      form.markAllAsTouched();
      return;
    }

    this.isProcessingForgotReg = true;
    this.alertService.showLoading(
      'Please wait...',
      'Validating Security Answer'
    );

    const payload = {
      academic_session_id: form.value.academic_session_id,
      a_rec_adv_main_id: form.value.a_rec_adv_main_id,
      post_code: form.value.post_code,
      mobile_no: form.value.mobile_no,
      subject_id: form.value.subject_id,
      security_answer: form.value.security_answer
    };

    this.httpService
      .postData(
        '/publicApi/post/validateSecurityAnswer',
        payload,
        'recruitement'
      )
      .subscribe({
        next: (res: any) => {
          this.alertService.closeAlert();

          if (res?.body?.error) {
            this.alertService.alert(
              true,
              res.body.error.message || 'Incorrect security answer.'
            );
            this.isProcessingForgotReg = false;
            return;
          }

          // Store registration number returned by API
          this.fetchedRegData = {
            ...this.fetchedRegData,
            registration_no:
            res?.body?.data?.registration_no
          };

          console.log(
            'Registration Number:',
            this.fetchedRegData.registration_no
          );

          // Send OTP after successful validation
          this.sendOtp('FORGOT_REG');
        },

        error: (err) => {
          console.error(err);

          this.alertService.closeAlert();
          this.alertService.alert(
            true,
            'Failed to validate security answer.'
          );

          this.isProcessingForgotReg = false;
        }
      });
  }

  onForgotRegStep3() {
    const form = this.forgotRegForm;
    if (!form.value.otp) {
      this.alertService.alert(true, 'Please enter OTP.');
      return;
    }

    this.alertService.showLoading('Please wait...', 'Verifying OTP');
    this.httpService.postData(
      '/publicapi/post/verifyRecruitmentOtp',
      { mobile_no: form.value.mobile_no, otp: form.value.otp, registration_no: this.fetchedRegData.registration_no },
      'recruitement'
    ).subscribe({
      next: (res: any) => {
        this.alertService.closeAlert();
        if (!res?.body?.data || res.body.data.length === 0) {
          this.alertService.alert(true, 'Invalid or expired OTP.');
          return;
        }
        this.forgotRegStep = 4;
      },
      error: () => {
        this.alertService.closeAlert();
        this.alertService.alert(true, 'Unable to verify OTP.');
      }
    });
  }
  // ========================================================================
  // SHARED OTP LOGIC
  // ========================================================================

  private sendOtp(purpose: 'LOGIN' | 'FORGOT_REG' | 'FORGOT_PWD') {
    let payload: any = {};

    if (purpose === 'LOGIN') {
      payload = { mobile_no: this.verifiedUserData.mobile_no, email_id: this.verifiedUserData.email_id, registration_no: this.verifiedUserData.registration_no, purpose: 'LOGIN', action_remark: 'Login OTP' };
      this.alertService.showLoading('Please wait...', 'Sending OTP');
    } else if (purpose === 'FORGOT_REG') {
      payload = { mobile_no: this.forgotRegForm.value.mobile_no, registration_no: this.fetchedRegData.registration_no, purpose: 'FORGOT_REGISTRATION', action_remark: 'Forgot Registration OTP' };
    } else if (purpose === 'FORGOT_PWD') {
      payload = { mobile_no: this.forgotPwdUserData.mobile_no, registration_no: this.forgotPwdUserData.registration_no, purpose: 'FORGOT_PASSWORD', action_remark: 'Password Reset OTP' };
    }

    this.httpService.postData('/publicapi/post/saveRecruitmentOtpVerification', payload, 'recruitement').subscribe({
      next: (res: any) => {
        this.alertService.closeAlert();

        const resString = (typeof res === 'string') ? res : JSON.stringify(res);
        if (resString.includes('GEN016') || resString.includes('User not registered')) {
          this.handleOtpError(resString, purpose);
          return;
        }
        if (res?.body?.error) {
          this.handleOtpError(res.body.error, purpose);
          return;
        }

        this.startOtpTimer();
        this.alertService.alert(false, 'OTP sent successfully.');

        if (purpose === 'LOGIN') {
          this.otpSent = true;
          this.isLoggingIn = false;
        } else if (purpose === 'FORGOT_REG') {
          this.forgotRegStep = 3;
          this.isProcessingForgotReg = false;
        } else if (purpose === 'FORGOT_PWD') {
          this.forgotPwdStep = 2;
          this.isProcessingForgotPwd = false;
        }
      },
      error: (err: any) => {
        this.alertService.closeAlert();
        const errorData = err?.error?.error || err?.error || err?.message || JSON.stringify(err);
        this.handleOtpError(errorData, purpose);
      }
    });
  }

  private handleOtpError(errorData: any, purpose: string) {
    this.isLoggingIn = false;
    this.isProcessingForgotReg = false;
    this.isProcessingForgotPwd = false;

    if (purpose === 'LOGIN') this.otpSent = false;
    else if (purpose === 'FORGOT_PWD' && this.forgotPwdStep === 2) this.forgotPwdStep = 1;

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
      if (this.resendSeconds > 0) this.resendSeconds--;
      else { this.canResendOtp = true; clearInterval(this.resendInterval); }
    }, 1000);
  }

  resendOtp() {
    if (!this.canResendOtp) return;
    const purpose = this.activeView === 'LOGIN' ? 'LOGIN' : (this.activeView === 'FORGOT_PWD' ? 'FORGOT_PWD' : 'FORGOT_REG');
    this.sendOtp(purpose);
  }
}
