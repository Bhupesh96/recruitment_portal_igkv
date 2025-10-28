import { Component, ViewChild, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { HttpClientModule } from '@angular/common/http';
import { of, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';


import { StepFinalDecisionComponent } from '../step-final-decision/step-final-decision.component';
import { AlertService, HttpService } from 'shared';
import {
  RecruitmentStateService,
  UserRecruitmentData,
} from '../../recruitment-state.service';
import { Step1Component } from './step-1/step-1.component';
import { Step2Component } from '../../stepper/step-2/step-2.component';
import { Step3Component } from '../../stepper/step-3/step-3.component';
import { Step4Component } from '../../stepper/step-4/step-4.component';
import { Step5Component } from '../../stepper/step-5/step-5.component';
import { Step6Component } from '../../stepper/step-6/step-6.component';

// Define an interface for the API step data
interface ApiStep {
  m_rec_app_es_score_field_id: number;
  score_field_name_e: string;
  m_rec_score_field_id: number; // Use the score field ID for mapping
}

// Define an interface for the API response
interface ApiResponse {
  body?: {
    error?: any;
    data: ApiStep[];
  };
}

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    Step1Component,
    Step2Component,
    Step3Component,
    Step4Component,
    Step5Component,
    Step6Component,
    StepFinalDecisionComponent,
  ],
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.scss'],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate(
          '300ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        ),
      ]),
      // Add a leave animation for the modal
      transition(':leave', [
        animate(
          '200ms ease-in',
          style({ opacity: 0, transform: 'translateY(10px)' })
        ),
      ]),
    ]),
  ],
})
export class StepperComponent implements OnInit, AfterViewInit {
  @ViewChild(Step1Component) step1Component?: Step1Component;
  @ViewChild(Step2Component) step2Component?: Step2Component;
  @ViewChild(Step3Component) step3Component?: Step3Component;
  @ViewChild(Step4Component) step4Component?: Step4Component;
  @ViewChild(Step5Component) step5Component?: Step5Component;
  @ViewChild(Step6Component) step6Component?: Step6Component;
  // This component is now only used for the modal
  @ViewChild(StepFinalDecisionComponent)
  stepFinalComponent?: StepFinalDecisionComponent;

  currentStep = 1;
  steps: ApiStep[] = [];
  isLoading = true;

  formData: { [key: number]: { [key: string]: any } } = {};
  completedSteps: boolean[] = []; // ✅ NEW: State for controlling the modal

  isFinalModalOpen = false;

  private userData: UserRecruitmentData | null = null;

  constructor(
    private http: HttpService,
    private alertService: AlertService,
    private recruitmentState: RecruitmentStateService
  ) {
    this.userData = this.recruitmentState.getScreeningCandidateData();
  }

  ngOnInit() {
    this.fetchSteps();
  }

  ngAfterViewInit() {
    // ViewChild components are now accessed directly in nextStep()
  }

  fetchSteps() {
    if (!this.userData) {
      this.isLoading = false;
      console.warn('⚠️ User data not found. Cannot fetch steps.');
      this.alertService.alert(true, 'User data missing. Unable to load steps.');
      return;
    }

    this.isLoading = true;

    const params = {
      a_rec_adv_main_id: this.userData.a_rec_adv_main_id,
      post_code: this.userData.post_code,
      subject_id: this.userData.subject_id || 0,
      m_rec_es_master_id: 1,
    };

    const personalInfoStep: ApiStep = {
      m_rec_app_es_score_field_id: -1,
      score_field_name_e: 'Personal Info',
      m_rec_score_field_id: 0,
    };

    this.http
      .getParam('/master/get/getESCalculationSteps', params, 'recruitement')
      .pipe(
        catchError((error) => {
          console.error('❌ API Error fetching steps:', error);
          this.alertService.alert(true, 'Failed to load application steps.');
          return of({ body: { data: [] } });
        })
      )
      .subscribe((response: ApiResponse) => {
        const apiSteps = response?.body?.data || [];
        // ✅ MODIFIED: Removed the finalDecisionStep from the steps array
        this.steps = [personalInfoStep, ...apiSteps];
        this.completedSteps = Array(this.steps.length).fill(false);
        this.isLoading = false;
      });
  }

  updateFormData(step: number, data: { [key: string]: any }) {
    // FIX: Run the update in a timeout to prevent ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.formData[step] = { ...data };
      this.completedSteps[step - 1] = true;
    }, 0);
  }

  async nextStep() {
    if (this.isLoading || !this.steps.length) return;

    try {
      const currentStepData = this.steps[this.currentStep - 1];
      if (!currentStepData) return;

      const stepId = currentStepData.m_rec_score_field_id; // ✅ FIX: Get the current component instance directly using a switch case
      let componentInstance: any;
      switch (stepId) {
        case 0:
          componentInstance = this.step1Component;
          break;
        case 1:
          componentInstance = this.step2Component;
          break;
        case 8:
          componentInstance = this.step3Component;
          break;
        case 18:
          componentInstance = this.step4Component;
          break;
        case 32:
          componentInstance = this.step5Component;
          break;
        case 34:
          componentInstance = this.step6Component;
          break;
        // ✅ REMOVED: case -2 (final decision)
      } // Check for either 'submit' or 'submitForm' method and execute it

      if (
        componentInstance &&
        typeof componentInstance.submitForm === 'function'
      ) {
        await componentInstance.submitForm();
      } else if (
        componentInstance &&
        typeof componentInstance.submit === 'function'
      ) {
        await componentInstance.submit();
      } else {
        console.warn(
          `⚠️ No submitForm or submit method found for step with ID: ${stepId}`
        );
      } // ✅ MODIFIED: Logic to advance to the next step OR open the modal
      if (this.currentStep < this.steps.length) {
        this.currentStep++;
      } else {
        // This was the last step, so open the modal
        this.isFinalModalOpen = true;
        console.log('✅ Last step validated, opening final decision modal.');
      }
    } catch (error) {
      console.error(
        `❌ Validation failed for step ${this.currentStep}:`,
        error
      );
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number) {
    if (step < this.currentStep || this.completedSteps[step - 1]) {
      this.currentStep = step;
    }
  } // ✅ NEW: Method to close the modal

  closeFinalModal() {
    this.isFinalModalOpen = false;
  } // ✅ NEW: Method to submit the final decision from the modal

  async submitFinalDecision() {
    if (!this.stepFinalComponent) {
      console.error('Final decision component instance not found!');
      this.alertService.alert(true, 'An error occurred. Component not found.');
      return;
    }

    try {
      // Call the final decision component's own submit function
      await this.stepFinalComponent.submitForm(); // If submitForm() succeeds (doesn't throw error), close modal.

      this.closeFinalModal(); // so we just log it.
      // The success alert is already handled inside the component
      console.log('✅ Final decision submitted successfully.');
    } catch (error) {
      // The error alert is already handled inside the component's submitForm,
      // so we just log it here and keep the modal open for the user to fix.
      console.error('Final decision submission failed', error);
    }
  }
}
