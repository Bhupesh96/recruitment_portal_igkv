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
import { AlertService } from 'shared';

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
  score_field_is_mandatory: string;
}

interface Parameter {
  m_rec_score_field_id: number;
  m_rec_score_field_parameter_new_id: number;
  a_rec_adv_post_detail_id: number;
  score_field_parameter_name: string;
  control_type: 'T' | 'D' | 'DY' | 'A' | 'DV' | 'TV' | 'TM' | 'TO' | 'DP';
  parameter_display_order: number;
  is_mandatory?: string;
  isDatatype: string;
  isCalculationColumn: string;
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
  years: number[] = [];
  filePaths: Map<string, string> = new Map();
  existingDetailIds: Map<string, number> = new Map();
  existingParameterIds: Map<string, number> = new Map();

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private HTTP: HttpService,
    private sanitizer: DomSanitizer,
    private utils: UtilsService,
    private alertService: AlertService
  ) {
    this.form = this.fb.group({});
  }

  ngOnInit(): void {
    const currentYear = new Date().getFullYear();
    this.years = Array.from(
      { length: currentYear - 1970 + 1 },
      (_, i) => currentYear - i
    );
    this.loadFormData().subscribe({
      next: () => {
        this.getParameterValuesAndPatch();
      },
      error: (err) => {
        this.errorMessage = 'Failed to load form data: ' + err.message;
        this.alertService.alert(true, this.errorMessage, 3000);
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
        const fileKey = `${key}_${param.m_rec_score_field_parameter_new_id}_${index}`;
        this.filePaths.delete(fileKey);
      }
      this.checkMandatorySubheadingsAndParameters();
      this.cdr.markForCheck();
    }
  }

  private checkMandatorySubheadingsAndParameters(): void {
    let firstMissedMandatory: string = '';
    let firstMissedParameter: string = '';
    let firstMissedSubheading: string = ''; // Check for mandatory subheadings

    const missedMandatorySubheading = this.subheadings.find(
      (sub, index) =>
        sub.score_field_is_mandatory === '1' &&
        !this.form.get(`is${this.getUniqueKey(sub, index)}Selected`)?.value
    );

    if (missedMandatorySubheading) {
      firstMissedMandatory = missedMandatorySubheading.score_field_title_name;
    } else {
      // Check for mandatory parameters in selected subheadings
      for (
        let i = 0;
        i < this.subheadings.length && !firstMissedParameter;
        i++
      ) {
        const sub = this.subheadings[i];
        const key = this.getUniqueKey(sub, i);
        const isSelected = this.form.get(`is${key}Selected`)?.value;

        if (isSelected) {
          const formArray = this.form.get(`qualifications${key}`) as FormArray;
          const params = this.getParameters(
            sub.m_rec_score_field_id,
            sub.a_rec_adv_post_detail_id
          );

          for (const group of formArray.controls) {
            for (const param of params) {
              if (param.is_mandatory === 'Y') {
                const control = (group as FormGroup).get(
                  param.score_field_parameter_name
                );
                const isFile =
                  param.isDatatype === 'attachment' ||
                  param.control_type === 'A';
                const filePath = this.getFilePath(
                  key,
                  param.m_rec_score_field_parameter_new_id,
                  formArray.controls.indexOf(group)
                );

                if (!control?.value && (!isFile || (isFile && !filePath))) {
                  // Check if value is missing or no file is uploaded
                  firstMissedParameter = param.score_field_parameter_name;
                  firstMissedSubheading = sub.score_field_title_name;
                  break;
                }
              }
            }
            if (firstMissedParameter) break;
          }
        }
      }
    } // Set validation state

    const allMandatoryValid = !firstMissedMandatory && !firstMissedParameter;
    this.form
      .get('mandatorySubheadingsSelected')
      ?.setValue(allMandatoryValid, { emitEvent: false }); // Store the first missed mandatory item (subheading or parameter)

    this.form
      .get('firstMissedMandatory')
      ?.setValue(
        firstMissedMandatory ||
          (firstMissedParameter
            ? `${firstMissedParameter} under ${firstMissedSubheading} is missing`
            : ''),
        { emitEvent: false }
      );
  }

  private buildFormControls(): void {
    this.form.addControl(
      'heading',
      this.fb.control(this.heading?.score_field_title_name || '')
    );
    this.form.addControl('firstMissedMandatory', this.fb.control(''));
    this.form.addControl(
      'mandatorySubheadingsSelected',
      this.fb.control(false, Validators.requiredTrue)
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
          this.checkMandatorySubheadingsAndParameters();
          this.cdr.markForCheck();
        }); // Subscribe to value changes for each parameter control to trigger validation

      const formArray = this.form.get(`qualifications${key}`) as FormArray;
      formArray.controls.forEach((control) => {
        const group = control as FormGroup;
        params.forEach((param) => {
          const controlName = param.score_field_parameter_name;
          group.get(controlName)?.valueChanges.subscribe(() => {
            this.checkMandatorySubheadingsAndParameters();
            this.cdr.markForCheck();
          });
        });
      });
    });

    this.checkMandatorySubheadingsAndParameters();
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

      if (param.isCalculationColumn === 'Y') {
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
        `param_${param.m_rec_score_field_parameter_new_id}_id`,
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
          if (param.isCalculationColumn === 'Y') {
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
    const a_rec_adv_main_id = 96;
    const m_rec_score_field_id = 1;
    const m_rec_score_field = 'N'; //Heading

    const headingRequest = this.HTTP.getParam(
      '/master/get/getSubHeadingParameterByParentScoreField',
      { a_rec_adv_main_id, m_rec_score_field_id, m_rec_score_field },
      'recruitement'
    ) as Observable<HttpResponse<ApiResponse<Heading>>>;

    return headingRequest.pipe(
      switchMap((headingRes: HttpResponse<ApiResponse<Heading>>) => {
        const headingList = headingRes.body?.data || [];
        if (!headingList.length) throw new Error('No heading data found');

        this.heading = headingList[0]; //Sub-Heading
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

            const parameterRequests = this.subheadings.map((sub) =>
              this.HTTP.getParam(
                '/master/get/getSubHeadingParameterByParentScoreField',
                {
                  a_rec_adv_main_id,
                  m_rec_score_field_id: sub.m_rec_score_field_id,
                  score_field_parent_code: sub.score_field_parent_code,
                  m_rec_score_field_parameter_new: 'N',
                  m_parameter_master: 'Y',
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
        this.alertService.alert(true, this.errorMessage, 3000);
        this.loading = false;
        this.cdr.markForCheck();
        throw error;
      })
    );
  }

  private getParameterValuesAndPatch(): void {
    this.HTTP.getParam(
      '/candidate/get/getParameterValues',
      {
        registration_no: 24000001,
        a_rec_app_main_id: 96,
        score_field_parent_id: this.heading?.m_rec_score_field_id,
      },
      'recruitement'
    ).subscribe({
      next: (res: HttpResponse<any>) => {
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
          const rowIndex = item.parameter_row_index
            ? item.parameter_row_index - 1
            : 0;

          this.existingDetailIds.set(
            `${item.m_rec_score_field_id}_${item.a_rec_adv_post_detail_id}`,
            item.a_rec_app_score_field_detail_id
          );
          this.existingParameterIds.set(
            `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_new_id}_0`,
            item.a_rec_app_score_field_parameter_detail_id
          );

          if (item.parameter_value?.includes('.pdf')) {
            this.filePaths.set(
              `${key}_${item.m_rec_score_field_parameter_new_id}_${rowIndex}`, // <-- Use dynamic row index
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

            const paramIdControl = `param_${item.m_rec_score_field_parameter_new_id}_id`;
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
                p.m_rec_score_field_parameter_new_id ===
                item.m_rec_score_field_parameter_new_id
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
        this.checkMandatorySubheadingsAndParameters();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorMessage = 'Failed to load saved data: ' + err.message;
        this.alertService.alert(true, this.errorMessage, 3000);
        this.cdr.markForCheck();
      },
    });
  }

  private generateFilePath(
    registrationNo: number,
    file: File,
    subHeadingId: number, // Corresponds to score_field_parent_id
    scoreFieldId: number, // Corresponds to m_rec_score_field_id
    parameterId: number, // Corresponds to m_rec_score_field_parameter_new_id
    rowIndex: number // The unique row index for the parameter
  ): string {
    // Sanitize the original filename to make it URL-safe
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^_+|_+$/g, ''); // Trim underscores from start/end // Construct the new filename based on the backend's required format

    const fileName = `${registrationNo}_${subHeadingId}_${scoreFieldId}_${parameterId}_${rowIndex}_${sanitizedName}`;

    return `recruitment/${registrationNo}/${fileName}`;
  }

  /**
   * ✅ UPDATED METHOD
   * This method now uses the `generateFilePath` function to create the file path and name.
   */
  submitForm(): void {
    this.form.markAllAsTouched();
    this.checkMandatorySubheadingsAndParameters();

    const firstMissed = this.form.get('firstMissedMandatory')?.value;
    if (firstMissed) {
      this.alertService.alert(
        true,
        `${firstMissed} is mandatory. Please provide the required information.`,
        3000
      );
      this.emitFormData();
      return;
    }

    if (this.form.invalid) {
      this.alertService.alert(true, 'Please fill all mandatory fields.', 3000);
      this.emitFormData();
      return;
    } // --- Configuration ---

    const registrationNo = 24000001;
    const a_rec_adv_main_id = 96;
    const formData = new FormData(); // --- Payload Preparation ---

    const allDetails: any[] = [];
    const allParameters: any[] = [];
    let parentCalculatedValue = 0;
    const rowIndexCounter = new Map<string, number>(); // STEP 1: Loop through all subheadings to gather data

    this.subheadings.forEach((sub, index) => {
      const key = this.getUniqueKey(sub, index);
      if (!this.form.get(`is${key}Selected`)?.value) return;

      const formArray = this.form.get(`qualifications${key}`) as FormArray;

      formArray.controls.forEach((control, controlIndex) => {
        const currentRowIndex = (rowIndexCounter.get(key) || 0) + 1;
        rowIndexCounter.set(key, currentRowIndex);

        const group = control as FormGroup;
        const formValues = group.getRawValue();
        const percentage = +group.get('Percentage Obtained')?.value || 0; // Calculate score for the child record

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
        parentCalculatedValue += scoreResult.score_field_calculated_value; // Create the unified Detail record

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
          action_remark: existingDetailId ? 'data updated' : 'data inserted',
          action_by: 1,
          delete_flag: 'N',
        };
        allDetails.push(detail); // Create unified Parameter records for this detail

        this.getParameters(
          sub.m_rec_score_field_id,
          sub.a_rec_adv_post_detail_id
        ).forEach((param) => {
          const paramName = param.score_field_parameter_name;
          const paramValue = formValues[paramName];
          const isFile = paramValue instanceof File;
          const fileKey = `${key}_${param.m_rec_score_field_parameter_new_id}_${controlIndex}`;
          const existingFilePath = this.filePaths.get(fileKey);
          const paramId =
            formValues[`param_${param.m_rec_score_field_parameter_new_id}_id`];

          if (paramValue || existingFilePath) {
            let finalParameterValue = '';
            if (isFile) {
              // Generate the file path for the database record
              finalParameterValue = this.generateFilePath(
                registrationNo,
                paramValue,
                sub.score_field_parent_id,
                sub.m_rec_score_field_id,
                param.m_rec_score_field_parameter_new_id,
                currentRowIndex
              );

              // ✅ FIX: Create a structured key for FormData that the backend can parse.
              // This key includes the row index in the correct position (the 6th element).
              const fileControlName = `file_${sub.score_field_parent_id}_${
                sub.m_rec_score_field_id
              }_${param.m_rec_score_field_parameter_new_id}_${
                param.parameter_display_order || 0
              }_${currentRowIndex}`;

              // Append the file to FormData using the new structured key
              formData.append(fileControlName, paramValue, paramValue.name);
            } else {
              finalParameterValue = existingFilePath
                ? existingFilePath
                : String(paramValue ?? '');
            }

            const parameter = {
              ...(paramId && {
                a_rec_app_score_field_parameter_detail_id: paramId,
              }),
              registration_no: registrationNo,
              score_field_parent_id: sub.score_field_parent_id,
              m_rec_score_field_id: sub.m_rec_score_field_id,
              m_rec_score_field_parameter_new_id:
                param.m_rec_score_field_parameter_new_id,
              parameter_value: finalParameterValue,
              parameter_row_index: currentRowIndex,
              parameter_display_no: param.parameter_display_order,
              unique_parameter_display_no: String(
                param.parameter_display_order
              ),
              verify_remark: 'Not Verified',
              active_status: 'Y',
              action_type: paramId ? 'U' : 'C',
              action_date: new Date().toISOString(),
              action_ip_address: '127.0.0.1',
              action_remark: paramId
                ? 'parameter updated'
                : 'parameter inserted',
              action_by: 1,
              delete_flag: 'N',
            };
            allParameters.push(parameter);
          }
        });
      });
    }); // STEP 2: Create Parent Record

    const parentRecord = {
      registration_no: registrationNo,
      a_rec_app_main_id: a_rec_adv_main_id,
      a_rec_adv_post_detail_id: this.heading?.a_rec_adv_post_detail_id || 246,
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
      action_remark: 'parent data updated',
      action_by: 1,
      delete_flag: 'N',
    }; // STEP 3: Append all data to FormData

    formData.append('parentScore', JSON.stringify(parentRecord));
    formData.append('registration_no', registrationNo.toString());
    formData.append('scoreFieldDetailList', JSON.stringify(allDetails));
    formData.append('scoreFieldParameterList', JSON.stringify(allParameters)); // STEP 4: Make the SINGLE API call

    this.HTTP.postForm(
      '/candidate/postFile/saveOrUpdateCandidateScoreCard',
      formData,
      'recruitement'
    ).subscribe({
      next: (res) => {
        this.alertService.alertStatus(
          res.status,
          'Data saved successfully!',
          3000
        );
        this.getParameterValuesAndPatch(); // Refresh component state
        this.cdr.markForCheck();
      },
      error: (err) => {
        const errorMessage = err.body?.error?.message
          ? `Something went wrong: ${err.body.error.message}`
          : `Error saving data: ${err.message}`;
        this.alertService.alertStatus(err.status || 500, errorMessage, 3000);
        this.cdr.markForCheck();
      },
    });

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
        if (res.body?.error) {
          this.alertService.alert(
            true,
            `Something went wrong: ${res.body.error.message}`,
            3000
          );
          this.cdr.markForCheck();
          return;
        }

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
              const paramKey = `${param.m_rec_score_field_id}_${param.m_rec_score_field_parameter_new_id}_${param.unique_parameter_display_no}`;
              this.existingParameterIds.set(
                paramKey,
                res.body.data[index].a_rec_app_score_field_parameter_detail_id
              );
            }
          });
        }

        this.alertService.alertStatus(
          res.status,
          'Data saved successfully!',
          3000
        );
        this.getParameterValuesAndPatch();
        this.cdr.markForCheck();
      },
      error: (err) => {
        const errorMessage = err.body?.error?.message
          ? `Something went wrong: ${err.body.error.message}`
          : `Error saving data: ${err.message}`;
        console.error(
          JSON.stringify(
            { event: `${endpoint}_error`, error: err.message },
            null,
            2
          )
        );
        this.alertService.alertStatus(err.status || 500, errorMessage, 3000);
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
    }; // console.log( //   '📤 Step2 form emitting data:', //   JSON.stringify(emitData, null, 2) // );
    this.formData.emit(emitData);
  }
}
