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
import { HttpService, AlertService, PrintService } from 'shared';
import { Router } from '@angular/router';
// interface Session {
//   academic_session_id: number;
//   academic_session_name: string;
// }

interface Advertisement {
  a_rec_adv_main_id: number;
  advertisment_no: string;
}

interface Post {
  post_code: number;
  post_name: string;
  post_status_name: string;
  a_rec_adv_post_detail_id: number; // Add this ID from your post API response
  subjects: any[]; // To hold the list of subjects for this post
  selectedSubjectId: number | null; // To store the ID of the selected subject
  activeTab: 'login' | 'signup' | 'news' | 'complaint';
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
  // sessions: Session[] = [];
  selectedSession: string = '';
  selectedSessionId: number | null = null;
  selectedAd: string = '';
  ads: Advertisement[] = [];
  allPosts: Post[] = [];

  sessions: any[] = []; // { academic_session_id, academic_session_name }
  tabs: Array<'login' | 'signup' | 'news' | 'complaint'> = [
    'login',
    'signup',
    'news',
    'complaint',
  ];

  // ✅ Used for tabs inside each post (excluding login)
  tabsWithoutLogin: Array<'signup' | 'news' | 'complaint'> = [
    'signup',
    'news',
    'complaint',
  ];
  isMobileView = false;

  showLogin: boolean = false;
  showSignup: boolean = true;
  showLoginForm() {
    this.showLogin = true;
    this.showSignup = false;
  }
  showSignupForm() {
    this.showLogin = false;
    this.showSignup = true;
  }

  isLoggedIn = false;

  currentStep: 'selection' | 'signup' | 'login' = 'selection';
  goToSignup() {
    this.currentStep = 'signup';
  }

  goToLogin() {
    this.currentStep = 'login';
  }

  switchToLogin() {
    this.showLogin = true;
    this.showSignup = false;
  }

  showSelectionView() {
    this.showLogin = false;
    this.showSignup = true;
  }


  private apiBaseUrl = '';
  constructor(
    private HTTP: HttpService,
    private http: HttpClient,
    private router: Router
  ) {}
  handleLoginSuccess() {
    console.log('Login Successful, showing stepper');
    this.router.navigate(['/recruitment']);
  }
  ngOnInit() {
    this.getAcademicSession();
    this.getApplicant();
    this.checkViewport();
    window.addEventListener('resize', this.checkViewport.bind(this));
    // this.fetchSessions();
  }

  getAcademicSession() {
    this.HTTP.getParam(
      '/publicapi/get/getAcademicSessionForLogin/',
      {},
      'recruitementApi'
    ).subscribe((result: any): void => {
      this.sessions = result.body.data;
      console.log(
        '🟢 JSON Academic Session List:',
        JSON.stringify(this.sessions, null, 2)
      );
    });
  }

  getAdvertisement(academic_session_id: number) {
    const params = {
      academic_session_id: academic_session_id,
    };
    console.log('Testing', academic_session_id);
    this.HTTP.getParam(
      '/publicapi/get/getLatestAdvertisementForLogin/',
      params,
      'recruitement'
    ).subscribe((result: any): void => {
      this.ads = result.body.data;
      console.log(
        '🟢 JSON Advertisement List:',
        JSON.stringify(this.ads, null, 2)
      );
    });
  }

  getApplicant() {
    const params = {
      registration_no: 24000001,
    };
    console.log('API Call hua ');
    // this.HTTP.getParam(
    //   '/master/get/getApplicant/',
    //   params,
    //   'recruitement'
    // ).subscribe((result: any): void => {
    //   const applicantList = result.body.data;
    //   console.log(
    //     '🟢 JSON Applicant List:',
    //     JSON.stringify(applicantList, null, 2)
    //   );
    // });
  }

  checkViewport() {
    this.isMobileView = window.innerWidth < 1024; // lg breakpoint
  }

