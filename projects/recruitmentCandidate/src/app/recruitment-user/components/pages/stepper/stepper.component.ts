import { Component, ViewChild, OnInit, OnDestroy, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';

import { SharedDataService } from '../shared-data.service';
import {AlertService, HttpService} from 'shared';
import {RecruitmentStateService, UserRecruitmentData} from '../recruitment-state.service';

import { Step1Component } from './step-1/step-1.component';
import { Step2Component } from './step-2/step-2.component';
import { Step3Component } from './step-3/step-3.component';
import { Step4Component } from './step-4/step-4.component';
import { Step5Component } from './step-5/step-5.component';
import { Step6Component } from './step-6/step-6.component';
import { Step9Component } from './step-9/step-9.component';
import { PdfDownloadComponent } from '../pdf-download/pdf-download.component';

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    Step1Component,
    Step2Component,
    Step3Component,
    Step4Component,
    Step5Component,
    Step6Component,
    Step9Component,
    PdfDownloadComponent,
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

  steps = [
    'Personal Info',
    'Education',
    'Academics',
    'Publications',
    'Experience',
    'Performance',
    'Preview & Submit',
  ];

  currentStep = 1;
  formData: { [key: number]: { [key: string]: any } } = {};

  private printTriggered = false;

  // State management flags
  isFinalDeclared = false;
  private userSub!: Subscription;
  private dbCheckDone = false;
  constructor(
    private sharedDataService: SharedDataService,
    private alertService: AlertService,
    private recruitmentStateService: RecruitmentStateService,
    private http: HttpService
  ) {}

  ngOnInit(): void {

    this.userSub = this.recruitmentStateService.userData$.subscribe((user: any) => {
      if (user) {
        // If local state ALREADY says declared, just lock it.
        if (user['Is_Final_Decl_YN'] === 'Y' || user['is_final_decl_yn'] === 'Y') {
          this.isFinalDeclared = true;
          this.currentStep = this.steps.length; // Jump directly to the final Preview step
        }
        // If local state says 'N' (like after a refresh), but we haven't checked the DB yet:
        else if (user.registration_no && !this.dbCheckDone) {
          this.dbCheckDone = true; // Mark as done so we don't spam the API
          this.verifyLockStatusFromDB(user.registration_no); // Ask the DB!
        }
      }
    });
  }

  // 3. Update this method to accept the registrationNo as an argument
  verifyLockStatusFromDB(registrationNo: string | number) {
    this.http.getParam('/master/get/getApplicant', {
      registration_no: registrationNo,
      Application_Step_Flag_CES: 'C'
    }, 'recruitement').subscribe({
      next: (res: any) => {
        const freshUser = res?.body?.data?.[0];

        // If the DB says it's declared, force the global state to update!
        if (freshUser && (freshUser.Is_Final_Decl_YN === 'Y' || freshUser.is_final_decl_yn === 'Y')) {

          // Updating the state will automatically trigger the subscription in ngOnInit,
          // which will lock the stepper and hide the navigation.
          this.recruitmentStateService.updateUserData({ Is_Final_Decl_YN: 'Y' });
        }
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up memory to prevent leaks
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }

  ngAfterViewChecked(): void {
    // If the print action was triggered and component is ready, print the PDF
    if (this.printTriggered && this.pdfDownloadComponent) {
      this.pdfDownloadComponent.downloadAsPdf();
      this.printTriggered = false;
    }
  }

  /**
   * Catches data emitted by child components.
   * If in Preview Mode, immediately forwards the background-loaded data to the preview component.
   */
  updateFormData(step: number, data: { [key: string]: any }) {
    this.formData[step] = { ...data };

    if (this.isFinalDeclared) {
      this.sharedDataService.setFormData(this.formData);
    }
  }

  async nextStep() {
    if (this.isFinalDeclared) return; // Form is locked

    try {
      if (this.currentStep === this.steps.length) {
        if (this.step9Component) {
          await this.step9Component.submit();
        }
        return;
      }

      // Trigger child component validation/submit logic
      switch (this.currentStep) {
        case 1: if (this.step1Component) await this.step1Component.submitForm(); break;
        case 2: if (this.step2Component) await this.step2Component.submitForm(); break;
        case 3: if (this.step3Component) await this.step3Component.submit(); break;
        case 4: if (this.step4Component) await this.step4Component.submit(); break;
        case 5: if (this.step5Component) await this.step5Component.submitForm(); break;
        case 6: if (this.step6Component) await this.step6Component.submit(); break;
      }

      if (this.currentStep < this.steps.length) {
        if (this.steps[this.currentStep] === 'Preview & Submit') {
          // Push accumulated data to shared service for Step 9 to render
          this.sharedDataService.setFormData(this.formData);
        }
        this.currentStep++;
      }
    } catch (error) {
      console.error(`Validation or submission failed for step ${this.currentStep}:`, error);
    }
  }

  prevStep() {
    if (this.isFinalDeclared) return; // Form is locked

    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number) {
    if (this.isFinalDeclared) return; // Form is locked

    if (this.isStepCompleted(step - 1) || step < this.currentStep) {
      this.currentStep = step;
    }
  }

  isStepCompleted(stepIndex: number): boolean {
    if (this.isFinalDeclared) return true; // Show all completed visually if locked
    const stepData = this.formData[stepIndex + 1];
    return !!(stepData && stepData['_isValid']);
  }

  onFinalSubmitSuccess() {
    console.log('Final submit success.');
    this.isFinalDeclared = true;
  }
  triggerManualDownload() {
    console.log('Manual download triggered.');
    if (this.pdfDownloadComponent) {
      this.pdfDownloadComponent.formData = this.formData;

      // Use setTimeout to give Angular's change detection a split second
      // to pass the formData into the PDF component before triggering the print
      setTimeout(() => {
        this.pdfDownloadComponent.downloadAsPdf();
      }, 100);
    } else {
      console.error('PDF component not found!');
    }
  }
}
