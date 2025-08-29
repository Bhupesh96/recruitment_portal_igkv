import { Component, ViewChild, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { Router } from '@angular/router';
import { SharedDataService } from '../shared-data.service'; // Import the service
import { Step1Component } from './step-1/step-1.component';
import { Step2Component } from './step-2/step-2.component';
import { Step3Component } from './step-3/step-3.component';
import { Step4Component } from './step-4/step-4.component';
import { Step5Component } from './step-5/step-5.component';
import { Step6Component } from './step-6/step-6.component';
import { Step7Component } from './step-7/step-7.component';
import { Step8Component } from './step-8/step-8.component';
import { Step9Component } from './step-9/step-9.component';
import { HeaderComponent } from '../../header/header.component';
import { FooterComponent } from '../../footer/footer.component';
import html2pdf from 'html2pdf.js';
import { AlertService } from 'shared';

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HeaderComponent,
    FooterComponent,
    Step1Component,
    Step2Component,
    Step3Component,
    Step4Component,
    Step5Component,
    Step6Component,
    Step7Component,
    Step8Component,
    Step9Component,
  ],
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.scss'],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate(
          '400ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        ),
      ]),
      transition(':leave', [
        animate(
          '400ms ease-in',
          style({ opacity: 0, transform: 'translateY(-10px)' })
        ),
      ]),
    ]),
  ],
})
export class StepperComponent {
  @ViewChild(Step1Component, { static: false }) step1Component?: Step1Component;
  @ViewChild(Step2Component, { static: false }) step2Component?: Step2Component;
  @ViewChild(Step3Component, { static: false }) step3Component?: Step3Component;
  @ViewChild(Step4Component, { static: false }) step4Component?: Step4Component;
  @ViewChild(Step5Component, { static: false }) step5Component?: Step5Component;
  @ViewChild(Step6Component, { static: false }) step6Component?: Step6Component;
  @ViewChild(Step7Component, { static: false }) step7Component?: Step7Component;
  @ViewChild(Step9Component, { static: false }) step9Component?: Step9Component;
  steps = [
    'Personal Info',
    'Education',
    'Academics',
    'Publications',
    'Experience',
    'Performance',
    'Documents',
    'Submission',
    'Preview',
  ];
  showPdfPreview: boolean = false;
  currentStep = 1;
  formData: { [key: number]: { [key: string]: any } } = {};

  constructor(
    private router: Router,
    private sharedDataService: SharedDataService,
    private alertService: AlertService
  ) {}

  async nextStep() {
    if (this.currentStep === 1) {
      if (this.step1Component) {
        this.step1Component.submitForm();
      } else {
      }
    } else if (this.currentStep === 2) {
      if (this.step2Component) {
         this.step2Component.submitForm();
      } else {
      }
    } else if (this.currentStep === 3) {
      if (this.step3Component) {
        this.step3Component.submit();
      } else {
      }
    } else if (this.currentStep === 5) {
      if (this.step5Component) {
        this.step5Component.submitForm();
      } else {
      }
    } else if (this.currentStep === 4) {
      if (this.step4Component) {
        this.step4Component.submit();
      } else {
      }
    } else if (this.currentStep === 6) {
      if (this.step6Component) {
        this.step6Component.submit();
      } else {
      }
    } else if (this.currentStep === 7) {
      if (this.step7Component) {
        this.step7Component.submit();
      } else {
      }
    } else if (this.currentStep === 9) {
      if (this.step9Component) {
        this.step9Component.submit();
      } else {
        // Handle case where component is not available
      }
    }
    // Log current formData state for debugging
    // console.log(
    //   `Step ${this.currentStep} formData:`,
    //   JSON.stringify(this.formData[this.currentStep], null, 2)
    // );
    if (this.isFormValid()) {
      if (this.currentStep < this.steps.length) {
        this.currentStep++;
      } else {
        this.finish();
      }
    } else {
      const existing = this.formData[this.currentStep] || {};
      this.formData[this.currentStep] = { ...existing, _isValid: false };
      console.warn(
        `Step ${this.currentStep} is invalid. Please fill all required fields.`
      );
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number) {
    if (step <= this.currentStep) {
      this.currentStep = step;
    }
  }

  isStepCompleted(stepIndex: number): boolean {
    const stepData = this.formData[stepIndex + 1];
    return stepData && Object.keys(stepData).length > 0;
  }

  // First, modify the finish method to be an async function.
  async finish() {
    // Use a confirmation dialog before proceeding.
    const confirmationResult = await this.alertService.confirmAlert(
      'Confirm Submission',
      'Are you sure you want to submit the form?',
      'question'
    );

    // Check if the user confirmed (clicked "Yes").
    if (confirmationResult.isConfirmed) {
      // If confirmed, show success message and stay on the preview step
      this.alertService.alert(
        true,
        'Your application has been submitted successfully!'
      );

      // You could also reset the form here if needed
      // this.resetForm();
    } else {
      // If not confirmed (clicked "No" or closed the dialog), show a message.
      this.alertService.alert(false, 'Submission cancelled.');
    }
  }

  updateFormData(step: number, data: { [key: string]: any }) {
    this.formData[step] = { ...data };

    if (step === this.currentStep && !data['_isValid']) {
    }
  }

  getFormDataKeys(step: number): string[] {
    return this.formData[step] ? Object.keys(this.formData[step]) : [];
  }

  hasFormData(): boolean {
    return Object.keys(this.formData).length > 0;
  }

  formatValue(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2).replace(/["{}]/g, '').trim();
    }
    return String(value);
  }

  formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  isFormValid(): boolean {
    const currentData = this.formData[this.currentStep];
    return !!(currentData && currentData['_isValid']);
  }
}
