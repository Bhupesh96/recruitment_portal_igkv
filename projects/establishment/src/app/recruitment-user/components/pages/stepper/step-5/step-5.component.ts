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
import { Observable, forkJoin } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { HttpService, SharedModule } from 'shared';

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
    private sanitizer: DomSanitizer
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
        a_rec_app_main_id: 41,
        score_field_parent_id: this.heading?.score_field_parent_id,
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

        // Log grouped records
        console.log(
          'Grouped records:',
          Array.from(recordsByKeyAndDetailId.entries())
        );

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

            // Select parameters based on recordIndex (first set for recordIndex 0, second for recordIndex 1)
            const paramMap: Map<number, any> = new Map();
            paramGroups.forEach((groupItems, uniqueDisplayNo) => {
              // Sort by a_rec_app_score_field_parameter_detail_id to ensure consistent order
              groupItems.sort(
                (a, b) =>
                  a.a_rec_app_score_field_parameter_detail_id -
                  b.a_rec_app_score_field_parameter_detail_id
              );
              // Select the parameter for the current recordIndex
              const selectedItem =
                groupItems[recordIndex] || groupItems[groupItems.length - 1];
              paramMap.set(
                selectedItem.m_rec_score_field_parameter_id,
                selectedItem
              );
            });

            // Log selected parameters
            console.log(
              `Selected parameters for detailId ${detailId} (recordIndex ${recordIndex}):`,
              Array.from(paramMap.entries())
            );

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

            formArray.push(group);
          });

          // Add an empty group if no records exist for the subheading
          if (formArray.length === 0) {
            formArray.push(this.createQualificationGroup(subheading));
          }

          // Log formArray values
          console.log(`FormArray for ${key}:`, formArray.value);
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
    const formValues = group.getRawValue();

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

    return group;
  }

  private getParamValidators(param: Parameter): ValidatorFn[] {
    const validators: ValidatorFn[] = [Validators.required];
    if (param.score_field_parameter_name === 'Passing Year') {
      validators.push(
        Validators.min(1900),
        Validators.max(2025),
        Validators.pattern('^[0-9]{4}$')
      );
    } else if (param.score_field_parameter_name === 'Percentage Obtained') {
      validators.push(
        Validators.min(0),
        Validators.max(100),
        Validators.pattern('^[0-9]+.?[0-9]{0,2}$')
      );
    }
    return validators;
  }

