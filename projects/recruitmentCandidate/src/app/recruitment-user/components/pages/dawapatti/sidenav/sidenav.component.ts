import { Component, OnDestroy, OnInit, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpService, AuthService, AlertService } from 'shared';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  LatestPdfAvailability,
  SharedDataService,
} from '../../shared-data.service';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss'],
})
export class SidenavComponent implements OnInit, OnDestroy {
  isExpanded = true;
  latestUpdatedDate: string | null = null;
  // Flags to control menu visibility
  showScoreCard: boolean = false;
  showDawapatti: boolean = false;
  showRecruitmentForm: boolean = false;
  latestPdfAvailability: LatestPdfAvailability | null = null;
  private pdfAvailabilitySub?: Subscription;
  // Track the active view for styling
  currentView: string = 'recruitment-form';
  private stepChangedSub?: Subscription;
  // Tell the parent layout which component to render
  @Output() viewChanged = new EventEmitter<string>();

  constructor(
    private httpService: HttpService,
    private authService: AuthService,
    private alertService: AlertService,
    private router: Router,
    private sharedDataService: SharedDataService,
  ) {}


  ngOnInit() {
    this.getLatestUpdatedDate();

    this.stepChangedSub =
      this.sharedDataService.stepChanged$.subscribe(() => {

        this.getLatestUpdatedDate();
      });

    this.checkMenuVisibility();
  }

  getLatestUpdatedDate(): void {
    const user = this.authService.currentUser;

    if (!user?.registration_no) {
      console.warn('Registration number not found');
      this.latestUpdatedDate = null;
      return;
    }

    this.httpService.getParam(
      '/candidate/get/getRecruitmentLatesDataUpdatedDate',
      {
        registration_no: user.registration_no
      },
      'recruitement'
    ).subscribe({
      next: (res: any) => {
        console.log('Latest Updated Date Response:', res);

        const data = res?.body?.data ?? res?.data;

        if (Array.isArray(data)) {
          this.latestUpdatedDate =
            data.length > 0 ? data[0]?.latest_date ?? null : null;
        } else {
          this.latestUpdatedDate = data?.latest_date ?? null;
        }

        console.log(
          'Latest Recruitment Updated Date:',
          this.latestUpdatedDate
        );
      },

      error: (err) => {
        console.error(
          'Failed to get latest recruitment updated date:',
          err
        );

        this.latestUpdatedDate = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.pdfAvailabilitySub?.unsubscribe();
    this.stepChangedSub?.unsubscribe();
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

  downloadLatestPdf(): void {
    this.sharedDataService.requestLatestPdfDownload();
  }


checkMenuVisibility() {
  const user = this.authService.currentUser;

  if (!user) {
    console.warn('No current user found');
    return;
  }

  const advId = user.a_rec_adv_main_id || user.advertisement_id;
  const sessionId = user.academic_session_id || user.session_id;

  if (!advId || !sessionId) {
    console.warn('Missing Advertisement or Session ID', {
      advId,
      sessionId
    });
    return;
  }

  const url =
    `/publicApi/get/getRecruitmentLinkManagementListPublic` +
    `?list_adv_session_wise=true` +
    `&a_rec_adv_main_id=${advId}` +
    `&academic_session_id=${sessionId}`;

  this.httpService.getData(url, 'recruitement').subscribe({
    next: (res: any) => {
      console.log('Link Management Response:', res);

      const linksData = res?.body?.data || res?.data;

      // Reset only Link Management menus
      this.showRecruitmentForm = false;
      this.showScoreCard = false;
      this.showDawapatti = false;

      if (Array.isArray(linksData)) {
        const now = new Date();

        linksData.forEach((link: any) => {
          const linkTypeCode = link.isHeadingYN;
          const live = link.Live_YN;

          if (live !== 'Y') {
            return;
          }

          if (!link.startDate || !link.endDate) {
            return;
          }

          const startDate = new Date(
            String(link.startDate).replace(' ', 'T')
          );

          const endDate = new Date(
            String(link.endDate).replace(' ', 'T')
          );

          if (now >= startDate && now <= endDate) {

            if (linkTypeCode === 'R') {
              this.showRecruitmentForm = true;
            }

            if (linkTypeCode === 'D') {
              this.showDawapatti = true;
            }

            if (linkTypeCode === 'SC') {
              this.showScoreCard = true;
            }
          }
        });
      }

      console.log('Link Management Menu Status:', {
        recruitmentForm: this.showRecruitmentForm,
        scoreCard: this.showScoreCard,
        dawapatti: this.showDawapatti
      });

      /*
       * IMPORTANT:
       *
       * PDF is NOT checked here.
       * PDF is completely independent from Link Management.
       */

      const hasActiveLink =
        this.showRecruitmentForm ||
        this.showScoreCard ||
        this.showDawapatti;

      /*
       * If there are no active Link Management options,
       * we should NOT immediately logout because the PDF
       * may still be available.
       *
       * We wait for PDF availability to determine whether
       * there is something available to the user.
       */

      if (!hasActiveLink && !this.latestPdfAvailability) {
        console.log(
          'No active Link Management links and PDF is currently unavailable.'
        );

        /*
         * Do NOT logout immediately here.
         *
         * PDF availability is loaded independently and may
         * arrive asynchronously.
         *
         * If you logout here, the PDF menu may never get
         * a chance to appear.
         */
        return;
      }

      /*
       * Automatic routing is ONLY for Link Management items.
       *
       * PDF is never automatically routed.
       */

      if (
        this.router.url === '/recruitment' ||
        this.router.url === '/recruitment/'
      ) {

        if (this.showRecruitmentForm) {

          this.currentView = 'recruitment-form';

          this.router.navigate([
            '/recruitment/recruitment-form'
          ]);

        } else if (this.showScoreCard) {

          this.currentView = 'score-card';

          this.router.navigate([
            '/recruitment/score-card'
          ]);

        } else if (this.showDawapatti) {

          this.currentView = 'dawapatti';

          this.router.navigate([
            '/recruitment/dawapatti'
          ]);
        }

        /*
         * If only PDF is available:
         *
         * Do nothing.
         *
         * User stays on /recruitment and sees
         * "Form Updated On (Date) - Download PDF".
         */
      } else {

        if (this.router.url.includes('recruitment-form')) {
          this.currentView = 'recruitment-form';
        }

        if (this.router.url.includes('score-card')) {
          this.currentView = 'score-card';
        }

        if (this.router.url.includes('dawapatti')) {
          this.currentView = 'dawapatti';
        }
      }
    },

    error: (err) => {
      console.error(
        'Failed to load menu link status',
        err
      );

      /*
       * Do NOT touch latestPdfAvailability here.
       *
       * PDF is independent from Link Management.
       */
    }
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
