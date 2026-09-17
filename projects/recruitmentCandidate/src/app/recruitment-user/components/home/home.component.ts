import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
import {HttpClient, HttpParams} from '@angular/common/http';
import {SignupComponent} from '../pages/registration/signup/signup.component';
import {HeaderComponent} from '../header/header.component';
import {FooterComponent} from '../footer/footer.component';
import {LoginComponent} from '../pages/registration/login/login.component';
import {StepperComponent} from '../pages/stepper/stepper.component';
import {HttpService, AuthService, AlertService} from 'shared';
import {Router} from '@angular/router';
import {environment} from 'environment';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {NotificationComponent} from './notification/notification.component';
interface Advertisement {
  a_rec_adv_main_id: number;
  academic_session_id: number;
  advertisment_name: string;
  advertisment_no: string;
  advertisement_order_copy?: string;
  score_card_order_copy?: string;
}

interface LinkStatus {
  active: boolean;
  message: string;
}

interface LinkStatuses {
  signup: LinkStatus;
  notification: LinkStatus;
  complaint: LinkStatus;
}

interface Post {
  advertisement: Advertisement;
  advertisementId: string;
  linkStatuses: LinkStatuses;
  latestNotifications: any[];
  post_code: number;
  post_name: string;
  post_status_name: string;
  a_rec_adv_post_detail_id: number;
  subjects: any[];
  selectedSubjectId: number | null;
  activeTab: 'login' | 'signup' | 'notification' | 'complaint' | null;
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
    NotificationComponent
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  selectedSession: string = '';
  selectedSessionId: number | null = null;
  ads: Advertisement[] = [];
  allPosts: Post[] = [];
  sessions: any[] = [];
  isLoadingRecruitments = false;
  private recruitmentLoadId = 0;
  private pendingAdvertisementLoads = 0;
  marqueeItems: any[] = [];
  complaintProblems: any[] = [];
  selectedProblemId: number | null = null;
  chatStep:
    | 'PROBLEM'
    | 'REGISTRATION'
    | 'OTP'
    | 'DESCRIPTION'
    | 'ATTACHMENT'
    | 'SUBMIT'
    = 'PROBLEM';
  complaintRegistrationNo = '';
  complaintUserData: any = null;
  complaintProblemText = '';
  complaintFile: File | null = null;
  tabsWithoutLogin: Array<'signup' | 'notification' | 'complaint'> = [
    'signup',
    'notification',
    'complaint',
  ];
  showComplaintChat = false;
  newChatMessage = '';
  showMarqueeModal = false;
  chatMessages = [
    {
      sender: 'ADMIN',
      message: 'Welcome to Recruitment Support 👋',
      time: new Date().toLocaleTimeString()
    },
    {
      sender: 'ADMIN',
      message: 'Please select your issue type below.',
      time: new Date().toLocaleTimeString()
    }
  ];

  isMobileView = false;
  showLogin: boolean = false;
  showSignup: boolean = true;
  isLoggedIn = false;


  constructor(
    private HTTP: HttpService,
    private router: Router,
    private sanitizer: DomSanitizer,
    private authService: AuthService,
    private alertService: AlertService,
  ) {
  }

