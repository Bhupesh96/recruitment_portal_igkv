import {
  Component,
  OnInit,
  Output,
  EventEmitter,
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
import { Observable, forkJoin, of } from 'rxjs';
import { switchMap, tap, catchError, map } from 'rxjs/operators';
import { HttpService, SharedModule } from 'shared';
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
    | 'DP'
    | 'DT'
    | 'DE';
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
  selector: 'app-step-5',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './step-5.component.html',
  styleUrls: ['./step-5.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step5Component implements OnInit {
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
    private utils: UtilsService,
    private alertService: AlertService
  ) {
    this.form = this.fb.group({});
  }

  ngOnInit(): void {
    this.loadFormData().subscribe(() => {
      this.getParameterValuesAndPatch();
    });
  }

  private buildFormControls(): void {
    this.form.addControl(
      'heading',
      this.fb.control(this.heading?.score_field_title_name ?? '')
    );

    this.subheadings.forEach((subheading, index) => {
      const key = this.getUniqueKey(subheading, index);
      this.form.addControl(`qualifications${key}`, this.fb.array([]));
    });
  }

  private getKeyForSaved(item: any): string {
    const index = this.subheadings.findIndex(
      (s) =>
        s.m_rec_score_field_id === item.m_rec_score_field_id &&
        s.a_rec_adv_post_detail_id === item.a_rec_adv_post_detail_id
    );
    return `${item.m_rec_score_field_id}_${item.a_rec_adv_post_detail_id}_${index}`;
  }

  private getUniqueKey(sub: Subheading, index: number): string {
    return `${sub.m_rec_score_field_id}_${sub.a_rec_adv_post_detail_id}_${index}`;
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
        const paramIdToNameMap: Record<number, string> = {};
        this.parameters.forEach((p) => {
          paramIdToNameMap[p.m_rec_score_field_parameter_id] =
            p.score_field_parameter_name;
        });

        // Group saved records by subheading key and detail ID
        const recordsByKeyAndDetailId: Map<
          string,
          { detailId: number; items: any[]; recordIndex: number }[]
        > = new Map();
        saved.forEach((item: any) => {
          const key = this.getKeyForSaved(item);
          const detailId = item.a_rec_app_score_field_detail_id || 0;
          if (!recordsByKeyAndDetailId.has(key)) {
            recordsByKeyAndDetailId.set(key, []);
          }
          const group = recordsByKeyAndDetailId.get(key)!;
          let detailGroup = group.find((g) => g.detailId === detailId);
          if (!detailGroup) {
            detailGroup = { detailId, items: [], recordIndex: group.length };
            group.push(detailGroup);
          }
          detailGroup.items.push(item);
        });

        // Clear existing FormArray controls
        this.subheadings.forEach((subheading, index) => {
          const key = this.getUniqueKey(subheading, index);
          const formArray = this.form.get(`qualifications${key}`) as FormArray;
          while (formArray.length) {
            formArray.removeAt(0);
          }
        });

        // Create FormGroup for each saved record per subheading
        this.subheadings.forEach((subheading, index) => {
          const key = this.getUniqueKey(subheading, index);
          const formArray = this.form.get(`qualifications${key}`) as FormArray;
          const records = recordsByKeyAndDetailId.get(key) || [];

          // Sort records by detailId for consistent order
          records.sort((a, b) => a.detailId - b.detailId);

          // Add a form group for each saved record
          records.forEach(({ detailId, items, recordIndex }) => {
            const group = this.createQualificationGroup(subheading);
            if (detailId) {
              group.get('a_rec_app_score_field_detail_id')?.setValue(detailId);
              this.existingDetailIds.set(
                `${subheading.m_rec_score_field_id}_${subheading.a_rec_adv_post_detail_id}_${recordIndex}`,
                detailId
              );
            }

            // Group parameters by unique_parameter_display_no and sort by a_rec_app_score_field_parameter_detail_id
            const paramGroups: Map<string, any[]> = new Map();
            items.forEach((item) => {
              const uniqueDisplayNo = item.unique_parameter_display_no;
              if (!paramGroups.has(uniqueDisplayNo)) {
                paramGroups.set(uniqueDisplayNo, []);
              }
              paramGroups.get(uniqueDisplayNo)!.push(item);
            });

            // Select parameters based on recordIndex
            const paramMap: Map<number, any> = new Map();
            paramGroups.forEach((groupItems, uniqueDisplayNo) => {
              groupItems.sort(
                (a, b) =>
                  a.a_rec_app_score_field_parameter_detail_id -
                  b.a_rec_app_score_field_parameter_detail_id
              );
              const selectedItem =
                groupItems[recordIndex] || groupItems[groupItems.length - 1];
              paramMap.set(
                selectedItem.m_rec_score_field_parameter_id,
                selectedItem
              );
            });

            // Patch form group with selected parameters
            paramMap.forEach((item) => {
              const fieldName =
                paramIdToNameMap[item.m_rec_score_field_parameter_id];
              if (fieldName && group.get(fieldName)) {
                if (
                  item.parameter_value.includes('.pdf') ||
                  item.parameter_value.includes('.jpg') ||
                  item.parameter_value.includes('.jpeg') ||
                  item.parameter_value.includes('.png')
                ) {
                  const controlKey = `${key}_${item.m_rec_score_field_parameter_id}_${recordIndex}`;
                  this.filePaths.set(controlKey, item.parameter_value);
                  group.get(fieldName)?.setValue(null);
                } else {
                  group.get(fieldName)?.setValue(item.parameter_value);
                }
              }
              if (item.a_rec_app_score_field_parameter_detail_id) {
                group
                  .get(`param_${item.m_rec_score_field_parameter_id}_id`)
                  ?.setValue(item.a_rec_app_score_field_parameter_detail_id);
                this.existingParameterIds.set(
                  `${item.m_rec_score_field_id}_${item.a_rec_adv_post_detail_id}_${item.m_rec_score_field_parameter_id}_${detailId}`,
                  item.a_rec_app_score_field_parameter_detail_id
                );
              }
            });

            // Calculate experience for this record
            this.calculateExperienceForRecord(group, subheading);

            formArray.push(group);
          });

          // Add an empty group if no records exist for the subheading
          if (formArray.length === 0) {
            formArray.push(this.createQualificationGroup(subheading));
          }
        });

        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorMessage = 'Failed to load saved data: ' + err.message;
        this.alertService.alert(true, this.errorMessage, 3000);
        this.cdr.markForCheck();
      },
    });
  }

  private calculateExperienceForRecord(
    group: FormGroup,
    subheading: Subheading
  ): void {
    const fromDate = group.get('Period From')?.value;
    const toDate = group.get('Period To')?.value;

    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);

      // Calculate experience using UtilsService
      const experience = this.utils.calculateDuration(
        from,
        to,
        subheading.score_field_field_weightage || 1,
        'decimalYears'
      );

      // Store the calculated value (you might want to display this or use it in calculations)
      group.get('calculated_experience')?.setValue(experience);
    }
  }

  addQualification(subheading: Subheading, index: number): void {
    const key = this.getUniqueKey(subheading, index);
    const qualificationsArray = this.getQualifications(key);
    const newGroup = this.createQualificationGroup(subheading);

    // Ensure file inputs are cleared for new group
    const params = this.getParameters(
      subheading.m_rec_score_field_id,
      subheading.a_rec_adv_post_detail_id
    );
    params.forEach((param) => {
      if (param.score_field_control_type === 'A') {
        newGroup.get(param.score_field_parameter_name)?.setValue(null);
      }
    });

    qualificationsArray.push(newGroup);
    this.cdr.markForCheck();
  }

  removeQualification(
    subheading: Subheading,
    subheadingIndex: number,
    qualificationIndex: number
  ): void {
    const key = this.getUniqueKey(subheading, subheadingIndex);
    const qualificationsArray = this.getQualifications(key);
    const group = qualificationsArray.at(qualificationIndex) as FormGroup;

    // Clear filePaths for removed group
    this.getParameters(
      subheading.m_rec_score_field_id,
      subheading.a_rec_adv_post_detail_id
    ).forEach((param) => {
      if (param.score_field_control_type === 'A') {
        const controlKey = `${key}_${param.m_rec_score_field_parameter_id}_${qualificationIndex}`;
        this.filePaths.delete(controlKey);
      }
    });

    qualificationsArray.removeAt(qualificationIndex);
    this.cdr.markForCheck();
  }

  private createQualificationGroup(sub: Subheading): FormGroup {
    const group = this.fb.group({});
    const params = this.getParameters(
      sub.m_rec_score_field_id,
      sub.a_rec_adv_post_detail_id
    );

    group.addControl('a_rec_app_score_field_detail_id', this.fb.control(''));
    group.addControl('calculated_experience', this.fb.control(0)); // For storing calculated experience

    params.forEach((param) => {
      const validators = this.getParamValidators(param);
      group.addControl(
        param.score_field_parameter_name,
        this.fb.control(
          param.score_field_control_type === 'A' ? null : '',
          validators
        )
      );

      group.addControl(
        `param_${param.m_rec_score_field_parameter_id}_id`,
        this.fb.control('')
      );
    });

    // Add value change listeners for date fields to recalculate experience
    const fromDateControl = group.get('Period From');
    const toDateControl = group.get('Period To');

    if (fromDateControl && toDateControl) {
      fromDateControl.valueChanges.subscribe(() =>
        this.recalculateExperience(group, sub)
      );
      toDateControl.valueChanges.subscribe(() =>
        this.recalculateExperience(group, sub)
      );
    }

    return group;
  }

  private recalculateExperience(
    group: FormGroup,
    subheading: Subheading
  ): void {
    this.calculateExperienceForRecord(group, subheading);
  }

  private getParamValidators(param: Parameter): ValidatorFn[] {
    const validators: ValidatorFn[] = [Validators.required];
    if (
      param.score_field_parameter_name === 'Period From' ||
      param.score_field_parameter_name === 'Period To'
    ) {
      validators.push(this.dateValidator());
    }
    return validators;
  }

  private dateValidator(): ValidatorFn {
    return (control) => {
      if (!control.value) return null;

      const date = new Date(control.value);
      if (isNaN(date.getTime())) {
        return { invalidDate: true };
      }

      return null;
    };
  }

  private loadFormData(): Observable<void> {
    const a_rec_adv_main_id = 96;
    const m_rec_score_field_id = 32;

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

        return this.HTTP.getParam(
          '/master/get/getSubHeadingByParentScoreField',
          {
            a_rec_adv_main_id,
            score_field_parent_id: this.heading!.m_rec_score_field_id,
            a_rec_adv_post_detail_id: this.heading!.a_rec_adv_post_detail_id,
          },
          'recruitement'
        ) as Observable<HttpResponse<ApiResponse<Subheading>>>;
      }),
      switchMap((subheadingRes: HttpResponse<ApiResponse<Subheading>>) => {
        this.subheadings = subheadingRes.body?.data || [];

        return this.HTTP.getParam(
          '/master/get/getSubHeadingParameterByParentScoreField',
          {
            a_rec_adv_main_id,
            m_rec_score_field_id: this.heading!.m_rec_score_field_id,
            a_rec_adv_post_detail_id: this.heading!.a_rec_adv_post_detail_id,
          },
          'recruitement'
        ) as Observable<HttpResponse<ApiResponse<Parameter>>>;
      }),
      tap((parameterRes: HttpResponse<ApiResponse<Parameter>>) => {
        this.parameters = parameterRes.body?.data || [];
        this.buildFormControls();
        this.loading = false;
        this.cdr.markForCheck();
      }),
      map(() => {}),
      catchError((error) => {
        this.errorMessage = 'Error loading form: ' + error.message;
        this.alertService.alert(true, this.errorMessage, 3000);
        this.loading = false;
        this.cdr.markForCheck();
        throw error;
      })
    );
  }

  getParameters(score_field_id: number, post_detail_id: number): Parameter[] {
    return [...this.parameters].sort(
      (a, b) => a.parameter_display_order - b.parameter_display_order
    );
  }

  getQualifications(key: string): FormArray {
    return this.form.get(`qualifications${key}`) as FormArray;
  }

  getFilePath(key: string, paramId: number, index: number): string | null {
    const filePath = this.filePaths.get(`${key}_${paramId}_${index}`);
    return filePath || null;
  }

  sanitizeFileUrl(filePath: string): SafeUrl {
    let fileName = filePath.split('\\').pop() || '';
    fileName = fileName.replace(/\.pdf\.pdf$/, '.pdf');
    const url = `http://192.168.1.57:3500/${fileName}`;
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  getFileName(filePath: string): string {
    return filePath.split('\\').pop() || 'Unknown File';
  }

  onFileSelected(
    event: Event,
    index: number,
    arrayName: string,
    fieldName: string
  ): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        this.alertService.alert(
          true,
          'Invalid file type. Only PDF, JPG, JPEG, or PNG files are allowed.',
          3000
        );
        input.value = '';
        return;
      }

      (this.form.get(arrayName) as FormArray)
        .at(index)
        .get(fieldName)
        ?.setValue(file);
      const key = arrayName.replace('qualifications', '');
      const param = this.parameters.find(
        (p) =>
          p.score_field_parameter_name === fieldName &&
          `${p.m_rec_score_field_id}_${p.a_rec_adv_post_detail_id}_${
            key.split('_')[2]
          }` === key
      );
      if (param) {
        const controlKey = `${key}_${param.m_rec_score_field_parameter_id}_${index}`;
        this.filePaths.delete(controlKey);
      }
      this.cdr.markForCheck();
    }
  }

  submitForm(): void {
    const registrationNo = 24000001;
    const newDetails: any[] = [];
    const existingDetails: any[] = [];
    const newParameters: any[] = [];
    const existingParameters: any[] = [];
    let parentCalculatedValue = 0;

    this.subheadings.forEach((sub, index) => {
      const key = this.getUniqueKey(sub, index);
      const formArray = this.form.get(`qualifications${key}`) as FormArray;

      formArray.controls.forEach((control, rowIndex) => {
        const group = control as FormGroup;
        const formValues = group.getRawValue();
        const detailId = formValues['a_rec_app_score_field_detail_id'];
        const isExistingRecord = !!detailId;

        // Calculate experience for this record
        const fromDate = formValues['Period From'];
        const toDate = formValues['Period To'];
        let calculatedExperience = 0;

        if (fromDate && toDate) {
          const from = new Date(fromDate);
          const to = new Date(toDate);

          // Calculate experience using UtilsService
          calculatedExperience = this.utils.calculateDuration(
            from,
            to,
            sub.score_field_field_weightage || 1,
            'decimalYears'
          );
        }

        // Cap the experience at the subheading's maximum marks
        const finalExperience = Math.min(
          calculatedExperience,
          sub.score_field_field_marks || 0
        );

        parentCalculatedValue += finalExperience;

        const detail = {
          ...(isExistingRecord && {
            a_rec_app_score_field_detail_id: detailId,
          }),
          registration_no: registrationNo,
          a_rec_app_main_id: 96,
          a_rec_adv_post_detail_id: sub.a_rec_adv_post_detail_id,
          score_field_parent_id: sub.score_field_parent_id,
          m_rec_score_field_id: sub.m_rec_score_field_id,
          m_rec_score_field_method_id: 2, // Experience calculation method
          score_field_value: calculatedExperience,
          score_field_actual_value: calculatedExperience,
          score_field_calculated_value: finalExperience,
          field_marks: sub.score_field_field_marks || 0,
          field_weightage: sub.score_field_field_weightage || 0,
          remark: isExistingRecord ? 'row updated' : 'row inserted',
          unique_parameter_display_no: String(sub.score_field_display_no),
          verify_remark: 'Not Verified',
          active_status: 'Y',
          action_type: isExistingRecord ? 'U' : 'C',
          action_ip_address: '127.0.0.1',
          action_remark: isExistingRecord
            ? 'Updated via recruitment form'
            : 'Created via recruitment form',
          action_by: 1,
          delete_flag: 'N',
        };

        if (isExistingRecord) {
          existingDetails.push(detail);
        } else {
          newDetails.push(detail);
        }

        this.getParameters(
          sub.m_rec_score_field_id,
          sub.a_rec_adv_post_detail_id
        ).forEach((param) => {
          const paramName = param.score_field_parameter_name;
          const paramValue = formValues[paramName];
          const isFile = paramValue instanceof File;
          const paramId =
            formValues[`param_${param.m_rec_score_field_parameter_id}_id`];
          const isParamUpdate = !!paramId;
          const fileKey = `${key}_${param.m_rec_score_field_parameter_id}_${rowIndex}`;
          const existingFilePath = this.filePaths.get(fileKey);

          let finalParamValue = paramValue;
          if (param.score_field_control_type === 'A' && !isFile) {
            finalParamValue = existingFilePath || '';
          }

          let fileExtension = '';
          if (isFile) {
            const fileName = paramValue.name.toLowerCase();
            if (fileName.endsWith('.pdf')) {
              fileExtension = '.pdf';
            } else if (
              fileName.endsWith('.jpg') ||
              fileName.endsWith('.jpeg')
            ) {
              fileExtension = '.jpeg';
            } else if (fileName.endsWith('.png')) {
              fileExtension = '.png';
            }
          }

          const parameter = {
            ...(isParamUpdate && {
              a_rec_app_score_field_parameter_detail_id: paramId,
            }),
            registration_no: registrationNo,
            score_field_parent_id: sub.score_field_parent_id,
            m_rec_score_field_id: sub.m_rec_score_field_id,
            m_rec_score_field_parameter_id:
              param.m_rec_score_field_parameter_id,
            parameter_value: isFile
              ? `file_${param.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}_${rowIndex}${fileExtension}`
              : String(finalParamValue ?? ''),
            is_active: 'Y',
            parameter_display_order: param.parameter_display_order,
            obt_marks: 0,
            unique_parameter_display_no: String(param.parameter_display_order),
            verify_remark: 'Not Verified',
            active_status: 'Y',
            action_type: isParamUpdate ? 'U' : 'C',
            action_date: new Date().toISOString(),
            action_ip_address: '127.0.0.1',
            action_remark: isParamUpdate
              ? 'Updated via recruitment form'
              : 'Created via recruitment form',
            action_by: 1,
            delete_flag: 'N',
          };

          if (isParamUpdate) {
            existingParameters.push(parameter);
          } else {
            newParameters.push(parameter);
          }
        });
      });
    });

    // Create parent record
    const parentRecord = {
      registration_no: registrationNo,
      a_rec_app_main_id: 96,
      a_rec_adv_post_detail_id: this.heading?.a_rec_adv_post_detail_id || 246,
      score_field_parent_id: 0,
      m_rec_score_field_id: this.heading?.m_rec_score_field_id,
      m_rec_score_field_method_id: 2,
      score_field_value: parentCalculatedValue,
      score_field_actual_value: parentCalculatedValue,
      score_field_calculated_value: Math.min(
        parentCalculatedValue,
        this.heading?.score_field_field_marks || 10
      ),
      field_marks: this.heading?.score_field_field_marks || 10,
      field_weightage: this.heading?.score_field_field_weightage || 0,
      verify_remark: 'Not Verified',
      action_type: 'U',
      action_date: new Date().toISOString(),
      action_ip_address: '127.0.0.1',
      action_remark: 'parent data updated from recruitment form',
      action_by: 1,
      delete_flag: 'N',
    };

    const formData = new FormData();
    formData.append('registration_no', registrationNo.toString());
    formData.append('parentScore', JSON.stringify(parentRecord));

    // Add files to FormData
    this.subheadings.forEach((sub, index) => {
      const key = this.getUniqueKey(sub, index);
      const formArray = this.form.get(`qualifications${key}`) as FormArray;

      formArray.controls.forEach((control, rowIndex) => {
        const group = control as FormGroup;
        const formValues = group.getRawValue();

        this.getParameters(
          sub.m_rec_score_field_id,
          sub.a_rec_adv_post_detail_id
        ).forEach((param) => {
          const paramValue = formValues[param.score_field_parameter_name];
          if (paramValue instanceof File) {
            const fileName = paramValue.name.toLowerCase();
            let fileExtension = '';
            if (fileName.endsWith('.pdf')) {
              fileExtension = '.pdf';
            } else if (
              fileName.endsWith('.jpg') ||
              fileName.endsWith('.jpeg')
            ) {
              fileExtension = '.jpeg';
            } else if (fileName.endsWith('.png')) {
              fileExtension = '.png';
            }
            const fileControlName = `file_${param.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}_${rowIndex}${fileExtension}`;
            formData.append(fileControlName, paramValue, fileControlName);
          }
        });
      });
    });

    // Save new records if any
    if (newDetails.length > 0) {
      this.saveRecords(
        registrationNo,
        formData,
        newDetails,
        newParameters,
        'saveCandidateScoreCard'
      );
    }

    // Update existing records if any
    if (existingDetails.length > 0) {
      this.saveRecords(
        registrationNo,
        formData,
        existingDetails,
        existingParameters,
        'updateCandidateScoreCard'
      );
    }

    // If no records to save or update
    if (newDetails.length === 0 && existingDetails.length === 0) {
      this.alertService.alert(true, 'No data to save or update.', 3000);
    }
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

    // Copy files
    Array.from(formData.entries()).forEach(([key, value]) => {
      if (value instanceof File) {
        payload.append(key, value, key);
      }
    });

    this.HTTP.postForm(
      `/candidate/postFile/${endpoint}`,
      payload,
      'recruitement'
    ).subscribe({
      next: (res) => {
        // Check if res.body.data is an array before using forEach
        if (res.body?.data && Array.isArray(res.body.data)) {
          res.body.data.forEach((item: any, index: number) => {
            if (
              item.a_rec_app_score_field_detail_id &&
              index < details.length
            ) {
              this.existingDetailIds.set(
                `${details[index].m_rec_score_field_id}_${details[index].a_rec_adv_post_detail_id}`,
                item.a_rec_app_score_field_detail_id
              );
            }
            if (
              item.a_rec_app_score_field_parameter_detail_id &&
              index < parameters.length
            ) {
              const paramKey = `${parameters[index].m_rec_score_field_id}_${parameters[index].a_rec_adv_post_detail_id}_${parameters[index].m_rec_score_field_parameter_id}`;
              this.existingParameterIds.set(
                paramKey,
                item.a_rec_app_score_field_parameter_detail_id
              );
            }
          });
        } else {
          // Handle the case where the data is a single object or not an array.
          // If it's a single object, process it here.
          if (res.body?.data) {
            const item = res.body.data;
            // Example of handling a single item:
            if (item.a_rec_app_score_field_detail_id) {
              // Find the matching detail to get the old key
              const matchedDetail = details.find(
                (d) =>
                  d.a_rec_adv_post_detail_id ===
                    item.a_rec_adv_post_detail_id &&
                  d.m_rec_score_field_id === item.m_rec_score_field_id
              );
              if (matchedDetail) {
                const oldKey = `${matchedDetail.m_rec_score_field_id}_${matchedDetail.a_rec_adv_post_detail_id}`;
                this.existingDetailIds.set(
                  oldKey,
                  item.a_rec_app_score_field_detail_id
                );
              }
            }
          }
        }

        this.alertService.alert(false, 'Data saved successfully!', 3000);
        this.emitFormData();
        this.getParameterValuesAndPatch();
      },
      error: (err) => {
        this.alertService.alert(
          true,
          `Error saving data: ${err.message}`,
          3000
        );
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
      ...this.form.value,
      _isValid: this.form.valid,
      heading: this.heading
        ? {
            score_field_title_name: this.heading.score_field_title_name,
            m_rec_score_field_id: this.heading.m_rec_score_field_id,
            a_rec_adv_post_detail_id: this.heading.a_rec_adv_post_detail_id,
          }
        : null,
      subheadings: subheadingsData,
      filePaths: Array.from(this.filePaths.entries()).reduce(
        (obj, [key, value]) => {
          obj[key] = value;
          return obj;
        },
        {} as { [key: string]: string }
      ),
    };
 console.log('📤 Step5 form emitting data:', JSON.stringify(emitData, null, 2));
    this.formData.emit(emitData);
    this.cdr.markForCheck();
  }
}
