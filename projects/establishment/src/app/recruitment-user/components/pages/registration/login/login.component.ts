import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpService, AlertService, AuthService } from 'shared';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  @Output() loginSuccess = new EventEmitter<void>();

  // Login form fields
  registrationNo = '';
  password = '';
  showPassword = false;

  // Forgot password toggle
  showForgotPassword = false;

  // Forgot password fields
  resetRegNo = '';
  newPassword = '';
  confirmPassword = '';
  passwordMismatch = false;

  // Status messages
  loginError = '';
  loginSuccessFull = '';

  constructor(
    private httpService: HttpService,
    private authService: AuthService,
    private alertService: AlertService,
    private router: Router
  ) {}

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleForgotPassword() {
    this.showForgotPassword = !this.showForgotPassword;
    this.clearAllMessages();
    this.resetRegNo = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.passwordMismatch = false;
  }

  clearAllMessages() {
    this.loginError = '';
    this.loginSuccessFull = '';
    // Removed this.alertService.clear() as it does not exist
  }

  validateInputs(): boolean {
    this.clearAllMessages();

    if (!this.registrationNo) {
      this.loginError = 'Registration number is required';
      return false;
    }

    if (!this.password) {
      this.loginError = 'Password is required';
      return false;
    }

    return true;
  }

  onLogin() {
    this.clearAllMessages();

    if (!this.validateInputs()) {
      return;
    }

    const loginData = {
      registration_no: this.registrationNo,
      password: this.password,
    };

    this.httpService
      .postData('/security/login', loginData, 'common')
      .subscribe({
        next: (response: any) => {
          this.alertService.alert(
            false,
            response.message || 'Login successful',
            2000
          );
          this.loginSuccessFull = response.message || 'Login successful';
          this.registrationNo = '';
          this.password = '';
          this.loginSuccess.emit();
          this.authService.redirect(); // Use AuthService's redirect logic
        },
        error: (error: HttpErrorResponse) => {
          this.alertService.alert(true, error.error?.message || 'Login failed');
          this.loginError = error.error?.message || 'Login failed';
        },
      });
  }

  onResetPassword() {
    this.clearAllMessages();

    if (!this.resetRegNo || !this.newPassword || !this.confirmPassword) {
      this.alertService.alert(true, 'All fields are required', null);
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.passwordMismatch = true;
      this.alertService.alert(true, 'Passwords do not match', null);
      return;
    }

    this.passwordMismatch = false;

    const resetPayload = {
      registration_no: this.resetRegNo,
      new_password: this.newPassword,
    };

    this.authService.resetPassword(resetPayload).subscribe({
      next: (response: any) => {
        this.alertService.alert(
          false,
          response.message || 'Password reset successful. Please log in.',
          2000
        );
        this.toggleForgotPassword(); // Switch back to login
      },
      error: (error: HttpErrorResponse) => {
        this.alertService.alert(
          true,
          error.error?.message || 'Failed to reset password',
          null
        );
      },
    });
  }
}
