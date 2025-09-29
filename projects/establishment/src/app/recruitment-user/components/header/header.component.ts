import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from 'shared';
import { Router } from '@angular/router';
import { AlertService } from 'shared';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  constructor(
    private authService: AuthService,
    private router: Router,
    private alertService: AlertService // 👈 inject alert service
  ) {}

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  logout(): void {
    this.alertService
      .confirmAlert('Logout', 'Are you sure you want to logout?', 'warning')
      .then((result: any) => {
        if (result.isConfirmed) {
          this.authService.logout();
          this.alertService.alert(
            false,
            'You have been logged out successfully!',
            2000
          );
        }
      });
  }
}
