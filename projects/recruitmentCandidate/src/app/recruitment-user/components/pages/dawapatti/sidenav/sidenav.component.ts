import { Component, OnInit, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpService, AuthService, AlertService } from 'shared'; // 🚨 Added AlertService
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss'],
})
export class SidenavComponent implements OnInit {
  isExpanded = true;

  // Flags to control menu visibility
  showScoreCard: boolean = false;
  showDawapatti: boolean = false;
  showRecruitmentForm: boolean = false;
  // Track the active view for styling
  currentView: string = 'recruitment-form';

  // Tell the parent layout which component to render
  @Output() viewChanged = new EventEmitter<string>();

  constructor(
    private httpService: HttpService,
    private authService: AuthService,
    private alertService: AlertService, // 🚨 Injected AlertService
    private router: Router
  ) {}

  ngOnInit() {
    this.checkMenuVisibility();
  }

  toggleSidebar() {
    this.isExpanded = !this.isExpanded;
  }

  changeView(viewName: string) {
    this.currentView = viewName;

    // Update parent component UI
    this.viewChanged.emit(viewName);

    // Update URL
    this.router.navigate(['/recruitment', viewName]);
  }

  checkMenuVisibility() {
    const user = this.authService.currentUser;

    if (!user) return;

    const advId = user.a_rec_adv_main_id || user.advertisement_id;
    const sessionId = user.academic_session_id || user.session_id;

    if (!advId || !sessionId) {
      console.warn('Missing Advertisement or Session ID');
      return;
    }

    const url = `/master/get/getRecruitmentLinkManagementList?list_adv_session_wise=true&a_rec_adv_main_id=${advId}&academic_session_id=${sessionId}`;

    this.httpService.getData(url, 'recruitement').subscribe({
      next: (res: any) => {
        const linksData = res?.body?.data || res?.data;

        if (linksData) {
          const now = new Date();

          // reset flags
          this.showRecruitmentForm = false;
          this.showDawapatti = false;
          this.showScoreCard = false;

          linksData.forEach((link: any) => {
            // 🚨 Use the link_type_code (mapped as isHeadingYN in your API)
            const linkTypeCode = link.isHeadingYN;
            const live = link.Live_YN;

            if (live === 'Y') {
              const startDate = new Date(link.startDate.replace(' ', 'T'));
              const endDate = new Date(link.endDate.replace(' ', 'T'));

              if (now >= startDate && now <= endDate) {
                if (linkTypeCode === 'R') this.showRecruitmentForm = true;
                if (linkTypeCode === 'D') this.showDawapatti = true;
                if (linkTypeCode === 'SC') this.showScoreCard = true;
              }
            }
          });

          // 🚨 NO ACTIVE LINKS FOUND LOGIC 🚨
          if (!this.showRecruitmentForm && !this.showScoreCard && !this.showDawapatti) {
            // Show alert and logout on confirmation/dismissal
            if (!this.showRecruitmentForm && !this.showScoreCard && !this.showDawapatti) {
              // Show alert with only an "OK" button
              this.alertService.confirmAlert_custom(
                'Portal Closed',
                'There are no active application forms, score cards, or objection links open for your session at this time.',
                'info',
                {
                  showCancel: false,     // Removes the "No" button
                  confirmText: 'OK'      // Changes "Yes" to "OK"
                }
              ).then(() => {
                this.logout();
              });
              return; // Stop further routing logic
            }

          // 🚦 TRAFFIC CONTROLLER LOGIC 🚦
          // If the user lands on the base '/recruitment' URL, auto-route them to the first available open link
          if (this.router.url === '/recruitment' || this.router.url === '/recruitment/') {

            if (this.showRecruitmentForm) {
              this.currentView = 'recruitment-form';
              this.router.navigate(['/recruitment/recruitment-form']);
            }
            else if (this.showScoreCard) {
              this.currentView = 'score-card';
              this.router.navigate(['/recruitment/score-card']);
            }
            else if (this.showDawapatti) {
              this.currentView = 'dawapatti';
              this.router.navigate(['/recruitment/dawapatti']);
            }

          } else {
            // User went directly to a specific URL (e.g., '/recruitment/score-card')
            // Just update the active tab styling to match the URL
            if (this.router.url.includes('recruitment-form')) this.currentView = 'recruitment-form';
            if (this.router.url.includes('score-card')) this.currentView = 'score-card';
            if (this.router.url.includes('dawapatti')) this.currentView = 'dawapatti';
          }
        }
      },
      error: (err) => console.error('Failed to load menu link status', err),
    });
  }

  // 🚨 Helper method to handle logout safely
  logout() {
    // Attempt to use your standard AuthService logout method
    if (this.authService && typeof (this.authService as any).logout === 'function') {
      (this.authService as any).logout();
    } else {
      // Fallback if the method name is different in your AuthService
      localStorage.clear();
      sessionStorage.clear();
    }

    // Redirect to home page
    this.router.navigate(['/home']);
  }
}
