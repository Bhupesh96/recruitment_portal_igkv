import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { SignupComponent } from '../pages/registration/signup/signup.component';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { LoginComponent } from '../pages/registration/login/login.component';
import { StepperComponent } from '../pages/stepper/stepper.component';
import { HttpService, AuthService } from 'shared';
import { Router } from '@angular/router';

interface Advertisement {
  a_rec_adv_main_id: number;
  advertisment_no: string;
  advertisement_order_copy?: string;
  score_card_order_copy?: string;
}

interface Post {
  post_code: number;
  post_name: string;
  post_status_name: string;
  a_rec_adv_post_detail_id: number;
  subjects: any[];
  selectedSubjectId: number | null;
  activeTab: 'login' | 'signup' | 'notification' | 'complaint';
  expanded: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    SignupComponent,
    HeaderComponent,
    FooterComponent,
    LoginComponent,
    StepperComponent,
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  selectedSession: string = '';
  selectedSessionId: number | null = null;
  selectedAd: string = '';
  ads: Advertisement[] = [];
  allPosts: Post[] = [];
  selectedAdDetails: Advertisement | null = null;
  backendBaseUrl = 'http://192.168.1.57:3500';
  sessions: any[] = [];

  tabsWithoutLogin: Array<'signup' | 'notification' | 'complaint'> = [
    'signup',
    'notification',
    'complaint',
  ];

  // ✅ New Object to track the active status and message for each tab
  linkStatuses: any = {
    signup: { active: false, message: 'Registration is currently closed.' },
    notification: { active: false, message: 'Notifications are currently unavailable.' },
    complaint: { active: false, message: 'Online Complaint is currently closed.' }
  };

  isMobileView = false;
  showLogin: boolean = false;
  showSignup: boolean = true;
  isLoggedIn = false;

