import { Component, OnInit } from '@angular/core';
import { RecruitmentStateService } from '../../recruitment-state.service';
import { HttpService } from 'shared';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dawapatti',
  standalone: true,
  templateUrl: './dawapatti.component.html',
  styleUrl: './dawapatti.component.scss',
  imports: [CommonModule],
})
export class DawapattiComponent implements OnInit {
  applicantData: any = null;
  subjectList: any[] = [];
  constructor(
    private recruitmentState: RecruitmentStateService,
    private HTTP: HttpService
  ) {}

  ngOnInit(): void {
    const userData = this.recruitmentState.getCurrentUserData();

    if (userData?.registration_no) {
      this.getApplicantData(userData.registration_no);
    }
  }
  get fullNameE() {
    const a = this.applicantData;
    return a
      ? [
          a.Applicant_First_Name_E,
          a.Applicant_Middle_Name_E,
          a.Applicant_Last_Name_E,
        ]
          .filter(Boolean)
          .join(' ')
      : '';
  }
  getFileUrl(fileName: string): string {
    const normalized = fileName
      .replace(/^services[\\/]/, '')
      .replace(/\\/g, '/');
    return `http://192.168.1.57:3500/${normalized}`;
  }

  private getApplicantData(registrationNo: number): void {
    this.HTTP.getParam(
      '/master/get/getApplicant',
      { registration_no: registrationNo, Application_Step_Flag_CES: 'E' },
      'recruitement'
    ).subscribe({
      next: (res) => {
        console.log('✅ Applicant Data:', JSON.stringify(res, null, 2));
        this.applicantData = res?.body?.data[0];
          if (this.applicantData?.post_code) { // <-- Add this check
          this.getSubjectList(this.applicantData.post_code); // <-- Call to fetch subjects
        }
      },
      error: (err) => {
        console.error('❌ Error fetching applicant data:', err);
      },
    });
  }
   get subjectName(): string { // <-- Add this getter
    if (!this.applicantData?.subject_id || this.subjectList.length === 0) {
      return ''; // Or 'Loading...'
    }
    const subject = this.subjectList.find(
      (s) => s.subject_id === this.applicantData.subject_id
    );
    return subject ? subject.Subject_Name_E : 'Unknown Subject';
  }
   private getSubjectList(postCode: number): void { // <-- Add this entire method
    this.HTTP.getParam(
      '/master/get/getSubjectsByPost',
      { post_code: postCode },
      'recruitement'
    ).subscribe({
      next: (res) => {
        this.subjectList = res?.body?.data || [];
        console.log('✅ Subject List:', JSON.stringify(this.subjectList, null, 2));
      },
      error: (err) => {
        console.error('❌ Error fetching subject list:', err);
        this.subjectList = []; // Reset on error
      },
    });
  }
}
