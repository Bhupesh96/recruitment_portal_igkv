import { Component, OnInit, ViewChild, ElementRef, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpService, AlertService } from 'shared';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification.component.html'
})
export class NotificationComponent implements OnInit, OnDestroy {
  @Input() isComplaintActive: boolean = false;
  @ViewChild('chatBody') chatBody!: ElementRef;

  complaintProblems: any[] = [];
  selectedProblemId: number | null = null;
  selectedPastComplaint: any = null;

  chatStep:
    | 'PROBLEM'
    | 'REGISTRATION'
    | 'OTP'
    | 'DASHBOARD'
    | 'DESCRIPTION'
    | 'ATTACHMENT'
    | 'SUBMIT'
    | 'THREAD'
    = 'REGISTRATION';

  complaintRegistrationNo = '';
  complaintUserData: any = null;
  complaintProblemText = '';
  complaintFile: File | null = null;
  showComplaintChat = false;
  newChatMessage = '';

  pastComplaints: any[] = [];

  resendSeconds = 30;
  canResendOtp = false;
  private resendInterval: any;
  private candidatePollingInterval: any;

  chatMessages: any[] = [
    { sender: 'ADMIN', message: 'Welcome to Recruitment Support 👋', time: new Date().toLocaleTimeString() },
    { sender: 'ADMIN', message: 'Please enter your Registration Number to begin.', time: new Date().toLocaleTimeString() }
  ];

  constructor(
    private HTTP: HttpService,
    private alertService: AlertService
  ) {}

  ngOnInit() {
    this.getComplaintProblems();
  }