  constructor(
    private HTTP: HttpService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/recruitment']);
      return;
    }
    this.getAcademicSession();
    this.checkViewport();
    window.addEventListener('resize', this.checkViewport.bind(this));
  }

  // Formatting Helper for Messages
  formatDateTime(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  showLoginForm() {
    this.showLogin = true;
    this.showSignup = false;
  }
  showSignupForm() {
    this.showLogin = false;
    this.showSignup = true;
  }
  switchToLogin() {
    this.showLogin = true;
    this.showSignup = false;
  }
  showSelectionView() {
    this.showLogin = false;
    this.showSignup = true;
  }
  handleLoginSuccess() {
    this.router.navigate(['/recruitment']);
  }

  getAcademicSession() {
    this.HTTP.getParam('/publicapi/get/getAcademicSessionForLogin/', {}, 'recruitementApi').subscribe((result: any): void => {
      this.sessions = result.body.data || [];
      if (this.sessions.length > 0) {
        this.findFirstSessionWithAds(0);
      }
    });
  }

  findFirstSessionWithAds(index: number) {
    if (index >= this.sessions.length) {
      if (this.sessions.length > 0) {
        this.selectedSession = this.sessions[0].academic_session_id.toString();
        this.onSessionChange();
      }
      return;
    }

    const sessionId = this.sessions[index].academic_session_id;
    this.HTTP.getParam('/publicapi/get/getLatestAdvertisementForLogin/', { academic_session_id: sessionId }, 'recruitement').subscribe((result: any): void => {
      const fetchedAds = result.body.data || [];
      if (fetchedAds.length > 0) {
        this.selectedSession = sessionId.toString();
        this.selectedSessionId = sessionId;
        this.ads = fetchedAds;
        this.selectedAd = this.ads[0].a_rec_adv_main_id.toString();
        this.onAdChange();
      } else {
        this.findFirstSessionWithAds(index + 1);
      }
    });
  }

  getAdvertisement(academic_session_id: number) {
    this.HTTP.getParam('/publicapi/get/getLatestAdvertisementForLogin/', { academic_session_id }, 'recruitement').subscribe((result: any): void => {
      this.ads = result.body.data || [];
      if (this.ads.length > 0) {
        this.selectedAd = this.ads[0].a_rec_adv_main_id.toString();
        this.onAdChange();
      }
    });
  }

  checkViewport() {
    this.isMobileView = window.innerWidth < 1024;
  }

  onSessionChange() {
    this.selectedAd = '';
    this.allPosts = [];
    this.ads = [];
    this.selectedSessionId = this.selectedSession ? +this.selectedSession : null;

    if (this.selectedSessionId) {
      this.getAdvertisement(this.selectedSessionId);
    }
  }

  onAdChange() {
    if (this.selectedAd && this.selectedSessionId) {
      this.allPosts = [];
      this.selectedAdDetails = this.ads.find(ad => ad.a_rec_adv_main_id === +this.selectedAd) || null;

      // Fetch Statuses first, then load the posts
      this.fetchLinkManagementAndPosts(this.selectedAd, this.selectedSessionId);
    }
  }

  // ✅ New method to build tab statuses
  fetchLinkManagementAndPosts(advId: string, sessionId: number) {
    const linkUrl = `/publicApi/get/getRecruitmentLinkManagementListPublic?list_adv_session_wise=true&a_rec_adv_main_id=${advId}&academic_session_id=${sessionId}`;

    this.HTTP.getData(linkUrl, 'recruitement').subscribe({
      next: (res: any) => {
        // Reset defaults
        this.linkStatuses = {
          signup: { active: false, message: 'Registration configuration not found.' },
          notification: { active: false, message: 'Notifications configuration not found.' },
          complaint: { active: false, message: 'Online Complaint configuration not found.' }
        };

        if (res?.body?.data) {
          const now = new Date();

          res.body.data.forEach((link: any) => {
            const name = link.linkname?.trim().toLowerCase();
            let key = '';

            // Map the API string to our HTML keys
            if (name === 'signup') key = 'signup';
            else if (name === 'notification') key = 'notification';
            else if (name === 'online complain' || name === 'online complaint') key = 'complaint';

            if (key) {
              const startDate = new Date(link.startDate.replace(' ', 'T'));
              const endDate = new Date(link.endDate.replace(' ', 'T'));

              if (link.Live_YN !== 'Y') {
                this.linkStatuses[key].active = false;
                this.linkStatuses[key].message = `${link.linkname} is currently disabled.`;
              } else if (now < startDate) {
                this.linkStatuses[key].active = false;
                this.linkStatuses[key].message = `${link.linkname} will open on ${this.formatDateTime(startDate)}.`;
              } else if (now > endDate) {
                this.linkStatuses[key].active = false;
                this.linkStatuses[key].message = `${link.linkname} ended on ${this.formatDateTime(endDate)}.`;
              } else {
                this.linkStatuses[key].active = true;
                this.linkStatuses[key].message = '';
              }
            }
          });
        }

        // Now fetch posts
        this.fetchPostsByAdvertisement(advId);
      },
      error: (err) => {
        console.error('Error fetching link management', err);
        this.fetchPostsByAdvertisement(advId);
      }
    });
  }

  fetchPostsByAdvertisement(adId: string) {
    this.HTTP.getParam('/publicapi/get/getPostByAdvertimentForLogin/', { a_rec_adv_main_id: adId }, 'recruitement').subscribe({
      next: (result: any) => {
        const postsList = result.body.data || [];

        // Default to the first tab that is actually active, or fallback to signup
        let defaultTab: 'signup' | 'notification' | 'complaint' = 'signup';
        if (this.linkStatuses['signup'].active) defaultTab = 'signup';
        else if (this.linkStatuses['notification'].active) defaultTab = 'notification';
        else if (this.linkStatuses['complaint'].active) defaultTab = 'complaint';

        this.allPosts = postsList.map((post: any, index: number) => ({
          post_code: post.post_code,
          post_name: post.post_name,
          post_status_name: post.post_status_name,
          a_rec_adv_post_detail_id: post.a_rec_adv_post_detail_id,
          subjects: [],
          selectedSubjectId: null,
          activeTab: defaultTab,
          expanded: index === 0,
        }));

        this.allPosts.forEach((post) => {
          if (post.a_rec_adv_post_detail_id) {
            this.fetchSubjectsForPost(post);
          }
        });
      },
      error: (error) => {
        console.error('Error fetching posts:', error);
        this.allPosts = [];
      },
    });
  }

  fetchSubjectsForPost(post: Post) {
    this.HTTP.getParam('/publicapi/get/getSubjectsByPostDetailIdForLogin', { a_rec_adv_post_detail_id: post.a_rec_adv_post_detail_id }, 'recruitement').subscribe({
      next: (result: any) => {
        if (result.body && result.body.data) post.subjects = result.body.data;
      },
      error: (err) => console.error(`Error fetching subjects for post ${post.post_code}:`, err),
    });
  }

  getSubjectIdForPost(post: Post): number | null {
    if (post.subjects && post.subjects.length > 0) return post.selectedSubjectId;
    return 0;
  }

  get filteredAds(): Advertisement[] { return this.ads; }
  get filteredPosts(): Post[] { return this.selectedAd ? this.allPosts : []; }

  setActiveTab(post: Post, tab: 'login' | 'signup' | 'notification' | 'complaint') { post.activeTab = tab; }
  togglePost(post: Post) { post.expanded = !post.expanded; }

  getFileUrl(filePath: string | undefined): string {
    if (!filePath) return '';
    let normalizedPath = filePath.replace(/\\/g, '/');
    normalizedPath = normalizedPath.replace(/^\.\.\//, '/');
    return `${this.backendBaseUrl}${normalizedPath}`;
  }

  isValidFile(filePath: any): boolean {
    if (!filePath) return false;
    const strPath = String(filePath).trim().toLowerCase();
    if (strPath === '' || strPath === 'null' || strPath === 'undefined') return false;
    return true;
  }
}
