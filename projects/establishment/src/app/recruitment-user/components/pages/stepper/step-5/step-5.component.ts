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
  AbstractControl,
} from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, forkJoin, lastValueFrom, of } from 'rxjs';
import { switchMap, tap, catchError, map } from 'rxjs/operators';
import { HttpService, LoaderService, SharedModule } from 'shared';
import { UtilsService } from '../../utils.service';
import { AlertService } from 'shared';
import {
  RecruitmentStateService,
  UserRecruitmentData,
} from '../../recruitment-state.service';
// Interfaces (no changes)
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
  m_rec_score_field_parameter_new_id: number;
  a_rec_adv_post_detail_id: number;
  score_field_parameter_name: string;
  control_type: 'T' | 'TR' | 'DT' | 'DE' | 'A' | 'DY' | 'DP';
  parameter_display_order: number;
  is_mandatory: 'Y' | 'N';
  isDatatype: string;
  isCalculationColumn: 'Y' | 'N';
  isQuery_id: number;
  data_type_size: number;
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
  private userData: UserRecruitmentData | null = null;
  years: number[] = [];
  employment: string[] = [];
  filePaths: Map<string, string> = new Map();
  existingParentDetailId: number | null = null;
  payScales: { band_pay_no: number; Band_Pay_Scale: string }[] = [];
  totalExperience: number = 0;
  dropdownData: Map<number, any[]> = new Map<number, any[]>();
  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private HTTP: HttpService,
    private sanitizer: DomSanitizer,
    private utils: UtilsService,
    private alertService: AlertService,
    private recruitmentState: RecruitmentStateService,
    private loader: LoaderService
  ) {
    this.form = this.fb.group({});
    this.userData = this.recruitmentState.getCurrentUserData();
  }

  ngOnInit(): void {
    this.loader.showLoader();
    this.loadFormData().subscribe(() => {
      this.getParameterValuesAndPatch();
    });
  } // No changes to buildFormControls, getKeyForSaved, getUniqueKey
  private getDropdownData(queryId: number): Observable<any[]> {
    if (!queryId || queryId === 0) {
      return of([]); // Return an empty observable if no valid query ID
    }
    return this.HTTP.getParam(
      '/master/get/getDataByQueryId',
      { query_id: queryId },
      'recruitement'
    ).pipe(
      map((res: any) => res?.body?.data || []),
      catchError(() => of([])) // On error, return an empty array to prevent breaking the chain
    );
  }
  private buildFormControls(): void {
    this.form.addControl(
      'heading',
      this.fb.control(this.heading?.score_field_title_name ?? '')
    );
    this.form.addControl('firstMissedMandatory', this.fb.control(''));
    this.form.addControl(
      'mandatorySubheadingsSelected',
      this.fb.control(true, Validators.requiredTrue)
    );

    this.subheadings.forEach((subheading, index) => {
      const key = this.getUniqueKey(subheading, index);
      const formArray = this.fb.array([
        this.createQualificationGroup(subheading),
      ]);
      this.form.addControl(key, formArray);
    });
  }

  getUniqueKey(sub: Subheading, index: number): string {
    return `${sub.m_rec_score_field_id}_${sub.a_rec_adv_post_detail_id}_${index}`;
  }

  private getParameterValuesAndPatch(): void {
    if (!this.heading) return;

    const registration_no = this.userData?.registration_no;
    const a_rec_app_main_id = this.userData?.a_rec_app_main_id;

    const childrenRequest = this.HTTP.getParam(
      '/candidate/get/getParameterValues',
      {
        registration_no,
        a_rec_app_main_id,
        score_field_parent_id: this.heading.m_rec_score_field_id,
        Application_Step_Flag_CES: 'C', 
      },
      'recruitement'
    );

    const parentRequest = this.HTTP.getParam(
      '/candidate/get/getParameterValues',
      {
        registration_no,
        a_rec_app_main_id,
        m_rec_score_field_id: this.heading.m_rec_score_field_id,
        score_field_parent_id: 0,
      },
      'recruitement'
    );

    forkJoin({ children: childrenRequest, parent: parentRequest }).subscribe({
      next: ({ children, parent }) => {
        const savedData = children.body?.data || [];
        const savedParent = parent.body?.data || [];
        console.log(
          'saved data for the children: ',
          JSON.stringify(savedData, null, 2)
        );
        console.log(
          'saved data for the parent: ',
          JSON.stringify(savedParent, null, 2)
        );
        if (savedParent.length > 0) {
          this.existingParentDetailId =
            savedParent[0].a_rec_app_score_field_detail_id;
        }

        if (savedData.length === 0) {
          this.checkMandatorySubheadingsAndParameters();
          this.cdr.markForCheck();
          return;
        }

        const paramIdToNameMap = new Map<number, string>();
        this.parameters.forEach((p) => {
          paramIdToNameMap.set(
            p.m_rec_score_field_parameter_new_id,
            p.score_field_parameter_name
          );
        });

        const recordsBySubheading = new Map<number, any[]>();
        savedData.forEach((item: any) => {
          const subId = item.m_rec_score_field_id;
          if (!recordsBySubheading.has(subId)) {
            recordsBySubheading.set(subId, []);
          }
          recordsBySubheading.get(subId)!.push(item);
        });

        this.subheadings.forEach((sub, i) => {
          const key = this.getUniqueKey(sub, i);
          const formArray = this.form.get(key) as FormArray;
          formArray.clear(); // Clear any initial empty rows.

          const recordsForThisSubheading =
            recordsBySubheading.get(sub.m_rec_score_field_id) || [];

          // Now, group the relevant records by their actual row index.
          const recordsByRow = new Map<number, any[]>();
          recordsForThisSubheading.forEach((item) => {
            const rowIndex = item.parameter_row_index;
            if (!recordsByRow.has(rowIndex)) {
              recordsByRow.set(rowIndex, []);
            }
            recordsByRow.get(rowIndex)!.push(item);
          });

          // If no records were found for this subheading, add one empty row.
          if (recordsByRow.size === 0) {
            formArray.push(this.createQualificationGroup(sub));
          } else {
            // Create a form group for each row found in the data.
            recordsByRow.forEach((rowItems, rowIndex) => {
              const newGroup = this.createQualificationGroup(sub);
              const firstItemOfRow = rowItems[0];

              newGroup
                .get('a_rec_app_score_field_detail_id')
                ?.setValue(firstItemOfRow.a_rec_app_score_field_detail_id, {
                  emitEvent: false,
                });

              rowItems.forEach((item) => {
                const fieldName = paramIdToNameMap.get(
                  item.m_rec_score_field_parameter_new_id
                );
                if (fieldName && newGroup.get(fieldName)) {
                  if (
                    item.parameter_value?.includes('.pdf') ||
                    item.parameter_value?.includes('.jp')
                  ) {
                    const fileKey = `${key}_${item.m_rec_score_field_parameter_new_id}_${formArray.length}`;
                    this.filePaths.set(fileKey, item.parameter_value);
                    newGroup
                      .get(fieldName)
                      ?.setValue(null, { emitEvent: false });
                  } else {
                    newGroup
                      .get(fieldName)
                      ?.setValue(item.parameter_value, { emitEvent: false });
                  }
                }
                const paramIdControlName = `param_${item.m_rec_score_field_parameter_new_id}_id`;
                if (newGroup.get(paramIdControlName)) {
                  newGroup
                    .get(paramIdControlName)
                    ?.setValue(item.a_rec_app_score_field_parameter_detail_id, {
                      emitEvent: false,
                    });
                }
              });
              formArray.push(newGroup);
            });
          }
        });

        this.checkMandatorySubheadingsAndParameters();
        this.updateTotalExperience();
        this.cdr.markForCheck();
        this.loader.hideLoader();
      },
      error: (err) => {
        this.errorMessage = 'Failed to load saved data: ' + err.message;
        this.alertService.alert(true, this.errorMessage);
        this.cdr.markForCheck();
        this.loader.hideLoader();
      },
    });
  } // No changes to addQualification, removeQualification, createQualificationGroup, recalculateExperience
  private updateTotalExperience(): void {
    let total = 0;
    this.subheadings.forEach((sub, subIndex) => {
      const key = this.getUniqueKey(sub, subIndex);
      const formArray = this.form.get(key) as FormArray;

      if (formArray) {
        // Use getRawValue() to include values from disabled controls if any
        formArray.getRawValue().forEach((formValues: any) => {
          // Only include the row in the calculation if it's NOT deleted
          if (!formValues.is_deleted) {
            total += formValues.calculated_experience || 0;
          }
        });
      }
    });

    this.totalExperience = parseFloat(total.toFixed(2)); // Round to 2 decimal places
    this.cdr.markForCheck();
  }
  addQualification(subheading: Subheading, index: number): void {
    const key = this.getUniqueKey(subheading, index);
    const qualificationsArray = this.getQualifications(key);
    qualificationsArray.push(this.createQualificationGroup(subheading));
    this.checkMandatorySubheadingsAndParameters();
    this.updateTotalExperience();
    this.cdr.markForCheck();
  }

  removeQualification(group: AbstractControl): void {
    this.alertService
      .confirmAlert(
        'Confirm Deletion',
        'Are you sure you want to remove this entry? This action will be saved when you submit the form.',
        'warning'
      )
      .then((result: any) => {
        // Only proceed if the user clicks "Yes"
        if (result.isConfirmed) {
          if (group) {
            // This performs the "soft delete" by setting the flag
            group.get('is_deleted')?.setValue(true);
          }

          // Recalculate form validity and totals
          this.checkMandatorySubheadingsAndParameters();
          this.updateTotalExperience();
          this.cdr.markForCheck();
        }
        // If the user clicks "No" or cancels, do nothing.
      });
  }
  public allowAlphabetsOnly(event: KeyboardEvent, param: Parameter): void {
    // Only apply this logic if the control is a text input and datatype is 'text'
    if (param.control_type === 'T' && param.isDatatype === 'text') {
      const allowedKeys = [
        'Backspace',
        'Delete',
        'Tab',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
      ];

      // Allow essential editing keys
      if (allowedKeys.includes(event.key)) {
        return;
      }

      // Use the stricter regex to test if the key is allowed (no periods)
      const isAllowedChar = /^[a-zA-Z ()]*$/.test(event.key);

      // If the key is not an allowed character, block the input
      if (!isAllowedChar) {
        event.preventDefault();
      }
    }
  }
  private createQualificationGroup(sub: Subheading): FormGroup {
    const group = this.fb.group({});
    const params = this.getParameters(
      sub.m_rec_score_field_id,
      sub.a_rec_adv_post_detail_id
    );
    group.addControl('a_rec_app_score_field_detail_id', this.fb.control(''));
    group.addControl('calculated_experience', this.fb.control(0));
    group.addControl('is_deleted', this.fb.control(false));

    params.forEach((param) => {
      const validators: ValidatorFn[] =
        param.is_mandatory === 'Y' && param.control_type !== 'A'
          ? [Validators.required]
          : [];

      // ✅ ADD THIS CONDITION for text pattern validation
      if (param.control_type === 'T' && param.isDatatype === 'text') {
        validators.push(Validators.pattern('^[a-zA-Z ()]*$'));
      }

      const isDropdownOrFile = ['A', 'DE', 'DY', 'DP', 'DC'].includes(
        // Added 'DC' for completeness
        param.control_type
      );
      group.addControl(
        param.score_field_parameter_name,
        this.fb.control(isDropdownOrFile ? null : '', validators)
      );
      group.addControl(
        `param_${param.m_rec_score_field_parameter_new_id}_id`,
        this.fb.control('')
      );
    });

    group.valueChanges.subscribe(() => {
      this.checkMandatorySubheadingsAndParameters();
      this.recalculateExperience(group, sub);
    });
    return group;
  }
  private recalculateExperience(
    group: FormGroup,
    subheading: Subheading
  ): void {
    // Dynamically get the name of the 'To Date' field for the touched check
    const toDateName = this.parameters
      .filter((p) => p.isCalculationColumn === 'Y')
      .sort(
        (a, b) => a.parameter_display_order - b.parameter_display_order
      )[1]?.score_field_parameter_name;

    if (group.hasError('dateRangeInvalid')) {
      // ✅ ADDED: Show an alert if the error is present and the user touched the end date field.
      if (toDateName && group.get(toDateName)?.touched) {
        this.alertService.alert(
          true,
          "'Period To' date cannot be earlier than the 'Period From' date."
        );
      }

      // Set experience to 0 and update the total
      group.get('calculated_experience')?.setValue(0, { emitEvent: false });
      this.updateTotalExperience();
      return;
    }
    // Find the parameters that are marked for calculation for the current subheading
    const calculationParams = this.parameters.filter(
      (p) => p.isCalculationColumn === 'Y'
    );

    // We expect exactly two date columns for a duration calculation
    if (calculationParams.length < 2) {
      // If not, we can't calculate, so do nothing.
      return;
    }

    // Sort by display order to ensure we get "from" then "to"
    calculationParams.sort(
      (a, b) => a.parameter_display_order - b.parameter_display_order
    );

    // Get the names of the "from" and "to" date fields dynamically
    const fromDateFieldName = calculationParams[0].score_field_parameter_name;
    const toDateFieldName = calculationParams[1].score_field_parameter_name;

    // Get the date values from the form group using the dynamic field names
    const fromDate = group.get(fromDateFieldName)?.value;
    const toDate = group.get(toDateFieldName)?.value;

    if (fromDate && toDate) {
      const experience = this.utils.calculateDuration(
        new Date(fromDate),
        new Date(toDate),
        subheading.score_field_field_weightage,
        'decimalYears'
      );

      group
        .get('calculated_experience')
        ?.setValue(experience, { emitEvent: false }); // Prevent infinite loop of valueChanges

      // After a single row's experience is updated, we must update the grand total.
      this.updateTotalExperience();
    }
  }

  private loadFormData(): Observable<void> {
    const a_rec_adv_main_id = this.userData?.a_rec_adv_main_id;
    const m_rec_score_field_id = 32;

    const headingRequest = this.HTTP.getParam(
      '/master/get/getSubHeadingParameterByParentScoreField',
      { a_rec_adv_main_id, m_rec_score_field_id, m_rec_score_field: 'N' },
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
            score_field_parent_id: this.heading.m_rec_score_field_id,
            a_rec_adv_post_detail_id: this.heading.a_rec_adv_post_detail_id,
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
            m_rec_score_field_id,
            score_field_parent_code: 0,
            m_parameter_master: 'Y',
          },
          'recruitement'
        ) as Observable<HttpResponse<ApiResponse<Parameter>>>;
      }),
      switchMap((parameterRes: HttpResponse<ApiResponse<Parameter>>) => {
        this.parameters = parameterRes.body?.data || [];

        const uniqueQueryIds = [
          ...new Set(
            this.parameters
              .map((p) => p.isQuery_id)
              // ✅ FIX: Ensure the predicate always returns a strict boolean
              .filter((id): id is number => !!(id && id > 0))
          ),
        ];

        if (uniqueQueryIds.length === 0) {
          return of([] as { queryId: number; data: any[] }[]);
        }

        const dropdownRequests = uniqueQueryIds.map((queryId) =>
          this.getDropdownData(queryId).pipe(map((data) => ({ queryId, data })))
        );

        return forkJoin(dropdownRequests);
      }),
      tap((dropdownResults: { queryId: number; data: any[] }[]) => {
        if (dropdownResults && dropdownResults.length > 0) {
          dropdownResults.forEach((result) => {
            this.dropdownData.set(result.queryId, result.data);
          });
        }

        this.buildFormControls();
        this.loading = false;
        this.cdr.markForCheck();
      }),
      map(() => {}),
      catchError((error) => {
        this.errorMessage = 'Error loading form: ' + error.message;
        this.loading = false;
        this.loader.hideLoader();
        this.cdr.markForCheck();
        throw error;
      })
    );
  }

  getParameters(subheading_id: number, post_detail_id: number): Parameter[] {
    return this.parameters.sort(
      (a, b) => a.parameter_display_order - b.parameter_display_order
    );
  } // No changes to checkMandatorySubheadingsAndParameters or getQualifications

  // In step-5.component.ts
  private checkMandatorySubheadingsAndParameters(): void {
    let firstMissedParameter = '';
    let firstMissedSubheading = '';

    subheadingLoop: for (const sub of this.subheadings) {
      const key = this.getUniqueKey(sub, this.subheadings.indexOf(sub));
      const formArray = this.form.get(key) as FormArray;
      if (!formArray) continue;

      for (const [groupIndex, group] of formArray.controls.entries()) {
        const formGroup = group as FormGroup;
        if (formGroup.get('is_deleted')?.value) {
          continue;
        }
        // Skip empty "add new" rows unless it's the only row
        const hasAnyValue = Object.values(formGroup.value).some((v) => !!v);
        if (!hasAnyValue && formArray.length > 1) continue;

        const params = this.getParameters(
          sub.m_rec_score_field_id,
          sub.a_rec_adv_post_detail_id
        );

        for (const param of params) {
          if (param.is_mandatory === 'Y') {
            const control = formGroup.get(param.score_field_parameter_name);
            let isControlValid = control?.value; // Check for text, date, dropdown values etc.

            // --- THIS IS THE KEY LOGIC FOR FILE VALIDATION ---
            if (param.control_type === 'A') {
              const existingFilePath = this.getFilePath(
                key,
                param.m_rec_score_field_parameter_new_id,
                groupIndex // Use the actual index in the loop
              );
              // A file is valid if a NEW file is selected (control.value) OR an old one already exists (existingFilePath)
              isControlValid = control?.value || existingFilePath;
            }
            // --- END OF KEY LOGIC ---

            if (!isControlValid) {
              firstMissedParameter = param.score_field_parameter_name;
              firstMissedSubheading = sub.score_field_title_name;
              break subheadingLoop; // Exit all loops once the first error is found
            }
          }
        }
      }
    }

    const allMandatoryValid = !firstMissedParameter;
    this.form
      .get('mandatorySubheadingsSelected')
      ?.setValue(allMandatoryValid, { emitEvent: false });
    this.form
      .get('firstMissedMandatory')
      ?.setValue(
        firstMissedParameter
          ? `${firstMissedParameter} under ${firstMissedSubheading} is missing`
          : '',
        { emitEvent: false }
      );
  }
  getQualifications(key: string): FormArray {
    return this.form.get(key) as FormArray;
  } // No changes to file handling
  getFilePath(key: string, paramId: number, index: number): string | null {
    return this.filePaths.get(`${key}_${paramId}_${index}`) || null;
  }
  sanitizeFileUrl(filePath: string): SafeUrl {
    const fileName = filePath.split('\\').pop()?.split('/').pop() || '';
    const url = `http://192.168.1.57:3500/recruitment/24000001/${fileName}`;
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
      let file: File | null = input.files[0]; // Use 'let' to allow modification
      const formArray = this.form.get(arrayName) as FormArray;
      const control = formArray.at(index).get(fieldName);

      // --- START: INSERTED VALIDATION LOGIC ---
      // Find the parameter configuration to get the size limit
      const param = this.parameters.find(
        (p) => p.score_field_parameter_name === fieldName
      );

      // Check file size if the parameter and file exist
      if (param && param.data_type_size && file) {
        const maxSizeKB = param.data_type_size;
        const maxSizeInBytes = maxSizeKB * 1024;

        if (file.size > maxSizeInBytes) {
          this.alertService.alert(
            true,
            `File size for "${fieldName}" cannot exceed ${maxSizeKB}KB. Your file is ~${Math.round(
              file.size / 1024
            )}KB.`
          );
          // If invalid, clear the input and nullify the file variable
          input.value = '';
          file = null;
        }
      }
      // --- END: INSERTED VALIDATION LOGIC ---

      // --- YOUR ORIGINAL LOGIC (UNCHANGED) ---
      // This now sets either the valid file or null to the form control
      control?.setValue(file, { emitEvent: false });

      if (param) {
        const fileKey = `${arrayName}_${param.m_rec_score_field_parameter_new_id}_${index}`;
        this.filePaths.delete(fileKey);
      }
      this.checkMandatorySubheadingsAndParameters();
      this.cdr.markForCheck();
    }
  }

  /**
   * ✅ NEW
   * Generates a unique, backend-friendly file path and name.
   */
  private generateFilePath(
    registrationNo: number,
    file: File,
    headingId: number,
    subHeadingId: number,
    parameterId: number,
    rowIndex: number
  ): { fullPath: string; fileName: string } {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${registrationNo}_${headingId}_${subHeadingId}_${parameterId}_${rowIndex}_${sanitizedName}`;
    const fullPath = `recruitment/${registrationNo}/${fileName}`;
    return { fullPath, fileName };
  }
  /**
   * ✅ REBUILT
   * Implements the full save/update logic.
   */

  async submitForm(): Promise<void> {
    this.form.markAllAsTouched();
    this.checkMandatorySubheadingsAndParameters();

    if (!this.form.get('mandatorySubheadingsSelected')?.value) {
      const firstMissed = this.form.get('firstMissedMandatory')?.value;
      this.alertService.alert(
        true,
        `${firstMissed}. Please provide the required information.`
      );
      return Promise.reject(new Error('Mandatory field missing.')); // REJECT here
    }
    if (this.form.invalid) {
      this.alertService.alert(
        true,
        'Please fill all required fields correctly.'
      );
      return;
    }

    // --- Configuration ---
    const registrationNo = this.userData?.registration_no;
    const a_rec_app_main_id = this.userData?.a_rec_app_main_id;
    if (!registrationNo || !a_rec_app_main_id) {
      this.alertService.alert(
        true,
        'Cannot submit, user identification is missing.'
      );
      return Promise.reject(new Error('User identification is missing.'));
    }
    const formData = new FormData();

    // --- Payload Preparation ---
    const allDetails: any[] = [];
    const allParameters: any[] = [];
    let totalCalculatedExperience = 0;

    // STEP 1: Loop through all subheadings and their rows to gather data
    this.subheadings.forEach((sub, subIndex) => {
      const key = this.getUniqueKey(sub, subIndex);
      const formArray = this.form.get(key) as FormArray;

      formArray.getRawValue().forEach((formValues: any, rowIndex: number) => {
        const existingDetailId = formValues.a_rec_app_score_field_detail_id;
        const isDeleted = formValues.is_deleted;
        const hasAnyValue = Object.values(formValues).some(
          (v) => v !== null && v !== '' && v !== false
        );

        if (!hasAnyValue && !existingDetailId) {
          return;
        }

        // Recalculate experience for THIS row to ensure the value is always fresh
        let currentExperience = 0;
        const fromDate = formValues['Period From'];
        const toDate = formValues['Period To'];
        if (fromDate && toDate) {
          currentExperience = this.utils.calculateDuration(
            new Date(fromDate),
            new Date(toDate),
            sub.score_field_field_weightage || 1,
            'decimalYears'
          );
        }

        // Only add to the grand total if the record is NOT marked for deletion
        if (!isDeleted) {
          totalCalculatedExperience += currentExperience;
        }

        const detail = {
          a_rec_app_score_field_detail_id: existingDetailId || undefined,
          registration_no: registrationNo,
          a_rec_app_main_id: a_rec_app_main_id,
          a_rec_adv_post_detail_id: sub.a_rec_adv_post_detail_id,
          score_field_parent_id: sub.score_field_parent_id,
          m_rec_score_field_id: sub.m_rec_score_field_id,
          m_rec_score_field_method_id: 2,
          score_field_value: currentExperience,
          score_field_actual_value: currentExperience,
          score_field_calculated_value: currentExperience,
          field_marks: sub.score_field_field_marks || 0,
          field_weightage: sub.score_field_field_weightage || 0,
          verify_remark: 'Not Verified',
          action_type: existingDetailId ? 'U' : 'C',
          action_date: new Date().toISOString(),
          action_ip_address: '127.0.0.1',
          action_remark: 'data inserted/updated',
          action_by: 1,
          score_field_row_index: rowIndex + 1,
          delete_flag: isDeleted ? 'Y' : 'N',
        };
        allDetails.push(detail);

        // Process parameters for this row
        const formGroup = formArray.at(rowIndex);
        this.getParameters(
          sub.m_rec_score_field_id,
          sub.a_rec_adv_post_detail_id
        ).forEach((param) => {
          const paramValue = formValues[param.score_field_parameter_name];
          const isNewFile = paramValue instanceof File;
          const existingParamId = formGroup.get(
            `param_${param.m_rec_score_field_parameter_new_id}_id`
          )?.value;
          const existingFilePath =
            param.control_type === 'A'
              ? this.getFilePath(
                  key,
                  param.m_rec_score_field_parameter_new_id,
                  rowIndex
                )
              : null;

          let finalParameterValue: string | null = null;

          if (isNewFile) {
            const { fullPath } = this.generateFilePath(
              registrationNo,
              paramValue,
              sub.score_field_parent_id,
              sub.m_rec_score_field_id,
              param.m_rec_score_field_parameter_new_id,
              rowIndex + 1
            );
            finalParameterValue = fullPath;
            const fileControlName = `${registrationNo}_${
              sub.score_field_parent_id
            }_${sub.m_rec_score_field_id}_${
              param.m_rec_score_field_parameter_new_id
            }_${param.parameter_display_order || 0}_${rowIndex + 1}`;
            formData.append(fileControlName, paramValue, paramValue.name);
          } else if (param.control_type === 'A' && existingFilePath) {
            finalParameterValue = existingFilePath;
          } else if (param.control_type !== 'A' && paramValue != null) {
            finalParameterValue = String(paramValue);
          }

          if (finalParameterValue !== null) {
            const parameter = {
              a_rec_app_score_field_parameter_detail_id:
                existingParamId || undefined,

              // ✅ THIS IS THE KEY CHANGE: Add the parent's ID to the parameter payload.
              a_rec_app_score_field_detail_id: existingDetailId || undefined,

              registration_no: registrationNo,
              score_field_parent_id: sub.score_field_parent_id,
              m_rec_score_field_id: sub.m_rec_score_field_id,
              m_rec_score_field_parameter_new_id:
                param.m_rec_score_field_parameter_new_id,
              parameter_value: finalParameterValue,
              parameter_row_index: rowIndex + 1,
              parameter_display_no: param.parameter_display_order,
              verify_remark: 'Not Verified',
              active_status: 'Y',
              action_type: existingParamId ? 'U' : 'C',
              action_date: new Date().toISOString(),
              action_remark: 'parameter inserted/updated',
              action_by: 1,
              delete_flag: isDeleted ? 'Y' : 'N',
            };
            allParameters.push(parameter);
          }
        });
      });
    });

    // STEP 2: Create Parent Record
    if (!this.heading) {
      this.alertService.alert(
        true,
        'Cannot submit, heading information is missing.',
        5000
      );
      return;
    }
    const parentRecord = {
      ...(this.existingParentDetailId && {
        a_rec_app_score_field_detail_id: this.existingParentDetailId,
      }),
      registration_no: registrationNo,
      a_rec_app_main_id: a_rec_app_main_id,
      a_rec_adv_post_detail_id: this.heading.a_rec_adv_post_detail_id,
      score_field_parent_id: 0,
      m_rec_score_field_id: this.heading.m_rec_score_field_id,
      m_rec_score_field_method_id: 2,
      score_field_value: this.heading.score_field_field_marks,
      score_field_actual_value: totalCalculatedExperience,
      score_field_calculated_value: Math.min(
        totalCalculatedExperience,
        this.heading.score_field_field_marks
      ),
      field_marks: this.heading?.score_field_field_marks,
      field_weightage: this.heading?.score_field_field_weightage,
      verify_remark: 'Not Verified',
      action_type: 'U',
      action_date: new Date().toISOString(),
      action_remark: 'parent data updated from recruitment form',
      action_by: 1,
      delete_flag: 'N',
    };

    // STEP 3: Append all data to FormData
    formData.append('parentScore', JSON.stringify(parentRecord));
    formData.append('registration_no', registrationNo.toString());
    formData.append('scoreFieldDetailList', JSON.stringify(allDetails));
    formData.append('scoreFieldParameterList', JSON.stringify(allParameters));
    this.loader.showLoader();
    // STEP 4: Make the SINGLE API call
    try {
      // Convert the Observable to a Promise to use await
      const res: HttpResponse<any> = await lastValueFrom(
        this.HTTP.postForm(
          '/candidate/postFile/saveOrUpdateCandidateScoreCard',
          formData,
          'recruitement'
        )
      );

      // ✅ 1. CHECK FOR BACKEND-SPECIFIC ERRORS FIRST
      if (res?.body?.error) {
        this.alertService.alert(
          true,
          res.body.error.message || 'An error occurred on the server.'
        );
        this.loader.hideLoader();
        throw new Error(res.body.error.message); // This will reject the promise
      }
      this.loader.hideLoader();
      // ✅ 2. AWAIT THE SUCCESS ALERT. The function will pause here.
      await this.alertService.alert(false, 'Data saved successfully!');

      // ✅ 3. This code runs ONLY AFTER the user clicks "OK" on the alert.
      this.getParameterValuesAndPatch();
      this.cdr.markForCheck();
      // The promise resolves automatically here, allowing the stepper to proceed.
    } catch (err: any) {
      // This block catches both network errors and the backend error we threw above.
      const errorMessage =
        err.error?.message ||
        err.message ||
        'An unknown error occurred while saving.';
      this.alertService.alert(true, `Error: ${errorMessage}`);
      this.loader.hideLoader();
      this.cdr.markForCheck();

      // Re-throw the error to ensure the promise is rejected.
      throw err;
    }

    this.emitFormData();
  } // ❌ REMOVED: The old saveRecords method is no longer needed.

  private emitFormData(): void {
    // ... (This method remains unchanged)
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
    console.log(
      '📤 Step5 form emitting data:',
      JSON.stringify(emitData, null, 2)
    );
    this.formData.emit(emitData);
    this.cdr.markForCheck();
  }
}