  ngOnDestroy() {
    if (this.resendInterval) clearInterval(this.resendInterval);
    this.stopCandidatePolling();
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.chatBody) {
        this.chatBody.nativeElement.scrollTop = this.chatBody.nativeElement.scrollHeight;
      }
    }, 100);
  }

  handleKeypress(event: KeyboardEvent): boolean {
    if (this.chatStep === 'OTP') return this.restrictToNumbers(event);
    return true;
  }

  restrictToNumbers(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  getComplaintProblems() {
    this.HTTP.getData('/publicApi/get/getComplaintProblems?module_id=12', 'recruitement').subscribe({
      next: (res: any) => { this.complaintProblems = res?.body?.data || []; },
      error: () => { this.complaintProblems = []; }
    });
  }

  sendChatMessage() {
    if (!this.newChatMessage?.trim()) return;
    const userText = this.newChatMessage.trim();
    this.newChatMessage = '';

    if (this.chatStep === 'REGISTRATION') {
      this.appendUserMessage(userText);
      this.verifyRegistrationFlow(userText);
      return;
    }

    if (this.chatStep === 'OTP') {
      this.appendUserMessage(userText);
      this.verifyOtp(userText);
      return;
    }

    if (this.chatStep === 'DESCRIPTION') {
      this.appendUserMessage(userText);
      this.complaintProblemText = userText;
      this.chatMessages = [
        ...this.chatMessages,
        { sender: 'ADMIN', message: 'Thank you. Would you like to upload a screenshot? (Optional)', time: new Date().toLocaleTimeString() }
      ];
      this.chatStep = 'ATTACHMENT';
      this.scrollToBottom();
      return;
    }

    if (this.chatStep === 'THREAD' && this.selectedPastComplaint) {
      this.appendUserMessage(userText);

      const payloadObj = {
        complain_id: this.selectedPastComplaint.complain_id,
        sender_type: 'CANDIDATE',
        message: userText
      };

      this.HTTP.postData('/public/post/saveComplaintReply', payloadObj, 'academic').subscribe({
        next: () => {},
        error: () => {
          this.chatMessages = [
            ...this.chatMessages,
            { sender: 'ADMIN', message: '⚠️ Failed to deliver message. Check internet connection.', time: new Date().toLocaleTimeString() }
          ];
          this.scrollToBottom();
        }
      });
      return;
    }
  }

  private appendUserMessage(text: string) {
    this.chatMessages = [...this.chatMessages, { sender: 'USER', message: text, time: new Date().toLocaleTimeString() }];
    this.scrollToBottom();
  }

  verifyRegistrationFlow(userText: string) {
    this.HTTP.getData(`/publicApi/get/getRegistration?registration_no=${userText}`, 'recruitement').subscribe({
      next: (res: any) => {
        const data = res?.body?.data || [];
        if (data.length) {
          this.complaintRegistrationNo = userText;
          this.complaintUserData = data[0];
          this.chatMessages = [...this.chatMessages, { sender: 'ADMIN', message: `Verifying account...`, time: new Date().toLocaleTimeString() }];
          this.sendOtp();
          return;
        }

        this.HTTP.getData(`/publicApi/get/getForgotPassword?registration_no=${userText}`, 'recruitement').subscribe({
          next: (fpRes: any) => {
            const fpData = fpRes?.body?.data || [];
            if (!fpData.length) {
              this.chatMessages = [...this.chatMessages, { sender: 'ADMIN', message: 'Registration number not found.', time: new Date().toLocaleTimeString() }];
              this.scrollToBottom();
              return;
            }
            this.complaintRegistrationNo = userText;
            this.complaintUserData = { registration_no: fpData[0].registration_no, mobile_no: fpData[0].mobile_no, email_id: fpData[0].email_id };
            this.sendOtp();
          },
          error: () => { this.triggerRegError(); }
        });
      },
      error: () => { this.triggerRegError(); }
    });
  }

  private triggerRegError() {
    this.chatMessages = [...this.chatMessages, { sender: 'ADMIN', message: 'Server failed to verify registration.', time: new Date().toLocaleTimeString() }];
    this.scrollToBottom();
  }

  sendOtp() {
    const payload = {
      mobile_no: this.complaintUserData.mobile_no, email_id: this.complaintUserData.email_id,
      registration_no: this.complaintUserData.registration_no, purpose: 'COMPLAINT', action_remark: 'Online Complaint OTP'
    };

    this.HTTP.postData('/publicapi/post/saveRecruitmentOtpVerification', payload, 'recruitement').subscribe({
      next: (res: any) => {
        const resString = (typeof res === 'string') ? res : JSON.stringify(res);
        if (resString.includes('GEN016') || resString.includes('User not registered')) {
          this.chatMessages = [...this.chatMessages, { sender: 'ADMIN', message: 'User not registered in Sandes app.', time: new Date().toLocaleTimeString() }];
          this.chatStep = 'REGISTRATION';
          return;
        }
        this.chatMessages = [...this.chatMessages, { sender: 'ADMIN', message: 'An OTP has been sent to your registered mobile number.', time: new Date().toLocaleTimeString() }];
        this.chatStep = 'OTP';
        this.startOtpTimer();
        this.scrollToBottom();
      },
      error: () => { this.chatStep = 'REGISTRATION'; }
    });
  }

  verifyOtp(otpCode: string) {
    this.HTTP.postData('/publicapi/post/verifyRecruitmentOtp', { mobile_no: this.complaintUserData.mobile_no, otp: otpCode, registration_no: this.complaintUserData.registration_no }, 'recruitement').subscribe({
      next: (res: any) => {
        if (!res?.body?.data || res.body.data.length === 0) {
          this.chatMessages = [...this.chatMessages, { sender: 'ADMIN', message: 'Invalid OTP.', time: new Date().toLocaleTimeString() }];
          return;
        }
        if (this.resendInterval) clearInterval(this.resendInterval);
        this.fetchPastComplaints();
      }
    });
  }

  fetchPastComplaints() {
    this.HTTP.getData(`/public/get/getRecruitmentCandidateComplaintList?student_emp_id=${this.complaintRegistrationNo}`, 'academic').subscribe({
      next: (res: any) => {
        this.pastComplaints = res?.body?.data || [];
        this.chatStep = this.pastComplaints.length > 0 ? 'DASHBOARD' : 'PROBLEM';
        this.scrollToBottom();
      },
      error: () => {
        this.pastComplaints = [];
        this.chatStep = 'PROBLEM';
      }
    });
  }

  startCandidatePolling() {
    this.stopCandidatePolling();
    this.candidatePollingInterval = setInterval(() => {
      if (this.chatStep === 'THREAD' && this.selectedPastComplaint && this.selectedPastComplaint.resolve_yn !== 'Y') {
        this.silentFetchReplies();
      }
    }, 5000);
  }

  stopCandidatePolling() {
    if (this.candidatePollingInterval) {
      clearInterval(this.candidatePollingInterval);
    }
  }

  silentFetchReplies() {
    if (!this.selectedPastComplaint) return;

    this.HTTP.getData(`/public/get/getComplaintReplies?complain_id=${this.selectedPastComplaint.complain_id}`, 'academic').subscribe({
      next: (res: any) => {
        const replies = res?.body?.data || res?.data || [];
        const expectedTotalLength = 1 + replies.length;

        if (expectedTotalLength > this.chatMessages.length) {
          const threadBubbles = replies.map((r: any) => ({
            sender: r.sender_type === 'ADMIN' ? 'ADMIN' : 'USER',
            message: r.message,
            time: new Date(r.reply_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));

          this.chatMessages = [this.chatMessages[0], ...threadBubbles];
          this.scrollToBottom();
        }
      }
    });
  }

  openComplaintThread(comp: any) {
    this.selectedPastComplaint = comp;
    this.chatStep = 'THREAD';

    this.chatMessages = [
      { sender: 'USER', message: comp.problem, time: new Date(comp.problem_date).toLocaleTimeString() }
    ];

    this.HTTP.getData(`/public/get/getComplaintReplies?complain_id=${comp.complain_id}`, 'academic').subscribe({
      next: (res: any) => {
        const replies = res?.body?.data || res?.data || [];

        const threadBubbles = replies.map((r: any) => ({
          sender: r.sender_type === 'ADMIN' ? 'ADMIN' : 'USER',
          message: r.message,
          time: new Date(r.reply_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        this.chatMessages = [this.chatMessages[0], ...threadBubbles];

        // Bubble removed. Relying strictly on the HTML banner for resolution message now.
        if (comp.resolve_yn !== 'Y') {
          this.startCandidatePolling();
        }
        this.scrollToBottom();
      },
      error: () => { this.chatStep = 'DASHBOARD'; }
    });
  }

  backToDashboard() {
    this.stopCandidatePolling();
    this.selectedPastComplaint = null;
    this.chatMessages = [{ sender: 'ADMIN', message: 'Inbox loaded.', time: new Date().toLocaleTimeString() }];
    this.fetchPastComplaints();
  }

  startNewComplaint() {
    const pendingCount = this.pastComplaints.filter(c => c.resolve_yn !== 'Y').length;

    if (pendingCount >= 3) {
      this.alertService.alertMessage(
        'Limit Reached',
        'You have 3 or more pending complaints. Please resolve them from your dashboard before raising a new one.',
        'warning'
      );
      return;
    }

    this.chatMessages = [...this.chatMessages, { sender: 'ADMIN', message: 'Select your issue type below.', time: new Date().toLocaleTimeString() }];
    this.chatStep = 'PROBLEM';
    this.scrollToBottom();
  }

  resolveComplaintByCandidate() {
    if (!this.selectedPastComplaint) return;

    this.alertService.showLoading('Resolving...', 'Closing your ticket');

    const payloadObj = {
      complain_id: this.selectedPastComplaint.complain_id,
      resolve_remark: 'Resolved by Candidate',
      resolve_yn: 'Y',
      sender_type: 'CANDIDATE',
      action_by: this.complaintUserData?.registration_no || 0
    };

    this.HTTP.postData('/public/post/resolveComplaint', payloadObj, 'academic').subscribe({
      next: (res: any) => {
        this.alertService.closeAlert();
        if (res?.body?.error) {
          this.alertService.alertMessage('Warning', res.body.error.message, 'warning');
          return;
        }

        this.alertService.alert(false, 'Ticket marked as resolved successfully.', 2000);
        this.stopCandidatePolling();

        this.selectedPastComplaint.resolve_yn = 'Y';
        this.selectedPastComplaint.resolve_remark = 'Resolved by Candidate';

        const listIndex = this.pastComplaints.findIndex(c => c.complain_id === this.selectedPastComplaint.complain_id);
        if (listIndex > -1) {
          this.pastComplaints[listIndex].resolve_yn = 'Y';
        }

        this.scrollToBottom();
      },
      error: (err) => {
        console.error(err);
        this.alertService.closeAlert();
        this.alertService.alertMessage('Error', 'Unable to resolve complaint.', 'error');
      }
    });
  }

  startOtpTimer() {
    this.canResendOtp = false; this.resendSeconds = 30;
    if (this.resendInterval) clearInterval(this.resendInterval);
    this.resendInterval = setInterval(() => {
      if (this.resendSeconds > 0) this.resendSeconds--;
      else { this.canResendOtp = true; clearInterval(this.resendInterval); }
    }, 1000);
  }

  resendOtp() { if (this.canResendOtp) this.sendOtp(); }

  selectProblem(problem: any) {
    this.selectedProblemId = problem.problem_id;
    this.appendUserMessage(problem.problem_short_name);
    this.chatMessages = [...this.chatMessages, { sender: 'ADMIN', message: 'Please type the details of your issue.', time: new Date().toLocaleTimeString() }];
    this.chatStep = 'DESCRIPTION';
  }

  finishAttachmentStep() {
    this.chatMessages = [...this.chatMessages, { sender: 'ADMIN', message: 'Ready to register. Click submit below.', time: new Date().toLocaleTimeString() }];
    this.chatStep = 'SUBMIT';
  }

  onComplaintFileChange(event: any) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (file.size > 1048576) { this.alertService.alertMessage('Limit', 'File must be < 1MB', 'info'); return; }
    this.complaintFile = file;
    this.alertService.alert(false, 'File attached.', 1000);
  }

  submitComplaint() {
    if (!this.selectedProblemId || !this.complaintProblemText?.trim()) return;
    this.alertService.showLoading('Please wait...', 'Submitting ticket');

    const formData = new FormData();
    formData.append('data', JSON.stringify({
      problem_id: this.selectedProblemId, subproblem_id: 0, student_emp_id: this.complaintUserData.registration_no,
      student_emp_name: this.complaintUserData?.applicant_name || this.complaintRegistrationNo, mobile_no: this.complaintUserData.mobile_no,
      email_id: this.complaintUserData.email_id, problem: this.complaintProblemText, resolve_yn: 'N', delete_flag: 'N', active_status: 'Y', action_type: 'C',
      action_remark: 'Submitted via portal', action_by: this.complaintUserData.registration_no
    }));

    if (this.complaintFile) formData.append('problem_screen_shot', this.complaintFile, this.complaintFile.name);

    this.HTTP.postForm('/public/postFile/saveRecruitmentComplaintRegistration', formData, 'academic').subscribe({
      next: () => {
        this.alertService.closeAlert();
        this.alertService.alertMessage('Success', 'Complaint registered successfully.', 'success');
        this.backToDashboard();
      },
      error: () => { this.alertService.closeAlert(); }
    });
  }
}
