import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

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
  @Output() loginClicked = new EventEmitter<void>();

  onLoginClick() {
    this.loginClicked.emit();
  }
  mobile = '';
  email = '';
  password = '';
  confirmPassword = '';

  // Captcha
  num1 = 0;
  num2 = 0;
  userAnswer = '';
  captchaError = '';

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
  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.generateCaptcha();
  }

  generateCaptcha() {
    this.num1 = Math.floor(Math.random() * 10);
    this.num2 = Math.floor(Math.random() * 10);
    this.userAnswer = '';
    this.captchaError = '';
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

    this.otpSuccess = 'OTPs sent to mobile and email';
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
    const correctAnswer = this.num1 + this.num2;
    if (parseInt(this.userAnswer) !== correctAnswer) {
      this.captchaError = 'Incorrect captcha answer';
      this.generateCaptcha();
      return;
    }
    this.captchaError = '';
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
    this.otpError = '';
    this.signupError = '';
    this.signupSuccess = '';

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
        this.otpSuccess =
          'OTP verification successful. Please set your password.';
      } else {
        this.otpError = 'Invalid OTP(s). Please try again.';
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

    if (!this.isVerified) {
      if (
        this.enteredOtpMobile === this.otpMobile &&
        this.enteredOtpEmail === this.otpEmail
      ) {
        this.isVerified = true;
        this.otpSuccess =
          'OTP verification successful. Please set your password.';
      } else {
        this.otpError = 'Invalid OTP(s). Please try again.';
      }
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
      this.signupError = 'Passwords do not match';
      return;
    }

    if (!this.academicSessionId || !this.advertisementId || !this.postCode) {
      this.signupError = 'Please select a session, advertisement, and post.';
      return;
    }

    const signupData = {
      mobile: this.mobile,
      email: this.email,
      password: this.password,
      academic_session_id: this.academicSessionId,
      a_rec_adv_main_id: this.advertisementId,
      post_code: this.postCode,
    };

    // this.http.post('http://localhost:3000/api/signup', signupData).subscribe({
    //   next: (response: any) => {
    //     this.signupSuccess = response.message || 'User registered successfully';
    //     this.mobile = '';
    //     this.email = '';
    //     this.password = '';
    //     this.confirmPassword = '';
    //     this.isVerified = false;
    //     this.otpSent = false;
    //     this.otpSuccess = '';
    //     this.generateCaptcha();
    //     this.showSuccessAlert = true;
    //     setTimeout(() => {
    //       this.showSuccessAlert = false;
    //       this.loginClicked.emit(); // Switch to login template
    //     }, 3000);
    //   },
    //   error: (error) => {
    //     this.signupError = error.error?.message || 'Registration failed';
    //     if (error.status === 409) {
    //       this.generateCaptcha();
    //     }
    //   },
    // });
  }
}
