import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  OnDestroy,
} from '@angular/core'; // ✅ Add OnInit, OnDestroy
import { CommonModule } from '@angular/common';
import { AuthService } from 'shared';
import { Router } from '@angular/router';
import { AlertService } from 'shared';
// ✅ Import the State Service
import { RecruitmentStateService } from '../../recruitment-state.service'; // Adjust path as needed
import { Subscription } from 'rxjs';
import { environment } from 'environment';

@Component({
  selector: 'app-dawapatti-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dawapatti-header.component.html',
  styleUrls: ['./dawapatti-header.component.scss'],
})
export class DawapattiHeaderComponent implements OnInit, OnDestroy {
  public isProfileMenuOpen = false;
  private readonly imageBaseUrl = `${environment.recruitmentFileBaseUrl}/`;

  // ✅ Local variable to hold the live user data
  public liveUserData: any = null;
  private userSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private alertService: AlertService,
    private elementRef: ElementRef,
    private recruitmentState: RecruitmentStateService // ✅ Inject the service
  ) {}

  ngOnInit(): void {
    // ✅ Subscribe to the live stream.
    // When Step 1 calls 'updateUserData', this code runs immediately.
    this.userSubscription = this.recruitmentState.userData$.subscribe(
      (data) => {
        // If we have recruitment data, use it. Otherwise fallback to AuthService.
        if (data) {
          this.liveUserData = data;
        } else {
          this.liveUserData = this.authService.currentUser;
        }
      }
    );
  }

  ngOnDestroy(): void {
    // Cleanup to prevent memory leaks
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  // ✅ Updated Getter: Uses liveUserData instead of this.user
  get welcomeName(): string {
    // Prioritize the live stream, fallback to AuthService if needed
    const name =
      this.liveUserData?.Applicant_First_Name_E ||
      this.authService.currentUser?.Applicant_First_Name_E;

    return name
      ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
      : 'Welcome';
  }

  // ✅ Updated Getter
  get welcomeNameHindi(): string {
    return (
      this.liveUserData?.Applicant_First_Name_H ||
      this.authService.currentUser?.Applicant_First_Name_H ||
      ''
    );
  }

  // ✅ Updated Getter: Immediate Photo Update
  get profileImageUrl(): string | null {
    // Prioritize live data. The Step 1 fix ensures 'candidate_photo' is updated in the state.
    const photoPath =
      this.liveUserData?.candidate_photo ||
      this.authService.currentUser?.candidate_photo;

    return photoPath ? `${this.imageBaseUrl}${photoPath}` : null;
  }

  hideImageOnError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

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
