import { Component, ViewChild, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { SharedDataService } from '../../shared-data.service';
import { Step1Component } from './step-1/step-1.component';
import { Step2Component } from './step-2/step-2.component';
import { Step3Component } from './step-3/step-3.component';
import { Step4Component } from './step-4/step-4.component';
import { Step5Component } from './step-5/step-5.component';
import { Step6Component } from './step-6/step-6.component';
import { AlertService } from 'shared';
import { Candidate } from '../screening/screening.component';

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
  ],
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.scss'],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class StepperComponent {
  @Input() candidateData?: Candidate;

  @ViewChild(Step1Component) step1Component?: Step1Component;
  @ViewChild(Step2Component) step2Component?: Step2Component;
  @ViewChild(Step3Component) step3Component?: Step3Component;
  @ViewChild(Step4Component) step4Component?: Step4Component;
  @ViewChild(Step5Component) step5Component?: Step5Component;
  @ViewChild(Step6Component) step6Component?: Step6Component;

  currentStep = 1;
  steps = [
    'Personal Info',
    'Education',
    'Academics',
    'Publications',
    'Experience',
    'Performance',
  ];

  formData: { [key: number]: { [key: string]: any } } = {};
  
  // FIX: Added the missing 'completedSteps' property declaration
  completedSteps: boolean[] = Array(this.steps.length).fill(false);

  constructor(
    private sharedDataService: SharedDataService,
    private alertService: AlertService
  ) {}

  updateFormData(step: number, data: { [key: string]: any }) {
    this.formData[step] = { ...data };
    this.completedSteps[step - 1] = true; // Mark step as touched/completed
  }
  
  async nextStep() {
    try {
      // Validate the current step
      switch (this.currentStep) {
        case 1: if (this.step1Component) await this.step1Component.submitForm(); break;
        case 2: if (this.step2Component) await this.step2Component.submitForm(); break;
        case 3: if (this.step3Component) await this.step3Component.submit(); break;
        case 4: if (this.step4Component) await this.step4Component.submit(); break;
        case 5: if (this.step5Component) await this.step5Component.submitForm(); break;
        case 6: if (this.step6Component) await this.step6Component.submit(); break;
      }

      // If on the last step, handle final submission
      if (this.currentStep === this.steps.length) {
        console.log('Final submission logic for all 6 steps:', this.formData);
        this.alertService.alert(false, 'Application Saved Successfully!');
        return;
      }

      // If validation passed, advance to the next step
      if (this.currentStep < this.steps.length) {
        this.currentStep++;
      }
    } catch (error) {
      console.error(`Validation failed for step ${this.currentStep}:`, error);
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number) {
    // Allow navigation only to previously completed steps or the current one
    if (step < this.currentStep || this.completedSteps[step - 1]) {
      this.currentStep = step;
    }
  }
}