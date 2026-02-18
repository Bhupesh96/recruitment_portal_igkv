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
import { Step9Component } from './step-9/step-9.component';

import { PdfDownloadComponent } from '../pdf-download/pdf-download.component';
import { AlertService } from 'shared';

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
  @ViewChild(Step9Component, { static: false }) step9Component?: Step9Component;
  @ViewChild('pdfDownloadComponent')
  pdfDownloadComponent!: PdfDownloadComponent;
  steps = [
    'Personal Info',
    'Education',
    'Academics',
    'Publications',
    'Experience',
    'Performance',
    'Preview & Submit', // The final step
  ];
  currentStep = 1;
  formData: { [key: number]: { [key: string]: any } } = {};
  private printTriggered = false;
  constructor(
    private sharedDataService: SharedDataService,
    private alertService: AlertService
  ) {}
  ngAfterViewChecked(): void {
    // Check if the print action was requested and the component is ready
    if (this.printTriggered && this.pdfDownloadComponent) {
      // Call the print function
      this.pdfDownloadComponent.downloadAsPdf();

      // Reset the flag to prevent it from running again
      this.printTriggered = false;
    }
  }

  async nextStep() {
    try {
      // The button on the final step triggers the submit inside Step9Component.
      // This function only handles advancing through steps 1-6.
      if (this.currentStep === this.steps.length) {
        if (this.step9Component) {
          await this.step9Component.submit();
        }
        return;
      }

      // Await the validation/save method of the current step component.
      // It will throw an error if invalid, which is caught below.
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
      }

      // If the promise resolved without error, we can advance.
      if (this.currentStep < this.steps.length) {
        // Just before moving to the final "Preview & Submit" step, set the data.
        if (this.steps[this.currentStep] === 'Preview & Submit') {
          console.log('--- FINAL DATA SENT TO PREVIEW SERVICE ---');
          this.sharedDataService.setFormData(this.formData);
        }
        this.currentStep++;
      }
    } catch (error) {
      console.error(
        `Validation or submission failed for step ${this.currentStep}:`,
        error
      );
      // Alerts are handled within each child component's submit method.
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number) {
    // Allow navigation to any previously completed step or the current step.
    if (this.isStepCompleted(step - 1) || step < this.currentStep) {
      this.currentStep = step;
    }
  }

  updateFormData(step: number, data: { [key: string]: any }) {
    this.formData[step] = { ...data };
  }

  isStepCompleted(stepIndex: number): boolean {
    const stepData = this.formData[stepIndex + 1];
    return !!(stepData && stepData['_isValid']);
  }

  onFinalSubmitSuccess() {
    console.log('Final submit success. Preparing to print...');

    if (this.pdfDownloadComponent) {
      // 1. Pass the complete formData directly to the PDF component.
      // This will trigger Angular's change detection.
      this.pdfDownloadComponent.formData = this.formData;

      // 2. Set the flag. ngAfterViewChecked will now take care of printing
      //    as soon as the view is updated with the new formData.
      this.printTriggered = true;
    } else {
      console.error('PDF component not found!');
    }
  }
}
