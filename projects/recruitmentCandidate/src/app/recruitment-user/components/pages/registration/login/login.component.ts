import {
  Component,
  EventEmitter,
  Output,
  OnInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {HttpService, AlertService, AuthService} from 'shared';
import {Router} from '@angular/router';
import {HttpErrorResponse} from '@angular/common/http';
import {environment} from 'environment';
import CryptoJS from 'crypto-js';
import {SweetAlertResult} from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  @Output() loginSuccess = new EventEmitter<void>();
  @Output() signupClicked = new EventEmitter<void>();

  @ViewChild('captchaContainer', {static: false}) dataContainer!: ElementRef;
  public captchaKey: any = environment.CAPTCHA_SECRET_KEY;
  public passwordKey: any = environment.PASSWORD_SECRET_KEY;
  public generatedCaptcha: any = '';

  loginForm!: FormGroup;
  showPassword = false;
  loginError = '';

  constructor(
    private httpService: HttpService,
    private authService: AuthService,
    private alertService: AlertService,
    private router: Router,
    private fb: FormBuilder
  ) {
  }

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

  onLogin() {
    this.loginError = '';
    if (this.loginForm.invalid) {
      this.loginError = 'Please fill in all required fields.';
      return;
    }

    const bytes: any = CryptoJS.AES.decrypt(
      this.generatedCaptcha,
      this.captchaKey
    );
    const txtCaptcha = bytes.toString(CryptoJS.enc.Utf8);

    if (this.loginForm.value.captcha !== txtCaptcha) {
      this.alertService.alert(true, 'Incorrect captcha. Please try again.');
      this.getCaptcha();
      this.loginForm.patchValue({captcha: ''});
      return;
    }

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
          console.log('Login response:', JSON.stringify(response));
          if (response.body && !response.body.error) {
            this.alertService.alert(false, 'Login successful!', 2000);
            this.loginSuccess.emit();
          } else {
            this.handleLoginError(response.body.error);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.handleLoginError(err.error?.error);
          this.loginForm.patchValue({password: ''});
          this.getCaptcha();
        },
      });
  }

  logoutAllUserByUserId(userId: string) {
    this.httpService.getData(`/logoutAllUserByUserId/${userId}`).subscribe({
      next: (res: any) => {
        if (res.body && !res.body.error) {
          // Notify the user briefly, then automatically trigger the login process again
          this.alertService.alert(
            false,
            'Other sessions cleared. Logging you in automatically...',
            2000
          );

          // Trigger login automatically
          this.onLogin();
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
                // User clicked OK -> Log them out of other devices and auto-login
                this.logoutAllUserByUserId(this.loginForm.value.user_id);
              } else {
                // User clicked Cancel -> Clear sensitive data so they can try again later
                this.loginForm.patchValue({ password: '', captcha: '' });
                this.getCaptcha();
              }
            });
          break;

        case 'sc002':
          this.loginError = 'Invalid Registration No. or Password.';
          this.alertService.alert(true, this.loginError);

          // reset password + captcha
          this.loginForm.patchValue({password: '', captcha: ''});
          this.getCaptcha();
          break;

        case 'sc001':
          this.loginError = 'Invalid Registration No.';
          this.alertService.alert(true, this.loginError);

          // reset captcha
          this.loginForm.patchValue({captcha: ''});
          this.getCaptcha();
          break;

        default:
          this.loginError = error.message || 'An unknown login error occurred.';
          this.alertService.alert(true, this.loginError);

          // reset captcha
          this.loginForm.patchValue({captcha: ''});
          this.getCaptcha();
          break;
      }
    } else {
      this.loginError = 'An unknown error occurred. Please try again.';
      this.alertService.alert(true, this.loginError);

      // reset captcha
      this.loginForm.patchValue({captcha: ''});
      this.getCaptcha();
    }
  }
}
