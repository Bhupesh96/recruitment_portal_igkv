import { Component, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from 'shared';
import { Router } from '@angular/router';
import { AlertService } from 'shared';

@Component({
  selector: 'app-dawapatti-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dawapatti-header.component.html',
  styleUrls: ['./dawapatti-header.component.scss'],
})
export class DawapattiHeaderComponent {
  public isProfileMenuOpen = false;
  private readonly imageBaseUrl = 'http://192.168.1.57:3500/';

  constructor(
    private authService: AuthService,
    private router: Router,
    private alertService: AlertService,
    private elementRef: ElementRef // 👈 add ElementRef
  ) {}

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get user(): any {
    return this.isLoggedIn ? this.authService.currentUser : null;
  }

  get welcomeName(): string {
    const name = this.user?.Applicant_First_Name_E;
    return name
      ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
      : 'Welcome';
  }

  get welcomeNameHindi(): string {
    return this.user?.Applicant_First_Name_H ?? '';
  }

  get profileImageUrl(): string | null {
    const photoPath = this.user?.candidate_photo;
    return photoPath ? `${this.imageBaseUrl}${photoPath}` : null;
  }

  hideImageOnError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  // 👇 ADD THIS — Handles outside clicks
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside && this.isProfileMenuOpen) {
      this.isProfileMenuOpen = false;
    }
  }

  logout(): void {
    this.alertService
      .confirmAlert('Logout', 'Are you sure you want to logout?', 'warning')
      .then((result: any) => {
        if (result.isConfirmed) {
          this.isProfileMenuOpen = false;
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
