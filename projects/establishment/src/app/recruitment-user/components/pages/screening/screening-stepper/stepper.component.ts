import { Component, ViewChild, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { HttpClientModule } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Step1Component } from './step-1/step-1.component';
import { Step2Component } from './step-2/step-2.component';
import { Step3Component } from './step-3/step-3.component';
import { Step4Component } from './step-4/step-4.component';
import { Step5Component } from './step-5/step-5.component';
import { Step6Component } from './step-6/step-6.component';
import { AlertService, HttpService } from 'shared';
import {
  RecruitmentStateService,
  UserRecruitmentData,
} from '../../recruitment-state.service';

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

  currentStep = 1;
  steps: ApiStep[] = [];
  isLoading = true;

  formData: { [key: number]: { [key: string]: any } } = {};
  completedSteps: boolean[] = [];

  private componentMap: { [key: number]: any } = {};
  private userData: UserRecruitmentData | null = null;

  constructor(
    private http: HttpService,
    private alertService: AlertService,
    private recruitmentState: RecruitmentStateService
  ) {
    this.userData = this.recruitmentState.getScreeningCandidateData();
  }

  ngOnInit() {
    // Directly fetch steps using userData (no candidateData dependency)
    this.fetchSteps();
  }

  ngAfterViewInit() {
    this.initializeComponentMap();
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

    // Always include Personal Info as the first step
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
        console.log('✅ Raw API Response:', response);

        const apiSteps = response?.body?.data || [];
        console.table(apiSteps);

        this.steps = [personalInfoStep, ...apiSteps];
        this.completedSteps = Array(this.steps.length).fill(false);

        this.isLoading = false;
        this.initializeComponentMap();
      });
  }

  initializeComponentMap() {
    this.componentMap = {
      0: this.step1Component, // Personal Info
      1: this.step2Component, // Education
      8: this.step3Component, // Academic
      18: this.step4Component, // Publication
      32: this.step5Component, // Experience
      34: this.step6Component, // Performance
    };

    console.log('🔗 Component Map Initialized:', this.componentMap);
  }

  updateFormData(step: number, data: { [key: string]: any }) {
    this.formData[step] = { ...data };
    this.completedSteps[step - 1] = true;
  }

  async nextStep() {
    if (this.isLoading || !this.steps.length) return;

    try {
      const currentStepData = this.steps[this.currentStep - 1];
      if (!currentStepData) return;

      const stepId = currentStepData.m_rec_score_field_id;
      const componentInstance = this.componentMap[stepId];

      if (componentInstance && typeof componentInstance.submit === 'function') {
        await componentInstance.submit();
      } else if (
        componentInstance &&
        typeof componentInstance.submitForm === 'function'
      ) {
        await componentInstance.submitForm();
      } else {
        console.warn(
          `⚠️ No submit or submitForm method found for step with ID: ${stepId}`
        );
      }

      if (this.currentStep === this.steps.length) {
        console.log('✅ Final submission data:', this.formData);
        this.alertService.alert(false, 'Application Saved Successfully!');
        return;
      }

      if (this.currentStep < this.steps.length) {
        this.currentStep++;
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
  }
}
