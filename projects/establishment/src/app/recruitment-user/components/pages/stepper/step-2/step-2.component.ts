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
  is_mandatory?: string;
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
  existingDetailIds: Map<string, number> = new Map();
  existingParameterIds: Map<string, number> = new Map();

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

  getFilePath(key: string, paramId: number, rowIndex: number): string | null {
    const fileKey = `${key}_${paramId}_${rowIndex}`;
    return this.filePaths.get(fileKey) || null;
  }

  sanitizeFileUrl(filePath: string): SafeUrl {
    let fileName = filePath.split('/').pop() || '';
    fileName = fileName.replace(/\.pdf\.pdf$/, '.pdf');
    const url = `http://192.168.1.57:3500/recruitment/24000001/${fileName}`;
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  getFileName(filePath: string): string {
    return filePath.split('/').pop() || 'Unknown File';
  }

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
      control.get(fieldName)?.setValue(file, { emitEvent: false });

      const key = arrayName.replace('qualifications', '');
      const param = this.parameters.find(
        (p) => p.score_field_parameter_name === fieldName
      );
      if (param) {
        const fileKey = `${key}_${param.m_rec_score_field_parameter_id}_${index}`;
        this.filePaths.delete(fileKey);
      }
      this.cdr.markForCheck();
    }
  }

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
      const validators: ValidatorFn[] =
        isSelected && param.is_mandatory === 'Y' ? [Validators.required] : [];

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
      const params = this.getParameters(
        sub.m_rec_score_field_id,
        sub.a_rec_adv_post_detail_id
      );

      params.forEach((param) => {
        const controlName = param.score_field_parameter_name;
        const ctrl = group.get(controlName);
        if (ctrl) {
          const validators: ValidatorFn[] =
            isSelected && param.is_mandatory === 'Y'
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

        return this.HTTP.getParam(
          '/master/get/getSubHeadingByParentScoreField',
          {
            a_rec_adv_main_id,
            score_field_parent_id: this.heading.m_rec_score_field_id,
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
        throw error;
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
          JSON.stringify(res.body?.data, null, 2)
        );
        const saved = res.body?.data || [];

        this.filePaths.clear();
        this.existingDetailIds.clear();
        this.existingParameterIds.clear();

        saved.forEach((item: any) => {
          const key = `${item.m_rec_score_field_id}_${
            item.a_rec_adv_post_detail_id
          }_${this.subheadings.findIndex(
            (s) =>
              s.m_rec_score_field_id === item.m_rec_score_field_id &&
              s.a_rec_adv_post_detail_id === item.a_rec_adv_post_detail_id
          )}`;

          this.existingDetailIds.set(
            `${item.m_rec_score_field_id}_${item.a_rec_adv_post_detail_id}`,
            item.a_rec_app_score_field_detail_id
          );
          this.existingParameterIds.set(
            `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_id}_0`,
            item.a_rec_app_score_field_parameter_detail_id
          );

          if (item.parameter_value?.includes('.pdf')) {
            this.filePaths.set(
              `${key}_${item.m_rec_score_field_parameter_id}_0`,
              item.parameter_value
            );
          }

          const formArray = this.form.get(`qualifications${key}`) as FormArray;
          if (formArray?.at(0)) {
            const control = formArray.at(0) as FormGroup;

            if (item.a_rec_app_score_field_detail_id) {
              control
                .get('a_rec_app_score_field_detail_id')
                ?.setValue(item.a_rec_app_score_field_detail_id, {
                  emitEvent: false,
                });
            }

            const paramIdControl = `param_${item.m_rec_score_field_parameter_id}_id`;
            if (
              item.a_rec_app_score_field_parameter_detail_id &&
              control.get(paramIdControl)
            ) {
              control
                .get(paramIdControl)
                ?.setValue(item.a_rec_app_score_field_parameter_detail_id, {
                  emitEvent: false,
                });
            }

            const fieldName = this.parameters.find(
              (p) =>
                p.m_rec_score_field_parameter_id ===
                item.m_rec_score_field_parameter_id
            )?.score_field_parameter_name;

            if (fieldName && control.get(fieldName)) {
              if (item.parameter_value.includes('.pdf')) {
                control.get(fieldName)?.setValue(null, { emitEvent: false });
              } else {
                control
                  .get(fieldName)
                  ?.setValue(item.parameter_value, { emitEvent: false });
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

  private generateFilePath(
    registrationNo: number,
    file: File,
    scoreFieldId: number,
    parameterId: number,
    displayOrder: number,
    rowIndex: number
  ): string {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const baseName = file.name.split('.').slice(0, -1).join('.');
    const fileName = `${timestamp}_scorecard_${scoreFieldId}_${parameterId}_${displayOrder}_${rowIndex}.${fileExtension}`;
    return `recruitment/${registrationNo}/${fileName}`;
  }

  submitForm(): void {
    const registrationNo = 24000001;
    const a_rec_adv_main_id = 95;
    const formData = new FormData();
    const newDetails: any[] = [];
    const existingDetails: any[] = [];
    const newParameters: any[] = [];
    const existingParameters: any[] = [];
    let parentCalculatedValue = 0;

    this.subheadings.forEach((sub, index) => {
      const key = this.getUniqueKey(sub, index);
      if (!this.form.get(`is${key}Selected`)?.value) return;

      const formArray = this.form.get(`qualifications${key}`) as FormArray;
      formArray.controls.forEach((control, rowIndex) => {
        const group = control as FormGroup;
        const percentage = +group.get('Percentage Obtained')?.value || 0;

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

        parentCalculatedValue += scoreResult.score_field_calculated_value;

        const formValues = group.getRawValue();
        const detailKey = `${sub.m_rec_score_field_id}_${sub.a_rec_adv_post_detail_id}`;
        const existingDetailId = this.existingDetailIds.get(detailKey);

        const detail = {
          ...(existingDetailId && {
            a_rec_app_score_field_detail_id: existingDetailId,
          }),
          registration_no: registrationNo,
          a_rec_app_main_id: a_rec_adv_main_id,
          a_rec_adv_post_detail_id: sub.a_rec_adv_post_detail_id,
          score_field_parent_id: sub.score_field_parent_id,
          m_rec_score_field_id: sub.m_rec_score_field_id,
          m_rec_score_field_method_id: 1,
          score_field_value: percentage,
          score_field_actual_value: scoreResult.score_field_actual_value,
          score_field_calculated_value:
            scoreResult.score_field_calculated_value,
          field_marks: sub.score_field_field_marks || 0,
          field_weightage: sub.score_field_field_weightage || 0,
          verify_remark: 'Not Verified',
          action_type: existingDetailId ? 'U' : 'C',
          action_date: new Date().toISOString(),
          action_ip_address: '127.0.0.1',
          action_remark: existingDetailId
            ? 'data updated from recruitment form'
            : 'data inserted from recruitment form',
          action_by: 1,
          delete_flag: 'N',
        };

        (existingDetailId ? existingDetails : newDetails).push(detail);

        this.getParameters(
          sub.m_rec_score_field_id,
          sub.a_rec_adv_post_detail_id
        ).forEach((param) => {
          const paramName = param.score_field_parameter_name;
          const paramValue = formValues[paramName];
          const isFile = paramValue instanceof File;
          const paramId =
            formValues[`param_${param.m_rec_score_field_parameter_id}_id`];
          const fileKey = `${key}_${param.m_rec_score_field_parameter_id}_${rowIndex}`;
          const existingFilePath = this.filePaths.get(fileKey);

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
              ? this.generateFilePath(
                  registrationNo,
                  paramValue,
                  sub.m_rec_score_field_id,
                  param.m_rec_score_field_parameter_id,
                  param.parameter_display_order,
                  rowIndex
                )
              : existingFilePath && !paramValue
              ? existingFilePath
              : String(paramValue ?? 'Not Provided'),
            parameter_display_no: param.parameter_display_order,
            unique_parameter_display_no: String(param.parameter_display_order),
            verify_remark: 'Not Verified',
            active_status: 'Y',
            action_type: paramId ? 'U' : 'C',
            action_date: new Date().toISOString(),
            action_ip_address: '127.0.0.1',
            action_remark: paramId
              ? 'parameter updated from recruitment form'
              : 'parameter inserted from recruitment form',
            action_by: 1,
            delete_flag: 'N',
          };

          (paramId ? existingParameters : newParameters).push(parameter);

          if (isFile) {
            const fileControlName = `file_${sub.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}_${param.parameter_display_order}_${rowIndex}`;
            formData.append(fileControlName, paramValue, paramValue.name);
          } else if (existingFilePath && !paramValue) {
            const fileControlName = `file_${sub.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}_${param.parameter_display_order}_${rowIndex}`;
            formData.append(fileControlName, existingFilePath);
          }
        });
      });
    });

    const parentRecord = {
      registration_no: registrationNo,
      a_rec_app_main_id: a_rec_adv_main_id,
      a_rec_adv_post_detail_id: this.heading?.a_rec_adv_post_detail_id || 244,
      score_field_parent_id: 0,
      m_rec_score_field_id: this.heading?.m_rec_score_field_id,
      m_rec_score_field_method_id: 1,
      score_field_value: this.heading?.score_field_field_marks || 60,
      score_field_actual_value: parentCalculatedValue,
      score_field_calculated_value: Math.min(
        parentCalculatedValue,
        this.heading?.score_field_field_marks || 60
      ),
      field_marks: this.heading?.score_field_field_marks || 60,
      field_weightage: this.heading?.score_field_field_weightage || 0,
      verify_remark: 'Not Verified',
      action_type: 'U',
      action_date: new Date().toISOString(),
      action_ip_address: '127.0.0.1',
      action_remark: 'parent data updated from recruitment form',
      action_by: 1,
      delete_flag: 'N',
    };
    formData.append('parentScore', JSON.stringify(parentRecord));

    console.log(
      JSON.stringify(
        {
          event: 'submitForm_prepared_data',
          newDetails,
          existingDetails,
          newParameters,
          existingParameters,
          parentRecord,
          formDataEntries: Array.from(formData.entries()).map(([key, value]) => ({
            key,
            value: value instanceof File ? value.name : value,
          })),
        },
        null,
        2
      )
    );

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
      alert('No data to save. Please select at least one qualification.');
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

    Array.from(formData.entries()).forEach(([key, value]) => {
      if (key.startsWith('file_')) {
        payload.append(key, value);
      }
    });

    this.HTTP.postForm(
      `/candidate/postFile/${endpoint}`,
      payload,
      'recruitement'
    ).subscribe({
      next: (res) => {
        console.log(
          JSON.stringify(
            { event: `${endpoint}_success`, response: res.body?.data },
            null,
            2
          )
        );

        if (res.body?.data) {
          details.forEach((detail, index) => {
            if (res.body.data[index]?.a_rec_app_score_field_detail_id) {
              this.existingDetailIds.set(
                `${detail.m_rec_score_field_id}_${detail.a_rec_adv_post_detail_id}`,
                res.body.data[index].a_rec_app_score_field_detail_id
              );
            }
          });

          parameters.forEach((param, index) => {
            if (
              res.body.data[index]?.a_rec_app_score_field_parameter_detail_id
            ) {
              const paramKey = `${param.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}_${param.unique_parameter_display_no}`;
              this.existingParameterIds.set(
                paramKey,
                res.body.data[index].a_rec_app_score_field_parameter_detail_id
              );
            }
          });
        }

        alert('Data saved successfully!');
        this.getParameterValuesAndPatch();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(
          JSON.stringify(
            { event: `${endpoint}_error`, error: err.message },
            null,
            2
          )
        );
        alert(`Error saving data: ${err.message}`);
        this.cdr.markForCheck();
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
      ...this.form.getRawValue(),
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