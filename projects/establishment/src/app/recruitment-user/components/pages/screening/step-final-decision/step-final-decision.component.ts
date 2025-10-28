import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpService, AlertService, LoaderService } from 'shared';
import { RecruitmentStateService } from '../../recruitment-state.service';

@Component({
  selector: 'app-step-final-decision',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './step-final-decision.component.html',
  styleUrls: ['./step-final-decision.component.scss'],
})
export class StepFinalDecisionComponent implements OnInit {
  @Output() formData = new EventEmitter<{ [key: string]: any }>();
  @Input() triggerValidation = false;

  decision: string = ''; // 'Y' for eligible, 'N' for not eligible
  remarks: string = '';
  screeningRecordId: number | null = null;
  registrationNo: string = '';

  constructor(
    private http: HttpService,
    private alert: AlertService,
    private loader: LoaderService,
    private recruitmentState: RecruitmentStateService
  ) {}

  ngOnInit() {
    this.loadScreeningRecordInfo();
    this.emitFormData();
  }

  private loadScreeningRecordInfo() {
    const candidateData = this.recruitmentState.getScreeningCandidateData();

    // ✅ FIX: Properly handle the registration number type
    if (candidateData?.registration_no) {
      this.registrationNo = candidateData.registration_no.toString();
    } else {
      this.alert.alert(true, 'Registration number not found');
      return;
    }

    // Get the screening record ID from state or API
    this.getScreeningRecordId();
  }

  private getScreeningRecordId() {
    if (!this.registrationNo) {
      this.alert.alert(true, 'Registration number is required');
      return;
    }

    this.loader.showLoader();

    this.http
      .getParam(
        '/master/get/getApplicant',
        {
          registration_no: this.registrationNo,
          Application_Step_Flag_CES: 'E',
        },
        'recruitement'
      )
      .subscribe({
        next: (response: any) => {
          this.loader.hideLoader();
          if (response?.body?.data && response.body.data.length > 0) {
            // --- START FIX ---

            // 1. Get the full screening record
            const screeningData = response.body.data[0]; // 2. Set the ID

            this.screeningRecordId = screeningData.a_rec_app_main_id;
            console.log(
              '✅ Found screening record ID:',
              this.screeningRecordId
            ); // 3. Patch the form fields with existing data // Use '|| '' ' to prevent 'null' values from breaking the form

            this.decision = screeningData.Verification_Finalize_YN || '';
            this.remarks = screeningData.Verified_Remark || '';

            console.log('✅ Patching form with decision:', this.decision); // 4. Emit the newly loaded data

            this.emitFormData();
          } else {
            this.alert.alert(
              true,
              'No screening record found for final decision.'
            );
          }
        },
        error: (err) => {
          this.loader.hideLoader();
          this.alert.alert(
            true,
            'Failed to load screening record information.'
          );
        },
      });
  }

  onDecisionChange(decision: string) {
    this.decision = decision;
    this.emitFormData();
  }

  onRemarksChange() {
    this.emitFormData();
  }

  emitFormData() {
    const formData = {
      verificationFinalizeYN: this.decision,
      verificationRemarks: this.remarks,
      screeningRecordId: this.screeningRecordId,
      registrationNo: this.registrationNo,
      _isValid: this.isFormValid(),
    };

    this.formData.emit(formData);
  }

  isFormValid(): boolean {
    // For 'N' decision, remarks are required
    if (this.decision === 'N') {
      return !!this.decision && !!this.remarks?.trim();
    }
    // For 'Y' decision, only the decision is required
    return !!this.decision;
  }

  async submitForm(): Promise<void> {
    if (!this.isFormValid()) {
      if (this.decision === 'N' && !this.remarks?.trim()) {
        this.alert.alert(
          true,
          'Please provide reason for rejection when marking candidate as not eligible'
        );
      } else {
        this.alert.alert(
          true,
          'Please select a decision (Eligible/Not Eligible)'
        );
      }
      throw new Error('Form is invalid');
    }

    if (!this.screeningRecordId) {
      this.alert.alert(true, 'No screening record found to update');
      throw new Error('Screening record ID missing');
    }

    if (!this.registrationNo) {
      this.alert.alert(true, 'Registration number is required');
      throw new Error('Registration number missing');
    }

    this.loader.showLoader();

    const payload = {
      a_rec_app_main_id: this.screeningRecordId,
      Verification_Finalize_YN: this.decision,
      Verified_Remark: this.remarks?.trim() || null,
      registration_no: this.registrationNo,
    };

    return new Promise((resolve, reject) => {
      this.http
        .postForm(
          '/candidate/postFile/updateScreeningFinalDecision',
          payload,
          'recruitement'
        )
        .subscribe({
          next: (res: any) => {
            this.loader.hideLoader();
            if (res?.body?.error) {
              this.alert.alert(
                true,
                res.body.error.message || 'Failed to update final decision'
              );
              reject(new Error(res.body.error.message));
              return;
            }

            const statusMessage =
              this.decision === 'Y'
                ? 'Candidate marked as Eligible successfully!'
                : 'Candidate marked as Not Eligible successfully!';

            this.alert.alert(false, statusMessage);
            resolve();
          },
          error: (err) => {
            this.loader.hideLoader();
            this.alert.alert(
              true,
              'Failed to update final decision. Please try again.'
            );
            reject(err);
          },
        });
    });
  }
}