private loadFormData(): Observable<void> {
  const a_rec_adv_main_id = 95;
  const m_rec_score_field_id = 32;

  // First API call - get heading
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

      // Second API call - get parameters
      return this.HTTP.getParam(
        '/master/get/getSubHeadingParameterByParentScoreField',
        {
          a_rec_adv_main_id,
          m_rec_score_field_id: this.heading!.m_rec_score_field_id,
          a_rec_adv_post_detail_id: this.heading!.a_rec_adv_post_detail_id,
        },
        'recruitement'
      ).pipe(
        tap((parameterResponse) => {
          // The response contains parameters
          this.parameters = parameterResponse.body?.data || [];
          
          // Create subheadings array from heading data
          this.subheadings = [{
            a_rec_adv_main_id: a_rec_adv_main_id, // Add the missing property
            m_rec_score_field_id: this.heading!.m_rec_score_field_id,
            a_rec_adv_post_detail_id: this.heading!.a_rec_adv_post_detail_id,
            score_field_parent_id: this.heading!.score_field_parent_id,
            score_field_parent_code: this.heading!.score_field_parent_code,
            m_rec_score_field_method_id: this.heading!.m_rec_score_field_method_id,
            score_field_display_no: this.heading!.score_field_display_no,
            score_field_title_name: this.heading!.score_field_title_name,
            score_field_name_e: this.heading!.score_field_name_e,
            score_field_flag: this.heading!.score_field_flag,
            message: this.heading!.message
          }];

          console.log('🔍 Subheadings:', this.subheadings);
          console.log('🔍 Parameters:', this.parameters);
          
          this.buildFormControls();
          this.loading = false;
          this.cdr.markForCheck();
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

  getParameters(score_field_id: number, post_detail_id: number): Parameter[] {
    return this.parameters
      .filter((p) => p.a_rec_adv_post_detail_id === post_detail_id)
      .sort((a, b) => a.parameter_display_order - b.parameter_display_order);
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
        alert(
          'Invalid file type. Only PDF, JPG, JPEG, or PNG files are allowed.'
        );
        input.value = ''; // Clear the input
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

    this.subheadings.forEach((sub, index) => {
      const key = this.getUniqueKey(sub, index);
      const formArray = this.form.get(`qualifications${key}`) as FormArray;

      formArray.controls.forEach((control, rowIndex) => {
        const group = control as FormGroup;
        const formValues = group.getRawValue();
        const detailId = formValues['a_rec_app_score_field_detail_id'];
        const isExistingRecord = !!detailId;

        const detail = {
          ...(isExistingRecord && {
            a_rec_app_score_field_detail_id: detailId,
          }),
          registration_no: registrationNo,
          a_rec_app_main_id: 41,
          a_rec_adv_post_detail_id: sub.a_rec_adv_post_detail_id,
          score_field_parent_id: sub.score_field_parent_id,
          m_rec_score_field_id: sub.m_rec_score_field_id,
          m_rec_score_field_method_id: 2,
          score_field_value: +formValues['Percentage Obtained'] || 0,
          score_field_actual_value: 0,
          score_field_calculated_value: 0,
          field_marks: 0,
          field_weightage: 0,
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
          const paramKey = `${sub.m_rec_score_field_id}_${sub.a_rec_adv_post_detail_id}_${param.m_rec_score_field_parameter_id}`;
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

    const formData = new FormData();
    formData.append('registration_no', registrationNo.toString());

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
      this.saveNewRecords(registrationNo, formData, newDetails, newParameters);
    }

    // Update existing records if any
    if (existingDetails.length > 0) {
      this.updateExistingRecords(
        registrationNo,
        formData,
        existingDetails,
        existingParameters
      );
    }

    // If no records to save or update
    if (newDetails.length === 0 && existingDetails.length === 0) {
      alert('No data to save or update.');
    }
  }

  private saveNewRecords(
    registrationNo: number,
    formData: FormData,
    details: any[],
    parameters: any[]
  ): void {
    const saveFormData = new FormData();
    saveFormData.append('registration_no', registrationNo.toString());
    saveFormData.append('scoreFieldDetailList', JSON.stringify(details));
    saveFormData.append('scoreFieldParameterList', JSON.stringify(parameters));

    // Copy files with correct control names
    Array.from(formData.entries()).forEach(([key, value]) => {
      if (value instanceof File) {
        saveFormData.append(key, value, key);
      }
    });

    this.HTTP.postForm(
      '/candidate/postFile/saveCandidateScoreCard',
      saveFormData,
      'recruitement'
    ).subscribe({
      next: (res) => {
        console.log('New records saved successfully:', res);

        // Update ID maps with new IDs
        if (res.body?.data) {
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
        }

        this.emitFormData();
        this.getParameterValuesAndPatch();
      },
      error: (err) => {
        console.error('Error saving new records:', err);
        alert('Error saving new records: ' + err.message);
        this.cdr.markForCheck();
      },
    });
  }

  private updateExistingRecords(
    registrationNo: number,
    formData: FormData,
    details: any[],
    parameters: any[]
  ): void {
    const updateFormData = new FormData();
    updateFormData.append('registration_no', registrationNo.toString());
    updateFormData.append('scoreFieldDetailList', JSON.stringify(details));
    updateFormData.append(
      'scoreFieldParameterList',
      JSON.stringify(parameters)
    );

    // Copy files with correct control names
    Array.from(formData.entries()).forEach(([key, value]) => {
      if (value instanceof File) {
        updateFormData.append(key, value, key);
      }
    });

    this.HTTP.postForm(
      '/candidate/postFile/updateCandidateScoreCard',
      updateFormData,
      'recruitement'
    ).subscribe({
      next: (res) => {
        console.log('Existing records updated successfully:', res);
        this.emitFormData();
        this.getParameterValuesAndPatch();
      },
      error: (err) => {
        console.error('Error updating records:', err);
        alert('Error updating records: ' + err.message);
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

    console.log('Emitting formData:', emitData);
    this.formData.emit(emitData);
    this.cdr.markForCheck();
  }
}
