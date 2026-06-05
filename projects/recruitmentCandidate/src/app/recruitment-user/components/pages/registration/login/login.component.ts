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
    import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
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

      @ViewChild('captchaContainer', { static: false }) dataContainer!: ElementRef;
      public captchaKey: any = environment.CAPTCHA_SECRET_KEY;
      public passwordKey: any = environment.PASSWORD_SECRET_KEY;
      public generatedCaptcha: any = '';

      loginForm!: FormGroup;
      showPassword = false;
      loginError = '';
      isLoggingIn = false; // Prevents multiple clicks while APIs are running
      otpSent = false;
      resendSeconds = 30;
      showOtpModal = false;
      canResendOtp = false;

      private resendInterval: any;
      loginOtp = '';

      tempLoginPayload: any = null;

      verifiedUserData: any = null;
      constructor(
        private httpService: HttpService,
        private authService: AuthService,
        private httpClient: HttpClient,
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
        if (this.otpSent) {

          this.verifyLoginOtp();

          return;

        }
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
    // STEP 2: Check Link Management Rules
      private verifyLinkStatus(advId: number, sessionId: number) {
        const linkUrl = `/publicApi/get/getRecruitmentLinkManagementListPublic?list_adv_session_wise=true&a_rec_adv_main_id=${advId}&academic_session_id=${sessionId}`;

        this.httpService.getData(linkUrl, 'recruitement').subscribe({
          next: (res: any) => {
            let isLoginAllowed = false;
            let hasActiveModules = false; // NEW: Track if any actual modules are open
            let errorMsg = 'Login configuration not found for this advertisement.';

            if (res && res?.body?.data) {
              const now = new Date();

              // 1. Check if the Login Link itself is valid and active
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

              // 2. NEW: Check if any functional modules (R, SC, D) are currently open
              res.body.data.forEach((link: any) => {
                const type = link.isHeadingYN;
                if (link.Live_YN === 'Y' && ['R', 'SC', 'D'].includes(type)) {
                  const startDate = new Date(link.startDate.replace(' ', 'T'));
                  const endDate = new Date(link.endDate.replace(' ', 'T'));
                  if (now >= startDate && now <= endDate) {
                    hasActiveModules = true; // Found at least one open module!
                  }
                }
              });
            }

            // Final Validation: Login must be allowed AND at least one module must be open
            if (isLoginAllowed && hasActiveModules) {
              this.validateLoginCredentials();
            } else if (isLoginAllowed && !hasActiveModules) {
              // Block login because there's nothing to do inside
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

            // ✅ 1. Save the EXACT credentials that were validated
            this.tempLoginPayload = {
              password: this.loginForm.value.password,
              captcha: this.loginForm.value.captcha
            };

            // ✅ 2. Lock the UI form to prevent DOM tampering
            this.loginForm.disable();

            this.verifiedUserData = res?.body?.data;
            this.sendLoginOtp();
          },
          error: (err) => {
            this.alertService.closeAlert();
            this.handleLoginError(err?.error?.error);
          }
        });
      }
      private sendLoginOtp() {
        const payload = {
          mobile_no: this.verifiedUserData.mobile_no,
          email_id: this.verifiedUserData.email_id,
          registration_no: this.verifiedUserData.registration_no,
          purpose: 'LOGIN',
          action_remark: 'Login OTP'
        };

        this.alertService.showLoading('Please wait...', 'Sending OTP');

        this.httpService.postData(
          '/publicapi/post/saveRecruitmentOtpVerification',
          payload,
          'recruitement'
        ).subscribe({
          next: (res: any) => {
            this.alertService.closeAlert();

            // 1. Convert the entire response to a string to catch sneaky XML payloads in success block
            const resString = (typeof res === 'string') ? res : JSON.stringify(res);

            // 2. Check if the Sandes error is hiding inside the "success" response
            if (resString.includes('GEN016') || resString.includes('User not registered')) {
              this.handleOtpError(resString);
              return; // Stop execution here!
            }

            // 3. Normal error check
            if (res?.body?.error) {
              this.handleOtpError(res.body.error);
              return;
            }

            // 4. If we passed all checks, it's a true success
            this.otpSent = true;
            this.startOtpTimer();
            this.alertService.alert(false, 'OTP sent successfully.');
            this.isLoggingIn = false;
          },
          error: (err: any) => {
            this.alertService.closeAlert();

            // Pass whatever error object or string the HTTP client caught
            const errorData = err?.error?.error || err?.error || err?.message || JSON.stringify(err);
            this.handleOtpError(errorData);
          }
        });
      }

      // Helper method to parse Sandes gateway errors
      private handleOtpError(errorData: any) {
        this.isLoggingIn = false;
        this.otpSent = false; // FORCE the UI to stay on the login form

        // Safely convert the error payload to a string
        const errString = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);

        // Check for Sandes specific error code or message
        if (errString.includes('GEN016') || errString.includes('User not registered')) {

          this.alertService.alertMessage(
            'App Registration Required',
            'User not registered in Sandes app. Please get registered first.',
            'info'
          );

          // Automatically open the instructional modal with the QR code
          this.showOtpModal = true;

        } else {
          // Standard error fallback
          const defaultMsg = errorData?.message || 'Unable to send OTP.';
          this.alertService.alert(true, defaultMsg);
        }
      }

      startOtpTimer() {

        this.canResendOtp = false;

        this.resendSeconds = 30;

        clearInterval(
          this.resendInterval
        );

        this.resendInterval =
          setInterval(() => {

            if (
              this.resendSeconds > 0
            ) {

              this.resendSeconds--;

            }

            else {

              this.canResendOtp = true;

              clearInterval(
                this.resendInterval
              );

            }

          }, 1000);

      }resendOtp() {

        if (!this.canResendOtp) {
          return;
        }

        this.sendLoginOtp();

      }
      private verifyLoginOtp() {

        if (!this.loginOtp) {

          this.alertService.alert(

            true,

            'Please enter OTP.'

          );

          return;

        }

        this.alertService.showLoading(

          'Please wait...',

          'Verifying OTP'

        );

        this.httpService.postData(

          '/publicapi/post/verifyRecruitmentOtp',

          {

            mobile_no:
            this.verifiedUserData.mobile_no,

            otp:
            this.loginOtp,
            registration_no: this.verifiedUserData.registration_no

          },

          'recruitement'

        ).subscribe({

          next: (res: any) => {

            this.alertService.closeAlert();

            if (
              !res?.body?.data ||
              res.body.data.length === 0
            ) {

              this.alertService.alert(

                true,

                'Invalid or expired OTP.'

              );

              return;

            }

            // OTP verified
            this.executeFinalLogin();

          },

          error: () => {

            this.alertService.closeAlert();

            this.alertService.alert(

              true,

              'Unable to verify OTP.'

            );

          }

        });

      }
      // STEP 3: Execute the Actual Login Payload
      private executeFinalLogin() {
        const encryptedPassword = CryptoJS.AES.encrypt(
          this.tempLoginPayload.password, // ✅ Use the frozen password
          this.passwordKey
        ).toString();

        const payload = {
          // ✅ Use the ID returned by the server, ignoring the frontend form entirely
          user_id: this.verifiedUserData.registration_no,
          password: encryptedPassword,
          captcha: this.tempLoginPayload.captcha,
        };

        this.httpService
          .postData('/scoreCardEntry/login/', payload, 'recruitement')
          .subscribe({
            next: (response: any) => {
              this.isLoggingIn = false;
              this.loginForm.enable(); // Unlock on success
              if (response.body && !response.body.error) {
                this.alertService.alert(false, 'Login successful!', 2000);
                this.loginSuccess.emit();
              } else {
                this.handleLoginError(response.body.error);
              }
            },
            error: (err: HttpErrorResponse) => {
              this.isLoggingIn = false;
              this.loginForm.enable(); // Unlock on failure
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
        // ✅ FIX: Force the UI to unlock anytime a login error occurs
        this.isLoggingIn = false;
        this.loginForm.enable();

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
