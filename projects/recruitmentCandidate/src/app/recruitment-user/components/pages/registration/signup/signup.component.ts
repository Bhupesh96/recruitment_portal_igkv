  import {
    Component,
    OnInit,
    Input,
    Output,
    EventEmitter,
    ViewChild,
    ElementRef,
  } from '@angular/core';
  import {CommonModule} from '@angular/common';
  import {FormsModule} from '@angular/forms';
  import {HttpService} from 'shared';
  import {environment} from 'environment';
  import CryptoJS from 'crypto-js';
  import {AlertService} from 'shared';
  import {EncryptionService} from 'shared';
  import {OnChanges, SimpleChanges} from '@angular/core';
  import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
  import {InputTooltipDirective} from '../../../../../directives/input-tooltip.directive'
  @Component({
    selector: 'app-signup',
    standalone: true,
    imports: [CommonModule, FormsModule,InputTooltipDirective],
    templateUrl: './signup.component.html',
  })
  export class SignupComponent implements OnInit, OnChanges {
    @Input() academicSessionId: number | null = null;
    @Input() advertisementId: string = '';
    @Input() postCode: number | null = null;
    @Input() subjectId: number | null = null;
    @Input() subjectsAvailable: boolean = false;
    @Output() loginClicked = new EventEmitter<void>();
    @ViewChild('captchaContainer', {static: false}) dataContainer!: ElementRef;
    public captchaKey: any = environment.CAPTCHA_SECRET_KEY;
    public passwordKey: any = environment.PASSWORD_SECRET_KEY;
    public generatedCaptcha: any = '';
    user: any;
    pass: any;
    mobile = '';
    email = '';
    password = '';
    confirmPassword = '';
    captchaError = '';
    userAnswer = '';
    showOtpModal = true;
    // OTP
    otpMobile = '';
    otpEmail = '';
    enteredOtpMobile = '';
    enteredOtpEmail = '';
    isVerified = false;
    otpSent = false;
    resendCooldown = 0;
    cooldownInterval: any;
    passwordValidationMessage = '';
    showConfirmPassword = false;
    confirmPasswordMessage = '';
    // Validation and status flags
    mobileError = '';
    emailError = '';
    otpError = '';
    otpSuccess = '';
    signupError = '';
    signupSuccess = '';
    showSuccessAlert = false;
    categoryList: any[] = [];
    selectedCategory: number | null = null;
    securityQuestionList: any[] = [];
    selectedSecurityQuestion: number | null = null;
    securityAnswer = '';
    passwordErrors = {
      capital: false,
      lowercase: false,
      number: false,
      special: false,
      length: false,
    };
    isPasswordStrong = false;

    constructor(
      private http: HttpService,
      private httpClient: HttpClient,
      private alertService: AlertService,
      private encryptionService: EncryptionService
    ) {
    }

    get buttonLabel(): string {
      if (!this.otpSent) return 'Send OTP';
      if (!this.isVerified) return 'Verify';
      return 'Register';
    }

    onLoginClick() {
      this.loginClicked.emit();
    }

    ngOnInit() {
      this.getCaptcha();
      this.getCategoryList();
      this.getSecurityQuestions();
    }
    getSecurityQuestions() {
      this.http
        .getData(
          '/publicApi/get/getSecurityQuestions',
          'recruitement'
        )
        .subscribe({
          next: (res: any) => {
            if (!res?.body?.error) {
              this.securityQuestionList = res?.body?.data || [];
            }
          },
          error: (err) => {
            console.error('Error loading security questions', err);
          }
        });
    }
    ngOnChanges(changes: SimpleChanges): void {
      if (
        changes['advertisementId'] ||
        changes['postCode'] ||
        changes['subjectId']
      ) {
        this.getCategoryList();
      }
    }

    getCaptcha() {
      this.http.getData(`/getCaptcha`).subscribe((res: any) => {
        if (!res.body.error) {
          this.dataContainer.nativeElement.innerHTML = res.body.result.svg;
          this.generatedCaptcha = res.body.result.captcha;
        }
      });
    }

    getCategoryList() {
      if (!this.advertisementId || !this.postCode || this.subjectId === null) {
        return;
      }

      const params = {
        subject_category: true,
        a_rec_adv_main_id: this.advertisementId,
        post_code: this.postCode,
        subject_id: this.subjectId ?? 0,
      };

      this.http
        .getParam('/publicapi/get/getAdvCategoryList', params, 'recruitement')
        .subscribe({
          next: (res: any) => {
            if (!res.body.error) {
              this.categoryList = res.body.data;
            }
          },
          error: (err) => {
            console.error('Error fetching categories', err);
          },
        });
    }

    validateMobileAndEmail(): boolean {
      let isValid = true;
      this.mobileError = '';
      this.emailError = '';

      if (!this.mobile) {
        this.mobileError = 'Mobile number is required';
        isValid = false;
      } else if (!/^\d{10}$/.test(this.mobile)) {
        this.mobileError = 'Please enter a valid 10-digit mobile number';
        isValid = false;
      }

      if (!this.email) {
        this.emailError = 'Email is required';
        isValid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
        this.emailError = 'Please enter a valid email address';
        isValid = false;
      }

      return isValid;
    }

    sendOtp() {
      // Validate
      if (!this.validateMobileAndEmail()) {
        return;
      }

      // Loader
      this.alertService.showLoading(
        'Please wait...',
        'Checking registration'
      );

      const subject = this.subjectId !== null ? this.subjectId : 0;
      const checkUrl = `/publicApi/get/getRegistration?checkRegistration=true&mobile_no=${this.mobile}&email_id=${this.email}&a_rec_adv_main_id=${this.advertisementId}&post_code=${this.postCode}&subject_id=${subject}`;

      this.http.getData(checkUrl, 'recruitement').subscribe({
        next: (checkRes: any) => {
          // Already Registered
          if (checkRes?.body?.data?.length > 0) {
            this.alertService.closeAlert();
            this.alertService.alertMessage(
              'Warning',
              'You have already registered for this specific Post and Subject.',
              'warning'
            );
            return;
          }

          // STEP 2: Send OTP
          const payload = {
            mobile_no: this.mobile,
            email_id: this.email,
            purpose: 'REGISTRATION',
            action_remark: 'OTP generated for recruitment signup'
          };

          this.alertService.showLoading('Please wait...', 'Sending OTP');

          this.http.postData(
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

              // 3. Normal backend JSON error check
              if (res?.body?.error) {
                this.handleOtpError(res.body.error);
                return;
              }

              // 4. True Success
              this.alertService.alertMessage(
                'Success',
                'OTP sent successfully to your mobile number.',
                'success'
              );
              this.otpSent = true;
              this.startResendCooldown();
            },
            error: (err: any) => {
              console.error(err);
              // Pass whatever error object or string the HTTP client caught
              const errorData = err?.error?.error || err?.error || err?.message || JSON.stringify(err);
              this.handleOtpError(errorData);
            }
          });
        },
        error: (err: any) => {
          this.alertService.closeAlert();
          console.error(err);
          this.alertService.alertMessage('Error', 'Unable to validate registration.', 'error');
        }
      });
    }

    // NEW: Helper method to parse Sandes gateway errors for Signup
    private handleOtpError(errorData: any) {
      this.alertService.closeAlert();
      this.otpSent = false; // FORCE the UI to stay on the signup form

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
        const defaultMsg = typeof errorData === 'object' && errorData?.message ? errorData.message : 'Unable to send OTP.';
        this.alertService.alertMessage('Warning', defaultMsg, 'warning');
      }
    }



    startResendCooldown(seconds: number = 30) {
      this.resendCooldown = seconds;
      clearInterval(this.cooldownInterval);
      this.cooldownInterval = setInterval(() => {
        this.resendCooldown--;
        if (this.resendCooldown <= 0) {
          clearInterval(this.cooldownInterval);
        }
      }, 1000);
    }

    verifyCaptchaAndSendOtp() {
      const bytes: any = CryptoJS.AES.decrypt(
        this.generatedCaptcha,
        this.captchaKey
      );
      let txtCaptcha = bytes.toString(CryptoJS.enc.Utf8);

      if (this.userAnswer !== txtCaptcha) {
        this.alertService.alert(true, 'Incorrect captcha');
        this.getCaptcha(); // refresh captcha
        return;
      }
      this.sendOtp();
    }

    isPasswordValid(): boolean {
      const regex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
      return regex.test(this.password);
    }

    validatePassword(): void {
      const pwd = this.password;
      const errors = [];

      if (!/[A-Z]/.test(pwd)) errors.push('uppercase letter');
      if (!/[a-z]/.test(pwd)) errors.push('lowercase letter');
      if (!/\d/.test(pwd)) errors.push('number');
      if (!/[!@#$%^&*]/.test(pwd)) errors.push('special character');
      if (pwd.length < 8) errors.push('minimum 8 characters');

      this.isPasswordStrong = errors.length === 0;

      this.passwordValidationMessage = this.isPasswordStrong
        ? 'Password is strong'
        : 'Password must include: ' + errors.join(', ');
    }

    checkPasswordMatch(): void {
      if (!this.confirmPassword) {
        this.confirmPasswordMessage = '';
        return;
      }

      this.confirmPasswordMessage =
        this.password === this.confirmPassword
          ? 'Passwords match'
          : 'Passwords do not match';
    }

    handleAction() {
      this.signupError = '';

      if (!this.otpSent) {
        if (!this.validateMobileAndEmail()) {
          return;
        }
        this.verifyCaptchaAndSendOtp();
      } else if (!this.isVerified) {

        // Validate OTP
        if (!this.enteredOtpMobile) {

          this.alertService.alertMessage(

            'Warning',

            'Please enter OTP.',

            'warning'

          );

          return;

        }

        // Loader
        this.alertService.showLoading(

          'Please wait...',

          'Verifying OTP'

        );

        // Verify OTP API
        this.http.postData(

          '/publicapi/post/verifyRecruitmentOtp',

          {

            mobile_no: this.mobile,

            otp: this.enteredOtpMobile

          },

          'recruitement'

        ).subscribe({

          next: (res: any) => {

            this.alertService.closeAlert();

            // Invalid OTP
            if (
              !res?.body?.data ||
              res.body.data.length === 0
            ) {

              this.alertService.alertMessage(

                'Warning',

                'Invalid or expired OTP.',

                'warning'

              );

              return;

            }

            // Success
            this.isVerified = true;

            this.alertService.alertMessage(

              'Success',

              'OTP verification successful. Please set your password.',

              'success'

            );

          },

          error: (err: any) => {

            this.alertService.closeAlert();

            console.error(err);

            this.alertService.alertMessage(

              'Error',

              'Unable to verify OTP.',

              'error'

            );

          }

        });

      } else {
        this.onSignup();
      }
    }

    onSignup() {
      this.signupError = '';
      this.signupSuccess = '';
      if (!this.selectedCategory) {
        this.alertService.alert(true, 'Please select a category.');
        return;
      }

      // --- All your existing validation logic remains here ---
      if (this.subjectsAvailable && this.subjectId === null) {
        this.alertService.alert(true, 'Please select a subject for the post.');
        return; // Stop the signup process
      }
      if (!this.isVerified) {
        this.alertService.alert(true, 'Please verify OTP first.');
        return;
      }
      if (this.subjectId === null) {
        this.alertService.alert(true, 'Please select a subject for the post.');
        return;
      }
      if (!/^\d{10}$/.test(this.mobile)) {
        this.signupError = 'Please enter a valid 10-digit mobile number';
        return;
      }
      if (!this.isPasswordValid()) {
        this.signupError =
          'Password must include uppercase, lowercase, number, special character, and be at least 8 characters long.';
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.alertService.alert(true, 'Passwords do not match');
        return;
      }
      if (!this.academicSessionId || !this.advertisementId || !this.postCode) {
        this.alertService.alert(
          true,
          'Please select a session, advertisement, and post'
        );
        return;
      }
      // --- End of validation ---

      const encryptedPassword = CryptoJS.AES.encrypt(
        this.password,
        this.passwordKey
      ).toString();
      if (!this.selectedSecurityQuestion) {
        this.alertService.alert(
          true,
          'Please select a security question.'
        );
        return;
      }

      if (!this.securityAnswer?.trim()) {
        this.alertService.alert(
          true,
          'Please enter security answer.'
        );
        return;
      }
      const payload = {
        mobile_no: this.mobile,
        email_id: this.email,
        password: encryptedPassword,
        academic_session_id: this.academicSessionId,
        a_rec_adv_main_id: this.advertisementId,
        post_code: this.postCode,
        subject_id: this.subjectId,
        category_id: this.selectedCategory,
        security_question_id: this.selectedSecurityQuestion,
        security_answer: this.securityAnswer
      };

      // ✅ 2. Call your backend API
      // IMPORTANT: Replace '/publicapi/register/saveCandidateRegistrationDetail' with your actual endpoint
      this.http
        .postData(
          '/publicapi/post/saveCandidateRegistrationDetail',
          payload,
          'recruitement'
        )
        .subscribe({
          next: async (res) => {
            if (res?.body?.error) {
              this.alertService.alert(
                true,
                res.body.error.message || 'An error occurred.'
              );
              return;
            }
            const registrationNo = res?.body?.data?.registration_no;
            // Success handling
            this.signupSuccess = 'Registration successful';
            this.showSuccessAlert = true;
            // this.alertService.alert(
            //   false,
            //   `Registration successful!
            //   Your Registration Number: ${registrationNo}
            //   Please save this number for login.`
            // );
            this.alertService.alertMessage(   `Registration successful!
              Your Registration Number: ${registrationNo}`, 'Please save this number for login.', 'success');
          },
          error: (err) => {
            console.error(err);
            this.alertService.alert(true, 'Something went wrong.');
          },
        });
    }
  }
