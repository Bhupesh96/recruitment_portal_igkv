import { Component, ViewChild, OnInit, OnDestroy, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';

import { SharedDataService } from '../shared-data.service';
import { AlertService } from 'shared';
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

  constructor(
    private sharedDataService: SharedDataService,
    private alertService: AlertService,
    private recruitmentStateService: RecruitmentStateService
  ) {}

  ngOnInit(): void {
    // Listen to user data on initialization
    this.userSub = this.recruitmentStateService.userData$.subscribe((user: UserRecruitmentData | null) => {
      if (user && user['Is_Final_Decl_YN'] === 'Y') {
        this.isFinalDeclared = true;
        this.currentStep = this.steps.length; // Jump directly to the final Preview step
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
    console.log('Final submit success. Preparing to print...');
    if (this.pdfDownloadComponent) {
      this.pdfDownloadComponent.formData = this.formData;
      this.printTriggered = true; // Triggers ngAfterViewChecked
    } else {
      console.error('PDF component not found!');
    }
  }
}
