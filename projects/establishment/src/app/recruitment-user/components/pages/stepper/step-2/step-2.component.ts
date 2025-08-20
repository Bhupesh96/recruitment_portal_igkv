import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ValidatorFn,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { HttpService, SharedModule } from 'shared';
import { Output, EventEmitter } from '@angular/core';
import { UtilsService } from '../../utils.service';

interface Heading {
  a_rec_adv_main_id: number;
  a_rec_adv_post_detail_id: number;
  m_rec_score_field_id: number;
  score_field_parent_id: number;
  score_field_parent_code: number | null;
  m_rec_score_field_method_id: number;
  score_field_display_no: number;
  score_field_title_name: string;
  score_field_name_e: string;
  score_field_flag: string | null;
  message: string;
  score_field_field_marks: number;
  score_field_field_weightage: number;
}

interface Subheading {
  m_rec_score_field_id: number;
  score_field_parent_code: number | null;
  score_field_name_e: string;
  score_field_title_name: string;
  score_field_flag: string | null;
  message: string | null;
  a_rec_adv_main_id: number;
  a_rec_adv_post_detail_id: number;
  score_field_parent_id: number;
  m_rec_score_field_method_id: number;
  score_field_display_no: number;
  score_field_field_marks: number;
  score_field_field_weightage: number;
}

interface Parameter {
  m_rec_score_field_id: number;
  m_rec_score_field_parameter_id: number;
  a_rec_adv_post_detail_id: number;
  score_field_parameter_name: string;
  score_field_control_type:
    | 'T'
    | 'D'
    | 'DY'
    | 'A'
    | 'DV'
    | 'TV'
    | 'TM'
    | 'TO'
    | 'DP';
  parameter_display_order: number;
  isRequired?: boolean;
}

interface Note {
  message: string;
}

interface ApiResponse<T> {
  error: null | string;
  data: T[];
}

