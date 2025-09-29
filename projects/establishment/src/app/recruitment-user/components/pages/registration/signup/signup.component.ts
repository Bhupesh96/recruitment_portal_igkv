import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpService } from 'shared';
import { environment } from 'environment';
import CryptoJS from 'crypto-js';
import { AlertService } from 'shared';
import { EncryptionService } from 'shared';
@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signup.component.html',
})
export class SignupComponent implements OnInit {
  @Input() academicSessionId: number | null = null;
  @Input() advertisementId: string = '';
  @Input() postCode: number | null = null;
  @Input() subjectId: number | null = null;
  @Input() subjectsAvailable: boolean = false;
  @Output() loginClicked = new EventEmitter<void>();
  @ViewChild('captchaContainer', { static: false }) dataContainer!: ElementRef;
  public captchaKey: any = environment.CAPTCHA_SECRET_KEY;
  public passwordKey: any = environment.PASSWORD_SECRET_KEY;
  public generatedCaptcha: any = '';
  user: any;
  pass: any;
  onLoginClick() {
    this.loginClicked.emit();
  }
  mobile = '';
  email = '';
  password = '';
  confirmPassword = '';
  captchaError = '';
  userAnswer = '';
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
  constructor(
    private http: HttpService,
    private alertService: AlertService,
    private encryptionService: EncryptionService
  ) {}

  ngOnInit() {
    this.getCaptcha();
  }

  getCaptcha() {
    this.http.getData(`/getCaptcha`).subscribe((res: any) => {
      if (!res.body.error) {
        this.dataContainer.nativeElement.innerHTML = res.body.result.svg;
        this.generatedCaptcha = res.body.result.captcha;
      }
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
    this.otpMobile = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpEmail = Math.floor(100000 + Math.random() * 900000).toString();

    console.log(`OTP to mobile: ${this.otpMobile}`);
    console.log(`OTP to email: ${this.otpEmail}`);

    this.alertService.alert(false, 'OTPs sent to mobile and email');
    this.otpSent = true;
    this.startResendCooldown();
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

  passwordErrors = {
    capital: false,
    lowercase: false,
    number: false,
    special: false,
    length: false,
  };

  isPasswordStrong = false;

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
      if (
        this.enteredOtpMobile === this.otpMobile &&
        this.enteredOtpEmail === this.otpEmail
      ) {
        this.isVerified = true;
        this.alertService.alert(
          false,
          'OTP verification successful. Please set your password'
        );
      } else {
        this.alertService.alert(true, 'Invalid OTP(s). Please try again');
      }
    } else {
      this.onSignup();
    }
  }

  get buttonLabel(): string {
    if (!this.otpSent) return 'Send OTP';
    if (!this.isVerified) return 'Verify';
    return 'Register';
  }

  onSignup() {
    this.signupError = '';
    this.signupSuccess = '';

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

    const payload = {
      mobile_no: this.mobile,
      email_id: this.email,
      password: encryptedPassword,
      academic_session_id: this.academicSessionId,
      a_rec_adv_main_id: this.advertisementId,
      post_code: this.postCode,
      subject_id: this.subjectId,
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

          // Success handling
          this.signupSuccess = 'Registration successful';
          this.showSuccessAlert = true;
          this.alertService.alert(false, 'Registration successful');
        },
        error: (err) => {
          console.error(err);
          this.alertService.alert(true, 'Something went wrong.');
        },
      });
  }
}
