import { Component, OnInit, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpService, AuthService } from 'shared';
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
            const type = link.isHeadingYN;
            const live = link.Live_YN;

            if (live === 'Y') {
              const startDate = new Date(link.startDate.replace(' ', 'T'));
              const endDate = new Date(link.endDate.replace(' ', 'T'));

              if (now >= startDate && now <= endDate) {
                if (type === 'R') this.showRecruitmentForm = true;
                if (type === 'D') this.showDawapatti = true;
                if (type === 'SC') this.showScoreCard = true;
              }
            }
          });

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
            else {
              // Nothing is open, send them home
              this.router.navigate(['/home']);
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
}
