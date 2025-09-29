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

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule], // Added ReactiveFormsModule
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  @Output() loginSuccess = new EventEmitter<void>();
  @Output() signupClicked = new EventEmitter<void>(); // For "Don't have an account?" link

  // --- Captcha Setup ---
  @ViewChild('captchaContainer', { static: false }) dataContainer!: ElementRef;
  public captchaKey: any = environment.CAPTCHA_SECRET_KEY;
  public passwordKey: any = environment.PASSWORD_SECRET_KEY;
  public generatedCaptcha: any = '';

  // --- Reactive Form ---
  loginForm!: FormGroup;
  showPassword = false;

  // --- Status Messages ---
  loginError = '';

  constructor(
    private httpService: HttpService,
    private authService: AuthService,
    private alertService: AlertService,
    private router: Router,
    private fb: FormBuilder // Injected FormBuilder
  ) {}

  ngOnInit(): void {
    this.createForm();
    this.getCaptcha();
  }

  createForm() {
    this.loginForm = this.fb.group({
      // The backend expects 'user_id', which maps to our registrationNo
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

  onLogin() {
    this.loginError = '';
    if (this.loginForm.invalid) {
      this.loginError = 'Please fill in all required fields.';
      return;
    }

    // 1. Validate Captcha
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

    // 2. Encrypt Password
    const encryptedPassword = CryptoJS.AES.encrypt(
      this.loginForm.value.password,
      this.passwordKey
    ).toString();

    // 3. Create Payload for the backend
    const payload = {
      user_id: this.loginForm.value.user_id,
      password: encryptedPassword,
      captcha: this.loginForm.value.captcha,
    };

    // 4. Make API Call
    this.httpService
      .postData('/scoreCardEntry/login/', payload, 'recruitement')
      .subscribe({
        next: (response: any) => {
          if (response.body && !response.body.error) {
            this.alertService.alert(false, 'Login successful!', 2000);
            this.loginSuccess.emit(); // Notify parent component of success
          } else {
            this.handleLoginError(response.body.error);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.handleLoginError(err.error?.error); // Error object might be nested
          this.loginForm.patchValue({ password: '' }); // Clear password field on error
          this.getCaptcha();
        },
      });
  }

  // Helper function to handle specific error codes from the backend
  private handleLoginError(error: any) {
    if (error?.code) {
      switch (error.code) {
        case 'sc012':
          this.loginError = 'This user is already logged in elsewhere.';
          // Optional: Implement force logout logic here if needed
          break;
        case 'sc002':
          this.loginError = 'Invalid Registration No. or Password.';
          break;
        case 'sc001':
          this.loginError = 'Invalid Registration No.';
          break;
        default:
          this.loginError = error.message || 'An unknown login error occurred.';
          break;
      }
    } else {
      this.loginError = 'An unknown error occurred. Please try again.';
    }
    this.alertService.alert(true, this.loginError);
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}
