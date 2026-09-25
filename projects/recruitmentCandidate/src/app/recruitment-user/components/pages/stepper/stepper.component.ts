  import { Component, ViewChild, OnInit, OnDestroy, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';

import { SharedDataService } from '../shared-data.service';
import {AlertService, AuditLoggerService, HttpService} from 'shared';
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

  // 1. Define the Master Mapping of your Steps to the API's m_rec_score_field_id
  masterSteps: StepDefinition[] = [
    { compId: 1, name: 'Personal Info', isMandatory: true }, // Always show
    { compId: 2, name: 'Education', fieldId: 1 },            // Mapped to ID 1
    { compId: 3, name: 'Academics', fieldId: 8 },            // Mapped to ID 8
    { compId: 4, name: 'Publications', fieldId: 3096 },      // Mapped to ID 3096
    { compId: 5, name: 'Experience', fieldId: 32 },          // Mapped to ID 32
    { compId: 6, name: 'Performance', fieldId: 34 },         // Mapped to ID 34
    { compId: 9, name: 'Preview & Submit', isMandatory: true } // Always show
  ];

  // The actual steps that will be rendered
  activeSteps: StepDefinition[] = [];
  currentStepIndex = 0; // Tracks position in activeSteps array

  // ✅ Track which components the user has actually viewed to allow lazy loading
  visitedSteps: number[] = [];

  formData: { [key: number]: { [key: string]: any } } = {};
  private printTriggered = false;
  private consumePdfDownloadRequest = false;
  private areDynamicStepsLoaded = false;
  isFinalDeclared = false;
  private userSub!: Subscription;
  private pdfDownloadSub!: Subscription;
  private dbCheckDone = false;
  private pdfPreparing = false;
  private pdfPrepareAttempts = 0;
  isLoadingSteps = true; // Prevents UI from rendering until API maps steps

  constructor(
    private sharedDataService: SharedDataService,
    private alertService: AlertService,
    private recruitmentStateService: RecruitmentStateService,
    private http: HttpService,
    private auditLogger: AuditLoggerService,
  ) {}

  ngOnInit(): void {
    // Start by assuming only mandatory steps are active until API loads
    this.activeSteps = this.masterSteps.filter(s => s.isMandatory);

    // 1. Immediately check if we already have the user data synchronously
    const currentUser = this.recruitmentStateService.getCurrentUserData();
    if (currentUser && currentUser.a_rec_adv_main_id) {
      this.handleUserReady(currentUser);
    }

    // 2. Also subscribe in case it loads asynchronously later (or changes)
    this.userSub = this.recruitmentStateService.userData$.subscribe((user: any) => {
      if (user && user.a_rec_adv_main_id) {
        this.handleUserReady(user);
      }
    });
    this.pdfDownloadSub = this.sharedDataService.pdfDownloadRequested$.subscribe(
      (requested) => {
        if (requested) {
          this.prepareAndDownloadPdf();
        }
      }
    );
    // 3. Fallback: If 5 seconds pass and we STILL haven't loaded steps, abort the spinner
    setTimeout(() => {
      if (this.isLoadingSteps) {
        console.warn("User data took too long to load. Aborting spinner.");
        this.isLoadingSteps = false;
        this.areDynamicStepsLoaded = true;
      }
    }, 5000);
  }
  private prepareAndDownloadPdf(): void {
    if (this.pdfPreparing) {
      return;
    }

    if (!this.areDynamicStepsLoaded || !this.activeSteps.length) {
      return;
    }

    this.pdfPreparing = true;
    this.pdfPrepareAttempts = 0;

    // IMPORTANT:
    // Load every active step, not only the current/visited step.
    this.activeSteps.forEach((_, index) => {
      this.markStepAsVisited(index);
    });

    // Give Angular time to create all step components.
    setTimeout(() => {
      this.waitForAllStepDataAndDownload();
    }, 100);
  }
  private waitForAllStepDataAndDownload(): void {
    this.pdfPrepareAttempts++;

    const requiredSteps = this.activeSteps.filter(
      step => step.compId !== 9
    );

    const allStepComponentsLoaded =
      requiredSteps.every(step => {
        switch (step.compId) {
          case 1:
            return !!this.step1Component;

          case 2:
            return !!this.step2Component;

          case 3:
            return !!this.step3Component;

          case 4:
            return !!this.step4Component;

          case 5:
            return !!this.step5Component;

          case 6:
            return !!this.step6Component;

          default:
            return true;
        }
      });

    const allStepDataLoaded =
      requiredSteps.every(step => {
        const data = this.formData[step.compId];

        return data && Object.keys(data).length > 0;
      });

    if (
      allStepComponentsLoaded &&
      allStepDataLoaded
    ) {
      this.sharedDataService.setFormData(this.formData);

      setTimeout(() => {
        if (this.pdfDownloadComponent) {
          this.pdfDownloadComponent.formData =
            JSON.parse(JSON.stringify(this.formData));

          this.pdfDownloadComponent.downloadAsPdf();
        }

        this.pdfPreparing = false;
        this.sharedDataService.completeLatestPdfDownloadRequest();
      }, 200);

      return;
    }

    // Wait for step components/API data.
    if (this.pdfPrepareAttempts < 50) {
      setTimeout(() => {
        this.waitForAllStepDataAndDownload();
      }, 200);

      return;
    }

    console.error(
      'PDF download stopped: all step data was not loaded.',
      {
        activeSteps: this.activeSteps,
        formData: this.formData
      }
    );

    this.pdfPreparing = false;
    this.sharedDataService.completeLatestPdfDownloadRequest();
  }
  private handleUserReady(user: any) {
    // 1. ALWAYS evaluate the Final Declaration lock status FIRST
    if (user['Is_Final_Decl_YN'] === 'Y' || user['is_final_decl_yn'] === 'Y') {
      this.isFinalDeclared = true;

      // Force jump to the last step if the steps array is already populated
      if (this.activeSteps.length > 0) {
        this.currentStepIndex = this.activeSteps.length - 1;
      }
    } else if (user.registration_no && !this.dbCheckDone) {
      this.dbCheckDone = true;
      this.verifyLockStatusFromDB(user.registration_no);
    }

    // 2. NOW check if we need to prevent fetching steps multiple times
    if (!this.isLoadingSteps && this.activeSteps.length > 2) return;

    this.fetchDynamicSteps(user);
  }

fetchDynamicSteps(user: any) {
  if (!user || !user.a_rec_adv_main_id) return;

  const params = {
    a_rec_adv_main_id: user.a_rec_adv_main_id,
    post_code: user.post_code,
    subject_id: user.subject_id,
    m_rec_es_master_id: 4
  };

  this.http.getParam(
    '/master/get/getESCalculationSteps',
    params,
    'recruitement'
  ).subscribe({

    next: (res: any) => {

      const apiData = res?.body?.data || res?.data || [];

      console.log('Calculation Steps API:', apiData);


      // =====================================================
      // CREATE MAP:
      // m_rec_score_field_id -> display_order
      // =====================================================

      const displayOrderMap = new Map<number, number>();

      apiData.forEach((item: any) => {

        const fieldId = Number(item.m_rec_score_field_id);
        const displayOrder = Number(item.display_order);

        if (
          fieldId > 0 &&
          displayOrder > 0
        ) {
          displayOrderMap.set(
            fieldId,
            displayOrder
          );
        }

      });


      // =====================================================
      // GET ALLOWED STEPS
      // =====================================================

      const dynamicSteps = this.masterSteps.filter(step =>

        step.isMandatory ||
        (
          step.fieldId &&
          apiData.some(
            (item: any) =>
              Number(item.m_rec_score_field_id) ===
              Number(step.fieldId)
          )
        )

      );


      // =====================================================
      // SORT ONLY DYNAMIC STEPS USING display_order
      //
      // Mandatory steps:
      // Personal Info -> always first
      // Preview & Submit -> always last
      // =====================================================

      const firstMandatoryStep = dynamicSteps.find(
        step =>
          step.compId === 1 &&
          step.isMandatory
      );

      const lastMandatoryStep = dynamicSteps.find(
        step =>
          step.compId === 9 &&
          step.isMandatory
      );


      // Remove mandatory steps before sorting

      let mappedSteps = dynamicSteps.filter(
        step => !step.isMandatory
      );


      // =====================================================
      // SORT
      // =====================================================

      mappedSteps.sort((a, b) => {

        const orderA =
          a.fieldId !== undefined
            ? displayOrderMap.get(a.fieldId) || 0
            : 0;

        const orderB =
          b.fieldId !== undefined
            ? displayOrderMap.get(b.fieldId) || 0
            : 0;


        // Both have display_order
        if (orderA > 0 && orderB > 0) {
          return orderA - orderB;
        }


        // A has display_order, B doesn't
        if (orderA > 0 && orderB <= 0) {
          return -1;
        }


        // B has display_order, A doesn't
        if (orderA <= 0 && orderB > 0) {
          return 1;
        }


        // Neither has display_order
        // Keep original masterSteps order
        return (
          this.masterSteps.indexOf(a) -
          this.masterSteps.indexOf(b)
        );

      });


      // =====================================================
      // BUILD FINAL STEPS
      // =====================================================

      this.activeSteps = [

        // Personal Info
        ...(firstMandatoryStep
          ? [firstMandatoryStep]
          : []),

        // Dynamic steps
        ...mappedSteps,

        // Preview & Submit
        ...(lastMandatoryStep
          ? [lastMandatoryStep]
          : [])

      ];


      console.log(
        'Final Active Steps:',
        this.activeSteps
      );


      console.log(
        'Final Step Order:',
        this.activeSteps.map(step => ({
          compId: step.compId,
          name: step.name,
          fieldId: step.fieldId,
          displayOrder:
            step.fieldId
              ? displayOrderMap.get(step.fieldId)
              : null
        }))
      );


      this.isLoadingSteps = false;
      this.areDynamicStepsLoaded = true;


      // =====================================================
      // FINAL DECLARATION
      // =====================================================

      if (this.isFinalDeclared) {

        this.currentStepIndex =
          this.activeSteps.length - 1;

        // Eagerly mark ALL steps as visited
        this.activeSteps.forEach(
          (_, index) =>
            this.markStepAsVisited(index)
        );

      } else {

        // Normal flow
        this.markStepAsVisited(
          this.currentStepIndex
        );

      }

    },

    error: (err) => {

      console.error(
        'Failed to load calculation steps',
        err
      );

      this.isLoadingSteps = false;
      this.areDynamicStepsLoaded = true;

    }

  });
}
  // ✅ Helper method to mark steps as visited
  markStepAsVisited(index: number) {
    if (this.activeSteps[index]) {
      const compId = this.activeSteps[index].compId;
      if (!this.visitedSteps.includes(compId)) {
        this.visitedSteps.push(compId);
      }
    }
  }

  // ✅ Helper method for HTML to check if a step has been visited
  hasVisited(compId: number): boolean {
    return this.visitedSteps.includes(compId);
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
    if (this.pdfDownloadSub) this.pdfDownloadSub.unsubscribe();
  }

  ngAfterViewChecked(): void {
    // PDF download is now handled by prepareAndDownloadPdf()
  }

  updateFormData(compId: number, data: { [key: string]: any }) {
    this.formData[compId] = { ...data };
    this.sharedDataService.setFormData(this.formData);
    this.updateLatestPdfAvailability();
  }
  async nextStep() {
    if (this.isFinalDeclared) return;

    const currentCompId = this.activeSteps[this.currentStepIndex].compId;

    try {
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
      this.auditLogger.flushPendingChangesForSave();
      this.sharedDataService.setFormData(this.formData);
      this.updateLatestPdfAvailability();

      if (this.currentStepIndex < this.activeSteps.length - 1) {
        const nextCompId = this.activeSteps[this.currentStepIndex + 1].compId;
        if (nextCompId === 9) {
          this.sharedDataService.setFormData(this.formData);
        }
        this.currentStepIndex++;

        // ✅ Mark the newly reached step as visited to lazy-load it
        this.markStepAsVisited(this.currentStepIndex);
        this.sharedDataService.notifyStepChanged();
      }
    } catch (error) {
      console.error(`Validation failed for component ${currentCompId}:`, error);
      this.auditLogger.logError(
        'VALIDATION_ERROR',
        `${this.getStepAuditHeading(currentCompId)}: ${this.getFirstMissedMandatory(currentCompId) || 'Required fields are missing'}`,
      );
    }
  }

  private getStepAuditHeading(compId: number): string {
    const apiHeading = compId === 3 ? this.step3Component?.score_field_title_name
      : compId === 4 ? this.step4Component?.score_field_title_name
        : compId === 6 ? this.step6Component?.score_field_title_name
          : undefined;

    return apiHeading || this.activeSteps[this.currentStepIndex]?.name || 'Application form';
  }

  private getFirstMissedMandatory(compId: number): string | null {
    if (compId === 1) {
      return this.step1Component?.getFirstInvalidFieldLabel() || null;
    }

    const form = compId === 1 ? this.step1Component?.form
      : compId === 2 ? this.step2Component?.form
        : compId === 3 ? this.step3Component?.form
          : compId === 4 ? this.step4Component?.form
            : compId === 5 ? this.step5Component?.form
              : compId === 6 ? this.step6Component?.form
                : undefined;
    return form?.get('firstMissedMandatory')?.value || null;
  }

  prevStep() {
    if (this.isFinalDeclared) return;
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;

      // ✅ Mark as visited (just in case)
      this.markStepAsVisited(this.currentStepIndex);
    }
  }

  goToStep(index: number) {
    if (this.isFinalDeclared) return;

    if (this.isStepCompleted(index - 1) || index < this.currentStepIndex) {
      this.currentStepIndex = index;

      // ✅ Mark the jumped-to step as visited to lazy-load it
      this.markStepAsVisited(this.currentStepIndex);
    }
  }

  isStepCompleted(index: number): boolean {
    if (this.isFinalDeclared) return true;
    if (index < 0) return true;

    const compId = this.activeSteps[index].compId;
    const stepData = this.formData[compId];
    return !!(stepData && stepData['_isValid']);
  }

  private updateLatestPdfAvailability(): void {
    const requiredSteps = this.activeSteps.filter((step) => step.compId !== 9);
    const isApplicationComplete =
      requiredSteps.length > 0 &&
      requiredSteps.every((step) => this.formData[step.compId]?.['_isValid']);

    if (isApplicationComplete) {
      this.sharedDataService.markLatestPdfAvailable();
    }
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
