import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { SharedDataService } from '../shared-data.service';
import { Step1Component } from './step-1/step-1.component';
import { Step2Component } from './step-2/step-2.component';
import { Step3Component } from './step-3/step-3.component';
import { Step4Component } from './step-4/step-4.component';
import { Step5Component } from './step-5/step-5.component';
import { Step6Component } from './step-6/step-6.component';
import { Step8Component } from './step-8/step-8.component';
import { Step9Component } from './step-9/step-9.component';
import { HeaderComponent } from '../../header/header.component';
import { FooterComponent } from '../../footer/footer.component';
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
    Step8Component,
    Step9Component,
  ],
  // This line is removed to ensure the root service instance is used.
  // providers: [SharedDataService],
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
  @ViewChild(Step8Component, { static: false }) step8Component?: Step8Component;
  @ViewChild(Step9Component, { static: false }) step9Component?: Step9Component;

  steps = [
    'Personal Info', // Step 1
    'Education', // Step 2
    'Academics', // Step 3
    'Publications', // Step 4
    'Experience', // Step 5
    'Performance', // Step 6
    'Preview', // Step 7
    'Submission', // Step 8
  ];
  currentStep = 1;
  formData: { [key: number]: { [key: string]: any } } = {};

  constructor(
    private sharedDataService: SharedDataService,
    private alertService: AlertService
  ) {}

  async nextStep() {
    try {
      // Use a switch statement and 'await' to handle the async submit calls
      // This ensures the stepper waits for the API call to finish
      switch (this.currentStep) {
        case 1:
          if (this.step1Component) await this.step1Component.submitForm();
          break;
        case 2:
          if (this.step2Component) await this.step2Component.submitForm();
          break;
        case 3:
          if (this.step3Component) await this.step3Component.submit();
          break;
        case 4:
          if (this.step4Component) await this.step4Component.submit();
          break;
        case 5:
          if (this.step5Component) await this.step5Component.submitForm();
          break;
        case 6:
          if (this.step6Component) await this.step6Component.submit();
          break;
        // Step 7 is 'Preview', which has no submit action.
        case 8:
          if (this.step8Component) await this.step8Component.submit();
          break;
      }

      // Allow advancing from the preview step without checking form validity
      const canAdvance =
        this.isFormValid() || this.steps[this.currentStep - 1] === 'Preview';

      if (canAdvance) {
        if (this.currentStep < this.steps.length) {
          // If we are about to move TO the "Preview" step, save all data to the service.
          if (this.steps[this.currentStep] === 'Preview') {
            console.log('--- FINAL DATA SENT TO PREVIEW SERVICE ---');
            console.log(JSON.stringify(this.formData, null, 2));
            this.sharedDataService.setFormData(this.formData);
          }
          this.currentStep++;
        } else {
          await this.finish();
        }
      } else {
        console.warn(
          `Step ${this.currentStep} form is invalid or data was not emitted.`
        );
      }
    } catch (error) {
      console.error(`Submission failed for step ${this.currentStep}:`, error);
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number) {
    // Allow navigation to any previously completed step
    if (this.isStepCompleted(step - 1) || step < this.currentStep) {
      this.currentStep = step;
    }
  }

  updateFormData(step: number, data: { [key: string]: any }) {
    this.formData[step] = { ...data };
    console.log(
      `Data received for Step ${step}:`,
      JSON.stringify(this.formData[step],null,2)
    );
  }

  isFormValid(): boolean {
    const currentData = this.formData[this.currentStep];
    return !!(currentData && currentData['_isValid']);
  }

  isStepCompleted(stepIndex: number): boolean {
    const stepData = this.formData[stepIndex + 1];
    return !!(stepData && stepData['_isValid']);
  }

  async finish() {
    const confirmationResult = await this.alertService.confirmAlert(
      'Confirm Submission',
      'Are you sure you want to submit the form?',
      'question'
    );
    if (confirmationResult.isConfirmed) {
      this.alertService.alert(
        true,
        'Your application has been submitted successfully!'
      );
    } else {
      this.alertService.alert(false, 'Submission cancelled.');
    }
  }
}