@Component({
  selector: 'app-step-2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './step-2.component.html',
  styleUrls: ['./step-2.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step2Component implements OnInit {
  @Output() formData = new EventEmitter<{ [key: string]: any }>();
  form: FormGroup;
  heading: Heading | null = null;
  subheadings: Subheading[] = [];
  parameters: Parameter[] = [];
  notes: Note[] = [];
  loading = true;
  errorMessage: string | null = null;
  years: number[] = Array.from({ length: 2025 - 1900 + 1 }, (_, i) => 2025 - i);
  filePaths: Map<string, string> = new Map();

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private HTTP: HttpService,
    private sanitizer: DomSanitizer,
    private utils: UtilsService
  ) {
    this.form = this.fb.group({});
  }

  ngOnInit(): void {
    this.loadFormData().subscribe({
      next: () => {
        // Now, getParameterValuesAndPatch() is called after loadFormData() successfully completes.
        this.getParameterValuesAndPatch();
      },
      error: (err) => {
        console.error('Initial data loading failed', err);
        this.errorMessage = 'Failed to load form data: ' + err.message;
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }
  // Helper methods
  getUniqueKey(sub: Subheading, index: number): string {
    return `${sub.m_rec_score_field_id}_${sub.a_rec_adv_post_detail_id}_${index}`;
  }

  getParameters(score_field_id: number, post_detail_id: number): Parameter[] {
    return this.parameters
      .filter(
        (p) =>
          p.m_rec_score_field_id === score_field_id &&
          p.a_rec_adv_post_detail_id === post_detail_id
      )
      .sort((a, b) => a.parameter_display_order - b.parameter_display_order);
  }

  getQualifications(key: string): FormArray {
    return this.form.get(`qualifications${key}`) as FormArray;
  }

  getFilePath(key: string, paramId: number): string | null {
    return this.filePaths.get(`${key}_${paramId}`) || null;
  }

  sanitizeFileUrl(filePath: string): SafeUrl {
    const fileName =
      filePath
        .split('/')
        .pop()
        ?.replace(/(\.pdf)+$/, '.pdf') || '';
    const url = `http://192.168.1.57:3500/recruitment/24000001/${fileName}`;
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }
  // File handling
  onFileChange(
    event: Event,
    index: number,
    arrayName: string,
    fieldName: string
  ) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      const formArray = this.form.get(arrayName) as FormArray;
      const control = formArray.at(index) as FormGroup;
      control.get(fieldName)?.setValue(file);

      const key = arrayName.replace('qualifications', '');
      const param = this.parameters.find(
        (p) => p.score_field_parameter_name === fieldName
      );
      if (param) {
        this.filePaths.delete(`${key}_${param.m_rec_score_field_parameter_id}`);
      }
      this.cdr.markForCheck();
    }
  }

  // Form building and data loading
  private buildFormControls(): void {
    this.form.addControl(
      'heading',
      this.fb.control(this.heading?.score_field_title_name || '')
    );

    this.subheadings.forEach((subheading, index) => {
      const key = this.getUniqueKey(subheading, index);
      const params = this.getParameters(
        subheading.m_rec_score_field_id,
        subheading.a_rec_adv_post_detail_id
      );

      this.form.addControl(`is${key}Selected`, this.fb.control(false));
      this.form.addControl(
        `qualifications${key}`,
        this.fb.array(
          params.length
            ? [this.createQualificationGroup(subheading, false)]
            : []
        )
      );

      this.form
        .get(`is${key}Selected`)
        ?.valueChanges.subscribe((isSelected) => {
          this.toggleValidators(`qualifications${key}`, subheading, isSelected);
          this.cdr.markForCheck();
        });
    });
  }

  private createQualificationGroup(
    sub: Subheading,
    isSelected: boolean
  ): FormGroup {
    const group = this.fb.group({});
    const params = this.getParameters(
      sub.m_rec_score_field_id,
      sub.a_rec_adv_post_detail_id
    );

    params.forEach((param) => {
      const validators: ValidatorFn[] = isSelected ? [Validators.required] : [];

      if (param.score_field_parameter_name === 'Percentage Obtained') {
        validators.push(
          Validators.min(0),
          Validators.max(100),
          Validators.pattern('^[0-9]+\\.?[0-9]{0,2}$')
        );
      }

      group.addControl(
        param.score_field_parameter_name,
        this.fb.control('', validators)
      );
      group.addControl(
        `param_${param.m_rec_score_field_parameter_id}_id`,
        this.fb.control('')
      );
    });

    group.addControl('a_rec_app_score_field_detail_id', this.fb.control(''));
    return group;
  }

  private toggleValidators(
    arrayName: string,
    sub: Subheading,
    isSelected: boolean
  ): void {
    const formArray = this.form.get(arrayName) as FormArray;
    formArray.controls.forEach((control) => {
      const group = control as FormGroup;
      Object.keys(group.controls).forEach((controlName) => {
        const ctrl = group.get(controlName);
        if (ctrl) {
          const validators: ValidatorFn[] = isSelected
            ? [Validators.required]
            : [];
          if (controlName === 'Percentage Obtained') {
            validators.push(
              Validators.min(0),
              Validators.max(100),
              Validators.pattern('^[0-9]+\\.?[0-9]{0,2}$')
            );
          }
          ctrl.setValidators(validators);
          ctrl.updateValueAndValidity({ emitEvent: false });
        }
      });
    });
  }

  private loadFormData(): Observable<void> {
    const a_rec_adv_main_id = 95;
    const m_rec_score_field_id = 1;

    const headingRequest = this.HTTP.getParam(
      '/master/get/getHeadingByScoreField',
      { a_rec_adv_main_id, m_rec_score_field_id },
      'recruitement'
    ) as Observable<HttpResponse<ApiResponse<Heading>>>;

    return headingRequest.pipe(
      switchMap((headingRes: HttpResponse<ApiResponse<Heading>>) => {
        const headingList = headingRes.body?.data || [];
        if (!headingList.length) throw new Error('No heading data found');

        this.heading = headingList[0];
        console.log('🔍 Heading:', this.heading);

        // Only process subheadings for our specific heading
        return this.HTTP.getParam(
          '/master/get/getSubHeadingByParentScoreField',
          {
            a_rec_adv_main_id,
            score_field_parent_id: this.heading.m_rec_score_field_id, // Use the heading's ID
            a_rec_adv_post_detail_id: this.heading.a_rec_adv_post_detail_id,
          },
          'recruitement'
        ).pipe(
          switchMap((subheadingResponse) => {
            this.subheadings = subheadingResponse.body?.data || [];
            console.log('🔍 Filtered Subheadings:', this.subheadings);

            const parameterRequests = this.subheadings.map((sub) =>
              this.HTTP.getParam(
                '/master/get/getSubHeadingParameterByParentScoreField',
                {
                  a_rec_adv_main_id,
                  m_rec_score_field_id: sub.m_rec_score_field_id,
                  a_rec_adv_post_detail_id: sub.a_rec_adv_post_detail_id,
                },
                'recruitement'
              )
            );
            return forkJoin(parameterRequests);
          }),
          tap((parameterResponses) => {
            this.parameters = parameterResponses.flatMap(
              (p) => p.body?.data || []
            );
            console.log('🔍 Parameters:', this.parameters);
            this.buildFormControls();
            this.loading = false;
            this.cdr.markForCheck();
          }),
          switchMap(() => {
            return new Observable<void>((observer) => observer.next());
          })
        );
      }),
      catchError((error) => {
        this.errorMessage = 'Error loading form: ' + error.message;
        this.loading = false;
        this.cdr.markForCheck();
        return [];
      })
    );
  }
  private getParameterValuesAndPatch(): void {
    console.log('🔍 Complete Heading Data:', this.heading);
    this.HTTP.getParam(
      '/candidate/get/getParameterValues',
      {
        registration_no: 24000001,
        a_rec_app_main_id: 95,
        score_field_parent_id: this.heading?.m_rec_score_field_id,
      },
      'recruitement'
    ).subscribe({
      next: (res: HttpResponse<any>) => {
        console.log(
          'Parameter Values for step-2',
          JSON.stringify(res.body?.data)
        );
        const saved = res.body?.data || [];
        saved.forEach((item: any) => {
          const key = `${item.m_rec_score_field_id}_${
            item.a_rec_adv_post_detail_id
          }_${this.subheadings.findIndex(
            (s) =>
              s.m_rec_score_field_id === item.m_rec_score_field_id &&
              s.a_rec_adv_post_detail_id === item.a_rec_adv_post_detail_id
          )}`;

          const formArray = this.form.get(`qualifications${key}`) as FormArray;
          if (formArray?.at(0)) {
            const control = formArray.at(0) as FormGroup;

            if (item.a_rec_app_score_field_detail_id) {
              control
                .get('a_rec_app_score_field_detail_id')
                ?.setValue(item.a_rec_app_score_field_detail_id);
            }

            const paramIdControl = `param_${item.m_rec_score_field_parameter_id}_id`;
            if (
              item.a_rec_app_score_field_parameter_detail_id &&
              control.get(paramIdControl)
            ) {
              control
                .get(paramIdControl)
                ?.setValue(item.a_rec_app_score_field_parameter_detail_id);
            }

            const fieldName = this.parameters.find(
              (p) =>
                p.m_rec_score_field_parameter_id ===
                item.m_rec_score_field_parameter_id
            )?.score_field_parameter_name;

            if (fieldName && control.get(fieldName)) {
              if (item.parameter_value.includes('/')) {
                const controlKey = `${key}_${item.m_rec_score_field_parameter_id}`;
                this.filePaths.set(controlKey, item.parameter_value);
                control.get(fieldName)?.setValue(null);
              } else {
                control.get(fieldName)?.setValue(item.parameter_value);
              }
              this.form
                .get(`is${key}Selected`)
                ?.setValue(true, { emitEvent: false });
            }
          }
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Prefill failed', err);
        this.errorMessage = 'Failed to load saved data: ' + err.message;
        this.cdr.markForCheck();
      },
    });
  }

  submitForm(): void {
    const registrationNo = 24000001;
    const formData = new FormData();
    const newDetails: any[] = [];
    const existingDetails: any[] = [];
    const newParameters: any[] = [];
    const existingParameters: any[] = [];
    let parentCalculatedValue = 0;

    // First pass - calculate total values for parent record
    this.subheadings.forEach((sub, index) => {
      const key = this.getUniqueKey(sub, index);
      if (!this.form.get(`is${key}Selected`)?.value) return;

      const formArray = this.form.get(`qualifications${key}`) as FormArray;
      formArray.controls.forEach((control) => {
        const group = control as FormGroup;
        const percentage = +group.get('Percentage Obtained')?.value || 0;

        const scoreResult = this.utils.calculateScore(
          1, // Method 1 for education
          {
            educations: [
              {
                scoreFieldId: sub.m_rec_score_field_id,
                weight: sub.score_field_field_weightage,
                inputValue: percentage,
                maxValue: sub.score_field_field_marks,
              },
            ],
          },
          this.heading?.score_field_field_marks || 60
        );

        parentCalculatedValue += scoreResult.score_field_calculated_value;
      });
    });

    // Prepare parent record - always update if child records exist
    const parentRecord = {
      registration_no: registrationNo,
      a_rec_app_main_id: 95,
      a_rec_adv_post_detail_id: this.heading?.a_rec_adv_post_detail_id,
      score_field_parent_id: 0,
      m_rec_score_field_id: this.heading?.m_rec_score_field_id,
      m_rec_score_field_method_id: 1, // Must match your database constraints
      score_field_value: this.heading?.score_field_field_marks,
      score_field_actual_value: parentCalculatedValue,
      score_field_calculated_value: Math.min(
        parentCalculatedValue,
        this.heading?.score_field_field_marks || 60
      ),
      verify_remark: 'Not Verified',
      action_type: 'U', // Always update parent when children exist
      action_date: new Date().toISOString(),
      action_ip_address: '127.0.0.1',
      delete_flag: 'N',
    };
    formData.append('parentScore', JSON.stringify(parentRecord));

    // Second pass - process child records and parameters
    this.subheadings.forEach((sub, index) => {
      const key = this.getUniqueKey(sub, index);
      if (!this.form.get(`is${key}Selected`)?.value) return;

      const formArray = this.form.get(`qualifications${key}`) as FormArray;
      formArray.controls.forEach((control) => {
        const group = control as FormGroup;
        const formValues = group.getRawValue();
        const percentage = +formValues['Percentage Obtained'] || 0;

        // Calculate scores for each qualification
        const scoreResult = this.utils.calculateScore(
          1,
          {
            educations: [
              {
                scoreFieldId: sub.m_rec_score_field_id,
                weight: sub.score_field_field_weightage,
                inputValue: percentage,
                maxValue: sub.score_field_field_marks,
              },
            ],
          },
          this.heading?.score_field_field_marks || 60
        );

        // Prepare detail record
        const detail = {
          ...(formValues['a_rec_app_score_field_detail_id'] && {
            a_rec_app_score_field_detail_id:
              formValues['a_rec_app_score_field_detail_id'],
          }),
          registration_no: registrationNo,
          a_rec_app_main_id: 95,
          a_rec_adv_post_detail_id: sub.a_rec_adv_post_detail_id,
          score_field_parent_id: sub.score_field_parent_id,
          m_rec_score_field_id: sub.m_rec_score_field_id,
          m_rec_score_field_method_id: 1, // Must match parent's method ID
          score_field_value: percentage,
          score_field_actual_value: scoreResult.score_field_actual_value,
          score_field_calculated_value:
            scoreResult.score_field_calculated_value,
          verify_remark: 'Not Verified',
          action_type: formValues['a_rec_app_score_field_detail_id']
            ? 'U'
            : 'C',
          action_date: new Date().toISOString(),
          action_ip_address: '127.0.0.1',
          delete_flag: 'N',
        };

        // Add to appropriate array
        (detail.a_rec_app_score_field_detail_id
          ? existingDetails
          : newDetails
        ).push(detail);

        // Process parameters
        this.getParameters(
          sub.m_rec_score_field_id,
          sub.a_rec_adv_post_detail_id
        ).forEach((param) => {
          const paramName = param.score_field_parameter_name;
          const paramValue = formValues[paramName];
          const isFile = paramValue instanceof File;
          const paramId =
            formValues[`param_${param.m_rec_score_field_parameter_id}_id`];
          const filePathKey = `${key}_${param.m_rec_score_field_parameter_id}`;

          // Clean filename if it's a file
          const cleanFileName = isFile
            ? paramValue.name.replace(/(\.pdf)+$/, '.pdf')
            : null;

          const parameter = {
            ...(paramId && {
              a_rec_app_score_field_parameter_detail_id: paramId,
            }),
            registration_no: registrationNo,
            score_field_parent_id: sub.score_field_parent_id,
            m_rec_score_field_id: sub.m_rec_score_field_id,
            m_rec_score_field_parameter_id:
              param.m_rec_score_field_parameter_id,
            parameter_value: isFile
              ? `recruitment/${registrationNo}/${cleanFileName}`
              : this.filePaths.get(filePathKey) || String(paramValue || ''),
            parameter_display_no: param.parameter_display_order,
            verify_remark: 'Not Verified',
            action_type: paramId ? 'U' : 'C',
            action_date: new Date().toISOString(),
            action_ip_address: '127.0.0.1',
            delete_flag: 'N',
          };

          (paramId ? existingParameters : newParameters).push(parameter);

          if (isFile) {
            formData.append(
              `file_${sub.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}_${param.parameter_display_order}`,
              paramValue,
              `recruitment/${registrationNo}/${cleanFileName}`
            );
          }
        });
      });
    });

    // Save records
    if (newDetails.length > 0 || newParameters.length > 0) {
      this.saveRecords(
        registrationNo,
        formData,
        newDetails,
        newParameters,
        'saveCandidateScoreCard'
      );
    }
    if (existingDetails.length > 0 || existingParameters.length > 0) {
      this.saveRecords(
        registrationNo,
        formData,
        existingDetails,
        existingParameters,
        'updateCandidateScoreCard'
      );
    }

    if (newDetails.length === 0 && existingDetails.length === 0) {
      alert('No data to save. Please add at least one record.');
      return;
    }

    this.emitFormData();
  }

  private saveRecords(
    registrationNo: number,
    formData: FormData,
    details: any[],
    parameters: any[],
    endpoint: string
  ): void {
    const payload = new FormData();
    payload.append('registration_no', registrationNo.toString());
    payload.append('scoreFieldDetailList', JSON.stringify(details));
    payload.append('scoreFieldParameterList', JSON.stringify(parameters));
    payload.append('parentScore', formData.get('parentScore') as string);

    // Add directory structure information
    payload.append('fileDirectory', `recruitment/${registrationNo}`);

    // Copy files with proper paths
    Array.from(formData.entries()).forEach(([key, value]) => {
      if (value instanceof File) {
        payload.append(key, value, value.name);
      }
    });

    this.HTTP.postForm(
      `/candidate/postFile/${endpoint}`,
      payload,
      'recruitement'
    ).subscribe({
      next: () => {
        alert('Data saved successfully!');
        this.getParameterValuesAndPatch();
      },
      error: (err) => {
        alert(`Error: ${err.message}`);
        console.error('Save failed:', err);
      },
    });
  }

  private emitFormData(): void {
    const subheadingsData = this.subheadings.reduce((acc, sub, index) => {
      const key = this.getUniqueKey(sub, index);
      acc[key] = {
        m_rec_score_field_id: sub.m_rec_score_field_id,
        score_field_title_name: sub.score_field_title_name,
        a_rec_adv_post_detail_id: sub.a_rec_adv_post_detail_id,
      };
      return acc;
    }, {} as { [key: string]: any });

    const emitData = {
      ...this.form.value,
      _isValid: this.form.valid,
      heading: this.heading,
      subheadings: subheadingsData,
      filePaths: Array.from(this.filePaths.entries()).reduce(
        (obj, [key, value]) => ({ ...obj, [key]: value }),
        {}
      ),
    };

    this.formData.emit(emitData);
  }
}
