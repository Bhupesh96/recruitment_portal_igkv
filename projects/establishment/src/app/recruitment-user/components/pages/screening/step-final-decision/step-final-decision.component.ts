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
  registrationNo: string = '';

  // ✅ MODIFIED: Store both 'C' and 'E' record IDs
  screeningRecordId: number | null = null; // The 'E' record ID (e.g., 58)
  candidateRecordId: number | null = null; // The 'C' record ID (e.g., 12)
  postDetailId: number | null = null;
  
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

    // candidateData from state holds the *original* candidate 'C' IDs
    if (candidateData?.registration_no) {
      this.registrationNo = candidateData.registration_no.toString();
    } else {
      this.alert.alert(true, 'Registration number not found in state');
      return;
    }

    // ✅ STORE THE 'C' ID (12)
    if (candidateData?.a_rec_app_main_id) {
      this.candidateRecordId = candidateData.a_rec_app_main_id;
      console.log('✅ Stored candidate record ID (C):', this.candidateRecordId);
    } else {
      this.alert.alert(true, 'Candidate Application ID not found in state');
      return;
    }

    // This function will find and set the 'E' ID (58)
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
            const screeningData = response.body.data[0];

            // SET ALL REQUIRED IDs FOR THE 'E' RECORD
            this.screeningRecordId = screeningData.a_rec_app_main_id; // (e.g., 58)
            this.postDetailId = screeningData.post_code;
            this.registrationNo = screeningData.registration_no.toString();

            console.log(
              '✅ Found screening record ID (E):',
              this.screeningRecordId
            );
            console.log(
              '✅ Found post detail ID:',
              this.postDetailId
            );

            // Patch the form fields
            this.decision = screeningData.Verification_Finalize_YN || '';
            this.remarks = screeningData.Verified_Remark || '';

            console.log('✅ Patching form with decision:', this.decision);
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
    // 1. Validate Form
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

    // 2. Validate required IDs
    if (
      !this.screeningRecordId || // 'E' ID (58)
      !this.candidateRecordId || // 'C' ID (12)
      !this.registrationNo ||
      !this.postDetailId
    ) {
      this.alert.alert(true, 'Key application data is missing. Cannot save.');
      console.error('Missing key data:', {
        e_id: this.screeningRecordId,
        c_id: this.candidateRecordId,
        reg: this.registrationNo,
        post: this.postDetailId,
      });
      throw new Error('Application data (C_ID, E_ID, RegNo, or PostID) missing');
    }

    this.loader.showLoader();

    // 3. Define Payloads
    const syncPayload = {
      registration_no: this.registrationNo,
      app_main_id: this.candidateRecordId, // <-- Use 'C' ID (12)
      post_detail_id: this.postDetailId,
    };

    const finalizePayload = {
      a_rec_app_main_id: this.screeningRecordId, // <-- Use 'E' ID (58)
      Verification_Finalize_YN: this.decision,
      Verified_Remark: this.remarks?.trim() || null,
      registration_no: this.registrationNo,
    };

    // 4. Create Promise for chaining
    return new Promise((resolve, reject) => {
      // --- First Call: Sync Data ---
      console.log('--- 1. Starting C-to-E Sync ---', syncPayload);
      this.http
        .postForm(
          '/candidate/postFile/syncScreeningAndScoringData',
          syncPayload,
          'recruitement'
        )
        .subscribe({
          next: (syncRes: any) => {
            if (syncRes?.body?.error) {
              // Error during sync
              this.loader.hideLoader();
              this.alert.alert(
                true,
                `Data Sync Failed: ${syncRes.body.error.message}`
              );
              reject(new Error(syncRes.body.error.message));
              return;
            }

            console.log(
              '--- 2. Sync Complete. Finalizing Decision ---',
              finalizePayload
            );

            // --- Second Call: Finalize Decision ---
            this.http
              .postForm(
                '/candidate/postFile/updateScreeningFinalDecision',
                finalizePayload, // <-- uses correct payload
                'recruitement'
              )
              .subscribe({
                next: (finalRes: any) => {
                  this.loader.hideLoader();
                  if (finalRes?.body?.error) {
                    // Error during finalize
                    this.alert.alert(
                      true,
                      `Finalize Failed: ${finalRes.body.error.message}`
                    );
                    reject(new Error(finalRes.body.error.message));
                    return;
                  }

                  // --- SUCCESS ---
                  const statusMessage =
                    this.decision === 'Y'
                      ? 'Candidate marked as Eligible successfully!'
                      : 'Candidate marked as Not Eligible successfully!';
                  this.alert.alert(false, statusMessage);
                  resolve(); // Success!
                },
                error: (finalErr) => {
                  // Network/HTTP error on second call
                  this.loader.hideLoader();
                  this.alert.alert(
                    true,
                    'Failed to update final decision. Please try again.'
                  );
                  reject(finalErr);
                },
              });
          },
          error: (syncErr) => {
            // Network/HTTP error on first call
            this.loader.hideLoader();
            this.alert.alert(true, 'Failed to sync data. Please try again.');
            reject(syncErr);
          },
        });
    });
  }
}