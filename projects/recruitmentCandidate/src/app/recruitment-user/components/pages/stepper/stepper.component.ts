import { Component, ViewChild, OnInit, OnDestroy, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';

import { SharedDataService } from '../shared-data.service';
import { AlertService, HttpService } from 'shared';
import { RecruitmentStateService, UserRecruitmentData } from '../recruitment-state.service';

import { Step1Component } from './step-1/step-1.component';
import { Step2Component } from './step-2/step-2.component';
import { Step3Component } from './step-3/step-3.component';
import { Step4Component } from './step-4/step-4.component';
import { Step5Component } from './step-5/step-5.component';
import { Step6Component } from './step-6/step-6.component';
import { Step9Component } from './step-9/step-9.component';
import { PdfDownloadComponent } from '../pdf-download/pdf-download.component';

export interface StepDefinition {
  compId: number;
  name: string;
  fieldId?: number; // Maps to m_rec_score_field_id from API
  isMandatory?: boolean; // True for Personal Info & Final Submit
}

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    Step1Component, Step2Component, Step3Component, Step4Component,
    Step5Component, Step6Component, Step9Component, PdfDownloadComponent,
  ],
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.scss'],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('400ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' })),
      ]),
    ]),
  ],
})
export class StepperComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild(Step1Component, { static: false }) step1Component?: Step1Component;
  @ViewChild(Step2Component, { static: false }) step2Component?: Step2Component;
  @ViewChild(Step3Component, { static: false }) step3Component?: Step3Component;
  @ViewChild(Step4Component, { static: false }) step4Component?: Step4Component;
  @ViewChild(Step5Component, { static: false }) step5Component?: Step5Component;
  @ViewChild(Step6Component, { static: false }) step6Component?: Step6Component;
  @ViewChild(Step9Component, { static: false }) step9Component?: Step9Component;
  @ViewChild('pdfDownloadComponent') pdfDownloadComponent!: PdfDownloadComponent;

  // ✅ 1. Define the Master Mapping of your Steps to the API's m_rec_score_field_id
  masterSteps: StepDefinition[] = [
    { compId: 1, name: 'Personal Info', isMandatory: true }, // Always show
    { compId: 2, name: 'Education', fieldId: 1 },            // Mapped to ID 1
    { compId: 3, name: 'Academics', fieldId: 8 },            // Mapped to ID 8
    // ⚠️ UPDATE the fieldIds below with the actual DB IDs for these steps
    { compId: 4, name: 'Publications', fieldId: 3 },
    { compId: 5, name: 'Experience', fieldId: 4 },
    { compId: 6, name: 'Performance', fieldId: 5 },
    { compId: 9, name: 'Preview & Submit', isMandatory: true } // Always show
  ];

  // The actual steps that will be rendered
  activeSteps: StepDefinition[] = [];
  currentStepIndex = 0; // Tracks position in activeSteps array

  formData: { [key: number]: { [key: string]: any } } = {};
  private printTriggered = false;
  isFinalDeclared = false;
  private userSub!: Subscription;
  private dbCheckDone = false;
  isLoadingSteps = true; // Prevents UI from rendering until API maps steps

  constructor(
    private sharedDataService: SharedDataService,
    private alertService: AlertService,
    private recruitmentStateService: RecruitmentStateService,
    private http: HttpService
  ) {}

  ngOnInit(): void {
    // Start by assuming only mandatory steps are active until API loads
    this.activeSteps = this.masterSteps.filter(s => s.isMandatory);

    this.userSub = this.recruitmentStateService.userData$.subscribe((user: any) => {
      if (user) {
        // Fetch dynamic steps from API using user data
        this.fetchDynamicSteps(user);

        // Lock form if already declared
        if (user['Is_Final_Decl_YN'] === 'Y' || user['is_final_decl_yn'] === 'Y') {
          this.isFinalDeclared = true;
        } else if (user.registration_no && !this.dbCheckDone) {
          this.dbCheckDone = true;
          this.verifyLockStatusFromDB(user.registration_no);
        }
      }
    });
  }

  // ✅ 2. Call API and filter master steps
  fetchDynamicSteps(user: any) {
    if (!user || !user.a_rec_adv_main_id) return;

    // Build params for the API based on the logged-in user
    const params = {
      a_rec_adv_main_id: user.a_rec_adv_main_id,
      post_code: user.post_code,
      subject_id: user.subject_id,
      m_rec_es_master_id: user.m_rec_es_master_id || 4 // Fallback to 4 based on your URL example
    };

    this.http.getParam('/master/get/getESCalculationSteps', params, 'recruitement').subscribe({
      next: (res: any) => {
        const apiData = res?.body?.data || res?.data || [];

        // Extract all allowed field IDs
        const allowedFieldIds = apiData.map((item: any) => item.m_rec_score_field_id);

        // Filter the master list
        this.activeSteps = this.masterSteps.filter(step =>
          step.isMandatory || (step.fieldId && allowedFieldIds.includes(step.fieldId))
        );

        this.isLoadingSteps = false;

        // If declared, force jump to the last step (Preview & Submit)
        if (this.isFinalDeclared) {
          this.currentStepIndex = this.activeSteps.length - 1;
        }
      },
      error: (err) => {
        console.error('Failed to load calculation steps', err);
        this.isLoadingSteps = false;
      }
    });
  }

  verifyLockStatusFromDB(registrationNo: string | number) {
    this.http.getParam('/master/get/getApplicant', {
      registration_no: registrationNo,
      Application_Step_Flag_CES: 'C'
    }, 'recruitement').subscribe({
      next: (res: any) => {
        const freshUser = res?.body?.data?.[0];
        if (freshUser && (freshUser.Is_Final_Decl_YN === 'Y' || freshUser.is_final_decl_yn === 'Y')) {
          this.recruitmentStateService.updateUserData({ Is_Final_Decl_YN: 'Y' });
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.userSub) this.userSub.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (this.printTriggered && this.pdfDownloadComponent) {
      this.pdfDownloadComponent.downloadAsPdf();
      this.printTriggered = false;
    }
  }

  updateFormData(compId: number, data: { [key: string]: any }) {
    this.formData[compId] = { ...data };
    if (this.isFinalDeclared) {
      this.sharedDataService.setFormData(this.formData);
    }
  }

  async nextStep() {
    if (this.isFinalDeclared) return;

    const currentCompId = this.activeSteps[this.currentStepIndex].compId;

    try {
      // Trigger submission based on the ACTIVE component ID
      if (currentCompId === 9) {
        if (this.step9Component) await this.step9Component.submit();
        return;
      }

      switch (currentCompId) {
        case 1: if (this.step1Component) await this.step1Component.submitForm(); break;
        case 2: if (this.step2Component) await this.step2Component.submitForm(); break;
        case 3: if (this.step3Component) await this.step3Component.submit(); break;
        case 4: if (this.step4Component) await this.step4Component.submit(); break;
        case 5: if (this.step5Component) await this.step5Component.submitForm(); break;
        case 6: if (this.step6Component) await this.step6Component.submit(); break;
      }

      // Move to next step in the dynamic array
      if (this.currentStepIndex < this.activeSteps.length - 1) {
        const nextCompId = this.activeSteps[this.currentStepIndex + 1].compId;
        if (nextCompId === 9) {
          this.sharedDataService.setFormData(this.formData);
        }
        this.currentStepIndex++;
      }
    } catch (error) {
      console.error(`Validation failed for component ${currentCompId}:`, error);
    }
  }

  prevStep() {
    if (this.isFinalDeclared) return;
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
    }
  }

  goToStep(index: number) {
    if (this.isFinalDeclared) return;

    // Only allow jumping forward if previous step is valid, or jumping backward
    if (this.isStepCompleted(index - 1) || index < this.currentStepIndex) {
      this.currentStepIndex = index;
    }
  }

  isStepCompleted(index: number): boolean {
    if (this.isFinalDeclared) return true;
    if (index < 0) return true; // First step is implicitly reachable

    const compId = this.activeSteps[index].compId;
    const stepData = this.formData[compId];
    return !!(stepData && stepData['_isValid']);
  }

  onFinalSubmitSuccess() {
    this.isFinalDeclared = true;
    this.currentStepIndex = this.activeSteps.length - 1;
  }

  triggerManualDownload() {
    if (this.pdfDownloadComponent) {
      this.pdfDownloadComponent.formData = this.formData;
      setTimeout(() => {
        this.pdfDownloadComponent.downloadAsPdf();
      }, 100);
    }
  }
}
