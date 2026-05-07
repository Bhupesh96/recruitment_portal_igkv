import { Component, OnInit, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpService, AuthService } from 'shared';

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

  // Track the active view for styling
  currentView: string = 'recruitment-form';

  // Tell the parent layout which component to render
  @Output() viewChanged = new EventEmitter<string>();

  constructor(
    private httpService: HttpService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.checkMenuVisibility();
  }

  toggleSidebar() {
    this.isExpanded = !this.isExpanded;
  }

  changeView(viewName: string) {
    this.currentView = viewName;
    this.viewChanged.emit(viewName);
  }

  checkMenuVisibility() {
    const user = this.authService.currentUser;
    console.log('Sidenav - Current User:', user); // Debugging: check if user object is loaded

    if (!user) return;

    // Retrieve IDs from the logged-in user session
    const advId = user.a_rec_adv_main_id || user.advertisement_id;
    const sessionId = user.academic_session_id || user.session_id;

    console.log('Sidenav - Extracted IDs:', { advId, sessionId }); // Debugging: Check if IDs exist

    if (!advId || !sessionId) {
      console.warn('Missing Advertisement or Session ID for Link Management in Sidenav');
      return;
    }

    const url = `/master/get/getRecruitmentLinkManagementList?list_adv_session_wise=true&a_rec_adv_main_id=${advId}&academic_session_id=${sessionId}`;

    this.httpService.getData(url, 'recruitement').subscribe({
      next: (res: any) => {
        // ✅ FIX: Use res?.body?.data exactly like you do in login.component.ts
        const linksData = res?.body?.data || res?.data;

        console.log('Sidenav - Link Data Received:', linksData); // Debugging

        if (linksData) {
          const now = new Date();

          linksData.forEach((link: any) => {
            const name = link.linkname?.trim().toLowerCase();

            if (link.Live_YN === 'Y') {
              const startDate = new Date(link.startDate.replace(' ', 'T'));
              const endDate = new Date(link.endDate.replace(' ', 'T'));

              // Check if current date falls within the active window
              if (now >= startDate && now <= endDate) {
                if (name === 'dawa patti' || name === 'dawapatti') {
                  this.showDawapatti = true;
                }
                if (name === 'score card' || name === 'scorecard') {
                  this.showScoreCard = true;
                }
              }
            }
          });
        }
      },
      error: (err) => console.error('Failed to load menu link status', err),
    });
  }
}