  // fetchAdvertisements(sessionId: number) {
  //   const params = new HttpParams().set('sessionId', sessionId.toString());
  //   this.http
  //     .get<{ Response: { List: Advertisement[] } }>(
  //       `${this.apiBaseUrl}/getLatestAdvertisement`,
  //       { params }
  //     )
  //     .subscribe({
  //       next: (response) => {
  //         this.ads = response.Response.List;
  //       },
  //       error: (error) => {
  //         console.error('Error fetching advertisements:', error);
  //       },
  //     });
  // }

  fetchPostsByAdvertisement(adId: string) {
    // Parameters are now a plain object, which is cleaner.
    // NOTE: I've assumed the parameter key is 'a_rec_adv_main_id'.
    // Please verify this with your backend API. It was 'mapScoreId' in the old code.
    const params = {
      a_rec_adv_main_id: adId,
    };

    // Changed to use the custom HTTP service for consistency.
    // The endpoint is assumed to follow the same '/master/get/...' pattern.
    this.HTTP.getParam(
      '/publicapi/get/getPostByAdvertimentForLogin/',
      params,
      'recruitement'
    ).subscribe({
      next: (result: any) => {
        // Access the data from result.body.data, matching the service's response structure.
        const postsList = result.body.data || []; // Default to empty array if data is null

        // The original mapping logic to add UI-specific properties is preserved.
        this.allPosts = postsList.map((post: any) => ({
          post_code: post.post_code,
          post_name: post.post_name,
          post_status_name: post.post_status_name,
          a_rec_adv_post_detail_id: post.a_rec_adv_post_detail_id, // <-- Map the new ID
          subjects: [], // Initialize as an empty array
          selectedSubjectId: null, // Initialize as null
          activeTab: 'signup' as 'login' | 'signup' | 'news' | 'complaint',
          expanded: false,
        }));
        this.allPosts.forEach((post) => {
          if (post.a_rec_adv_post_detail_id) {
            this.fetchSubjectsForPost(post);
          }
        });
        // Added for easier debugging, similar to your other methods.
        console.log(
          '🟢 JSON Posts List:',
          JSON.stringify(this.allPosts, null, 2)
        );
      },
      error: (error) => {
        console.error('Error fetching posts:', error);
        this.allPosts = []; // Clear posts on error
      },
    });
  }
  fetchSubjectsForPost(post: Post) {
    const params = {
      a_rec_adv_post_detail_id: post.a_rec_adv_post_detail_id,
    };

    this.HTTP.getParam(
      '/publicapi/get/getSubjectsByPostDetailIdForLogin',
      params,
      'recruitement' // <-- FIX: Changed the service key
    ).subscribe({
      next: (result: any) => {
        if (result.body && result.body.data) {
          post.subjects = result.body.data;
          console.log(
            `✅ Subjects loaded for post ${post.post_code}:`,
            JSON.stringify(post.subjects, null, 2)
          );
        }
      },
      error: (err) => {
        // This will now show you any errors with the API call
        console.error(
          `❌ Error fetching subjects for post ${post.post_code}:`,
          err
        );
      },
    });
  }

  getSubjectIdForPost(post: Post): number | null {
    if (post.subjects && post.subjects.length > 0) {
      return post.selectedSubjectId;
    }

    return 0;
  }
  get filteredAds(): Advertisement[] {
    return this.ads;
  }

  get filteredPosts(): Post[] {
    return this.selectedAd ? this.allPosts : [];
  }

  setActiveTab(post: Post, tab: 'login' | 'signup' | 'news' | 'complaint') {
    post.activeTab = tab;
  }

  togglePost(post: Post) {
    post.expanded = !post.expanded;
  }

  onSessionChange() {
    this.selectedAd = '';
    this.allPosts = [];
    this.ads = [];

    // ✅ FIX: Assign the value to the class property `this.selectedSessionId`
    this.selectedSessionId = this.selectedSession
      ? +this.selectedSession
      : null;

    console.log('Session ID set to: ', this.selectedSessionId);

    if (this.selectedSessionId) {
      // Pass the updated class property to the function
      this.getAdvertisement(this.selectedSessionId);
    }
  }

  onAdChange() {
    if (this.selectedAd) {
      this.allPosts = [];
      this.fetchPostsByAdvertisement(this.selectedAd);
    }
  }
}