  ngOnInit() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/recruitment']);
      return;
    }
    this.getAcademicSession();
    this.getComplaintProblems();
    this.checkViewport();
    window.addEventListener('resize', this.checkViewport.bind(this));
  }
  sendChatMessage() {

    if (!this.newChatMessage?.trim()) {
      return;
    }

    const userText = this.newChatMessage.trim();

    // Show user message
    this.chatMessages.push({
      sender: 'USER',
      message: userText,
      time: new Date().toLocaleTimeString()
    });

    // Clear input immediately
    this.newChatMessage = '';

    // STEP 1 : REGISTRATION VALIDATION
    if (this.chatStep === 'REGISTRATION') {

      this.HTTP.getData(
        `/publicApi/get/getRegistration?registration_no=${userText}`,
        'recruitement'
      ).subscribe({

        next: (res: any) => {

          const data = res?.body?.data || [];

          // Invalid Registration
          if (!data.length) {

            this.chatMessages.push({
              sender: 'ADMIN',
              message: 'Registration number not found. Please enter a valid registration number.',
              time: new Date().toLocaleTimeString()
            });

            return;
          }

          // Save user details
          this.complaintRegistrationNo = userText;
          this.complaintUserData = data[0];

          this.chatMessages.push({
            sender: 'ADMIN',
            message: `Welcome ${data[0].applicant_name}`,
            time: new Date().toLocaleTimeString()
          });

          this.chatMessages.push({
            sender: 'ADMIN',
            message: 'Please describe your issue.',
            time: new Date().toLocaleTimeString()
          });

          this.chatStep = 'DESCRIPTION';

        },

        error: () => {

          this.chatMessages.push({
            sender: 'ADMIN',
            message: 'Unable to verify registration number. Please try again.',
            time: new Date().toLocaleTimeString()
          });

        }

      });

      return;
    }

    // STEP 2 : ISSUE DESCRIPTION
    if (this.chatStep === 'DESCRIPTION') {

      this.complaintProblemText = userText;

      this.chatMessages.push({
        sender: 'ADMIN',
        message: 'Thank you. Your complaint details are ready.',
        time: new Date().toLocaleTimeString()
      });

      this.chatMessages.push({
        sender: 'ADMIN',
        message: 'Would you like to upload any screenshot or document? (Optional)',
        time: new Date().toLocaleTimeString()
      });

      this.chatStep = 'ATTACHMENT';

      return;
    }

  }
  finishAttachmentStep() {

    this.chatMessages.push({
      sender: 'ADMIN',
      message: this.complaintFile
        ? 'Attachment added successfully.'
        : 'No attachment added.',
      time: new Date().toLocaleTimeString()
    });

    this.chatMessages.push({
      sender: 'ADMIN',
      message: 'Click Submit Complaint below to register your complaint.',
      time: new Date().toLocaleTimeString()
    });

    this.chatStep = 'SUBMIT';
  }
  selectProblem(problem: any) {

    this.selectedProblemId = problem.problem_id;

    this.chatMessages.push({
      sender: 'USER',
      message: problem.problem_short_name,
      time: new Date().toLocaleTimeString()
    });

    this.chatMessages.push({
      sender: 'ADMIN',
      message: 'Please enter your Registration Number.',
      time: new Date().toLocaleTimeString()
    });

    this.chatStep = 'REGISTRATION';
  }
  // Formatting Helper for Messages
  formatDateTime(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  formatDateForView(dateStr: string): string {

    if (!dateStr) return '';

    const d = new Date(dateStr.replace(' ', 'T'));

    const pad = (n: number) =>
      n.toString().padStart(2, '0');

    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
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
    this.isLoadingRecruitments = true;
    this.HTTP.getParam('/publicapi/get/getAcademicSessionForLogin/', {}, 'recruitementApi').subscribe((result: any): void => {
      this.sessions = result.body.data || [];
      if (this.sessions.length > 0) {
        this.findFirstSessionWithAds(0);
      } else {
        this.isLoadingRecruitments = false;
      }
    }, () => {
      this.isLoadingRecruitments = false;
    });
  }
  getComplaintProblems() {

    this.HTTP.getData(
      '/publicApi/get/getComplaintProblems?module_id=12',
      'recruitement'
    ).subscribe({

      next: (res: any) => {

        this.complaintProblems =
          res?.body?.data || [];

      },

      error: (err) => {

        console.error(
          'Error loading complaint problems',
          err
        );

        this.complaintProblems = [];

      }

    });

  }

  findFirstSessionWithAds(index: number) {
    if (index >= this.sessions.length) {
      if (this.sessions.length > 0) {
        this.selectedSession = this.sessions[0].academic_session_id.toString();
        this.onSessionChange();
      } else {
        this.isLoadingRecruitments = false;
      }
      return;
    }

    const sessionId = this.sessions[index].academic_session_id;
    this.HTTP.getParam('/publicapi/get/getLatestAdvertisementForLogin/', {academic_session_id: sessionId}, 'recruitement').subscribe((result: any): void => {
      const fetchedAds = result.body.data || [];
      if (fetchedAds.length > 0) {
        this.selectedSession = sessionId.toString();
        this.selectedSessionId = sessionId;
        this.ads = fetchedAds;
        this.loadSelectedAdvertisement();
      } else {
        this.findFirstSessionWithAds(index + 1);
      }
    });
  }

  getAdvertisement(academic_session_id: number) {
    this.HTTP.getParam('/publicapi/get/getLatestAdvertisementForLogin/', {academic_session_id}, 'recruitement').subscribe((result: any): void => {
      if (this.selectedSessionId !== academic_session_id) {
        return;
      }

      this.ads = result.body.data || [];
      this.loadSelectedAdvertisement();
    }, () => {
      if (this.selectedSessionId === academic_session_id) {
        this.isLoadingRecruitments = false;
      }
    });
  }

  checkViewport() {
    this.isMobileView = window.innerWidth < 1024;
  }

  onSessionChange() {
    this.recruitmentLoadId++;
    this.pendingAdvertisementLoads = 0;
    this.allPosts = [];
    this.ads = [];
    this.marqueeItems = [];
    this.selectedSessionId = this.selectedSession ? +this.selectedSession : null;
    this.isLoadingRecruitments = !!this.selectedSessionId;

    if (this.selectedSessionId) {
      this.getAdvertisement(this.selectedSessionId);
    }
  }

  private loadSelectedAdvertisement() {
    if (!this.selectedSessionId) {
      return;
    }

    this.allPosts = [];
    this.pendingAdvertisementLoads = this.ads.length;
    this.isLoadingRecruitments = this.pendingAdvertisementLoads > 0;
    const loadId = this.recruitmentLoadId;
    this.ads.forEach((advertisement) =>
      this.fetchLinkManagementAndPosts(advertisement, this.selectedSessionId!, loadId)
    );
  }

  private createLinkStatuses(): LinkStatuses {
    return {
      signup: {active: false, message: 'Registration configuration not found.'},
      notification: {active: false, message: 'Notifications configuration not found.'},
      complaint: {active: false, message: 'Online Complaint configuration not found.'}
    };
  }

  fetchLinkManagementAndPosts(advertisement: Advertisement, sessionId: number, loadId: number) {
    const advId = advertisement.a_rec_adv_main_id.toString();
    const linkUrl = `/publicApi/get/getRecruitmentLinkManagementListPublic?list_adv_session_wise=true&a_rec_adv_main_id=${advId}&academic_session_id=${sessionId}`;

    this.HTTP.getData(linkUrl, 'recruitement').subscribe({
      next: (res: any) => {
        if (loadId !== this.recruitmentLoadId) {
          return;
        }

        const linkStatuses = this.createLinkStatuses();
        const latestNotifications: any[] = [];
        if (res?.body?.data) {
          const now = new Date();

          res.body.data.forEach((link: any) => {
            // Latest Notifications
            if (
              link.m_rec_link_type_id === 5 &&
              link.Live_YN === 'Y'
            ) {

              const startDate = new Date(
                link.startDate.replace(' ', 'T')
              );

              const endDate = new Date(
                link.endDate.replace(' ', 'T')
              );

              const now = new Date();

              if (now >= startDate && now <= endDate) {

                latestNotifications.push({
                  title: link.linkname,
                  file_path: link.file_path,
                  target_url: link.TargetUrl,
                  startDate: link.startDate,
                  endDate: link.endDate
                });
              }
            }
            // Marquee
            if (
              link.m_rec_link_type_id === 8 &&
              link.Live_YN === 'Y' &&
              link.visible_after_login == 'N'
            ) {

              const startDate = new Date(
                link.startDate.replace(' ', 'T')
              );

              const endDate = new Date(
                link.endDate.replace(' ', 'T')
              );

              const now = new Date();

              if (now >= startDate && now <= endDate) {

                this.marqueeItems.push({
                  title: link.linkname,
                  file_path: link.file_path,
                  target_url: link.TargetUrl
                });
              }
            }
            let key: keyof LinkStatuses | null = null;

            // Use system codes instead of dynamic names
            if (link.isHeadingYN === 'S') {
              key = 'signup';
            } else if (link.isHeadingYN === 'L') {
              key = 'notification';
            } else if (link.isHeadingYN === 'O') {
              key = 'complaint';
            }
            if (key) {
              const startDate = new Date(link.startDate.replace(' ', 'T'));
              const endDate = new Date(link.endDate.replace(' ', 'T'));

              if (link.Live_YN !== 'Y') {
                linkStatuses[key].active = false;
                linkStatuses[key].message = `${link.linkname} is currently disabled.`;
              } else if (now < startDate) {
                linkStatuses[key].active = false;
                linkStatuses[key].message = `${link.linkname} will open on ${this.formatDateTime(startDate)}.`;
              } else if (now > endDate) {
                linkStatuses[key].active = false;
                linkStatuses[key].message = `${link.linkname} ended on ${this.formatDateTime(endDate)}.`;
              } else {
                linkStatuses[key].active = true;
                linkStatuses[key].message = '';
              }
            }
          });
        }

        this.fetchPostsByAdvertisement(advertisement, linkStatuses, latestNotifications, loadId);
      },
      error: (err) => {
        console.error('Error fetching link management', err);
        if (loadId === this.recruitmentLoadId) {
          this.fetchPostsByAdvertisement(advertisement, this.createLinkStatuses(), [], loadId);
        }
      }
    });
  }

  fetchPostsByAdvertisement(
    advertisement: Advertisement,
    linkStatuses: LinkStatuses,
    latestNotifications: any[],
    loadId: number
  ) {
    const adId = advertisement.a_rec_adv_main_id.toString();
    this.HTTP.getParam('/publicapi/get/getPostByAdvertimentForLogin/', {a_rec_adv_main_id: adId}, 'recruitement').subscribe({
      next: (result: any) => {
        if (
          loadId !== this.recruitmentLoadId ||
          this.selectedSessionId !== advertisement.academic_session_id
        ) {
          return;
        }

        const postsList = result.body.data || [];
        const posts = postsList.map((post: any, index: number) => ({
          advertisement,
          advertisementId: adId,
          linkStatuses,
          latestNotifications,
          post_code: post.post_code,
          post_name: post.post_name,
          post_status_name: post.post_status_name,
          a_rec_adv_post_detail_id: post.a_rec_adv_post_detail_id,
          subjects: [],
          selectedSubjectId: null,
          activeTab: null,
          expanded: index === 0,
        }));

        this.allPosts = [...this.allPosts, ...posts];
        posts.forEach((post: Post) => {
          if (post.a_rec_adv_post_detail_id) {
            this.fetchSubjectsForPost(post);
          }
        });
        this.completeAdvertisementLoad(loadId);
      },
      error: (error) => {
        console.error('Error fetching posts:', error);
        this.completeAdvertisementLoad(loadId);
      },
    });
  }

  private completeAdvertisementLoad(loadId: number): void {
    if (loadId !== this.recruitmentLoadId) {
      return;
    }

    this.pendingAdvertisementLoads--;
    if (this.pendingAdvertisementLoads <= 0) {
      this.isLoadingRecruitments = false;
    }
  }

  fetchSubjectsForPost(post: Post) {
    this.HTTP.getParam('/publicapi/get/getSubjectsByPostDetailIdForLogin', {a_rec_adv_post_detail_id: post.a_rec_adv_post_detail_id}, 'recruitement').subscribe({
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

  get filteredPosts(): Post[] {
    return this.allPosts.filter((post) => post.linkStatuses.signup.active);
  }

  get isComplaintActive(): boolean {
    return this.allPosts.some((post) => post.linkStatuses.complaint.active);
  }

  setActiveTab(post: Post, tab: 'login' | 'signup' | 'notification' | 'complaint') {
    post.activeTab = tab;
  }

  togglePost(post: Post) {
    post.expanded = !post.expanded;
  }

  getFileUrl(fileName?: string): SafeUrl {

    if (!fileName) {
      return this.sanitizer.bypassSecurityTrustUrl('');
    }

    const normalized = fileName
      .replace(/^services[\\/]/, '')
      .replace(/\\/g, '/');

    const url =
      `${environment.recruitmentFileBaseUrl}/${normalized}`;

    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  isValidFile(filePath: any): boolean {
    if (!filePath) return false;
    const strPath = String(filePath).trim().toLowerCase();
    if (strPath === '' || strPath === 'null' || strPath === 'undefined') return false;
    return true;
  }
  onComplaintFileChange(event: any) {

    const file =
      event?.target?.files?.[0];

    if (!file) return;

    // Max 1 MB
    const maxSize =
      1 * 1024 * 1024;

    // Allowed Types
    const allowedTypes = [

      'application/pdf',

      'image/png',

      'image/jpeg',

      'image/jpg'

    ];

    // File Size Validation
    if (file.size > maxSize) {

      this.alertService.alertMessage(
        'File Size Limit',
        'File size must be less than 1 MB.',
        'info'
      );

      // Reset
      event.target.value = '';

      this.complaintFile = null;

      return;

    }

    // File Type Validation
    if (!allowedTypes.includes(file.type)) {

      this.alertService.alertMessage(
        'Upload Failed',
        'Only PDF, JPG and PNG files are allowed.',
        'error'
      );

      // Reset
      event.target.value = '';

      this.complaintFile = null;

      return;

    }

    // Success
    this.complaintFile = file;

    this.alertService.alert(

      false,

      'File selected successfully.',

      1200

    );

  }
  submitComplaint() {

    // Problem Validation
    if (!this.selectedProblemId) {

      this.alertService.alertMessage(

        'Warning',

        'Please select problem type.',

        'warning'

      );

      return;

    }

    // Registration Validation
    if (!this.complaintRegistrationNo) {

      this.alertService.alertMessage(

        'Warning',

        'Please enter registration number.',

        'warning'

      );

      return;

    }

    // Problem Description
    if (!this.complaintProblemText?.trim()) {

      this.alertService.alertMessage(

        'Warning',

        'Please enter problem description.',

        'warning'

      );

      return;

    }

    // Loader
    this.alertService.showLoading(
      'Please wait...',
      'Verifying registration details'
    );

    // STEP 1: VERIFY REGISTRATION
    this.HTTP.getData(

      `/publicApi/get/getRegistration?registration_no=${this.complaintRegistrationNo}`,

      'recruitement'

    ).subscribe({

      next: (verifyRes: any) => {

        const data =
          verifyRes?.body?.data || [];

        // Invalid Registration
        if (!data.length) {

          this.alertService.closeAlert();

          this.alertService.alertMessage(

            'Invalid Registration',

            'Registration number not found.',

            'warning'

          );

          return;

        }

        const userData = data[0];

        // STEP 2: CREATE FORMDATA
        const formData = new FormData();

        const payloadObj = {

          problem_id:
          this.selectedProblemId,

          subproblem_id: 0,

          student_emp_id:
          userData.registration_no,

          student_emp_name:
          userData.applicant_name,

          mobile_no:
          userData.mobile_no,

          email_id:
          userData.email_id,

          problem:
          this.complaintProblemText,

          resolve_yn: 'N',

          delete_flag: 'N',

          active_status: 'Y',

          action_type: 'C',

          action_remark:
            'Complaint submitted from recruitment portal',

          action_by:
          userData.registration_no

        };

        formData.append(
          'data',
          JSON.stringify(payloadObj)
        );

        // File
        if (this.complaintFile) {

          formData.append(
            'problem_screen_shot',
            this.complaintFile,
            this.complaintFile.name
          );

        }

        // STEP 3: SAVE COMPLAINT
        this.HTTP.postForm(

          '/public/postFile/saveRecruitmentComplaintRegistration',

          formData,

          'academic'

        ).subscribe({

          next: (res: any) => {

            this.alertService.closeAlert();

            if (
              res?.body?.error ||
              res?.error
            ) {

              const errMsg =

                res?.body?.error?.message ||

                res?.error?.message ||

                'Unable to submit complaint.';

              this.alertService.alertMessage(

                'Warning',

                errMsg,

                'warning'

              );

              return;

            }

            // Success
            this.alertService.alertMessage(

              'Success',

              'Complaint submitted successfully.',

              'success'

            );

            // Reset
            this.selectedProblemId = null;

            this.complaintRegistrationNo = '';

            this.complaintProblemText = '';

            this.complaintFile = null;

          },

          error: (err) => {

            this.alertService.closeAlert();

            console.error(err);

            this.alertService.alertMessage(

              'Error',

              'Unable to submit complaint.',

              'error'

            );

          }

        });

      },

      error: (err) => {

        this.alertService.closeAlert();

        console.error(err);

        this.alertService.alertMessage(

          'Error',

          'Unable to verify registration number.',

          'error'

        );

      }

    });

  }

}
