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
import { Observable, forkJoin, of } from 'rxjs';
import { switchMap, tap, catchError, map } from 'rxjs/operators';
import { HttpService, SharedModule } from 'shared';
import { Output, EventEmitter } from '@angular/core';
import { UtilsService } from '../../utils.service';
import { AlertService } from 'shared';
import {
  RecruitmentStateService,
  UserRecruitmentData,
} from '../../recruitment-state.service';
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

  filePaths: Map<string, string> = new Map();
  dropdownData: Map<number, any[]> = new Map<number, any[]>();
  existingDetailIds: Map<string, number> = new Map();
  existingParameterIds: Map<string, number> = new Map();
  existingParentDetailId: number | null = null;
  private userData: UserRecruitmentData | null = null;
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private HTTP: HttpService,
    private sanitizer: DomSanitizer,
    private utils: UtilsService,
    private alertService: AlertService,
    private recruitmentState: RecruitmentStateService
  ) {
    this.userData = this.recruitmentState.getCurrentUserData();
    this.form = this.fb.group({});
  }

  ngOnInit(): void {
    this.loadFormData().subscribe({
      next: () => {
        this.getParameterValuesAndPatch();
      },
      error: (err) => {
        this.errorMessage = 'Failed to load form data: ' + err.message;
        this.alertService.alert(true, this.errorMessage);
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }
  private getDropdownData(queryId: number): Observable<any[]> {
    if (!queryId || queryId === 0) {
      return of([]); // Return empty if no valid query ID
    }
    return this.HTTP.getParam(
      '/master/get/getDataByQueryId',
      { query_id: queryId },
      'recruitement'
    ).pipe(
      map((res: any) => res?.body?.data || []),
      catchError(() => of([])) // On error, return an empty array
    );
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
    const registrationNo = this.userData?.registration_no;
    const url = `http://192.168.1.57:3500/recruitment/${registrationNo}/${fileName}`;
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  getFileName(filePath: string): string {
    return filePath.split('/').pop() || 'Unknown File';
  }

  // In step-2.component.ts

  onFileChange(
    event: Event,
    index: number,
    arrayName: string,
    fieldName: string
  ) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      let file: File | null = input.files[0]; // Use 'let' to allow modification
      const formArray = this.form.get(arrayName) as FormArray;
      const group = formArray.at(index) as FormGroup;

      // --- START: INSERTED VALIDATION LOGIC ---
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
          // If invalid, clear the file from the input and nullify the variable
          input.value = '';
          file = null;
        }
      }
      // --- END: INSERTED VALIDATION LOGIC ---

      // --- YOUR ORIGINAL LOGIC (UNCHANGED) ---
      // This now sets either the valid file or null to the form control
      group.get(fieldName)?.setValue(file, { emitEvent: false });

      const key = arrayName.replace('qualifications', '');
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

  // in step-2.component.ts

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

      // ✅ --- START: MODIFIED LOGIC ---
      const selectionControl = this.form.get(`is${key}Selected`);
      if (!selectionControl) return; // Safety check

      selectionControl.valueChanges.subscribe((isSelected) => {
        const arrayName = `qualifications${key}`;

        if (!isSelected) {
          // If the user is UNCHECKING the box, show the confirmation alert.
          this.alertService
            .confirmAlert(
              'Confirm Action',
              'Are you sure you want to remove this qualification? All entered data for this section will be cleared.',
              'warning'
            )
            .then((result: any) => {
              if (result.isConfirmed) {
                // User clicked "Yes": Clear the data and update validators.
                this.toggleValidators(arrayName, subheading, false);
                const formArray = this.form.get(arrayName) as FormArray;
                if (formArray && formArray.at(0)) {
                  const group = formArray.at(0) as FormGroup;
                  const detailId = group.get(
                    'a_rec_app_score_field_detail_id'
                  )?.value;
                  group.reset({
                    a_rec_app_score_field_detail_id: detailId || '',
                  });
                }
              } else {
                // User clicked "No": Re-check the box without triggering this event again.
                selectionControl.setValue(true, { emitEvent: false });
              }
              // Update the overall form validity check after the user has made a choice.
              this.checkMandatorySubheadingsAndParameters();
              this.cdr.markForCheck();
            });
        } else {
          // If the user is CHECKING the box, just enable validators.
          this.toggleValidators(arrayName, subheading, true);
          this.checkMandatorySubheadingsAndParameters();
          this.cdr.markForCheck();
        }
      });
      // ✅ --- END: MODIFIED LOGIC ---

      // (The rest of your existing logic in this loop remains the same)
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

      // --- MODIFICATION START ---
      if (param.isCalculationColumn === 'Y') {
        validators.push(
          Validators.min(0),
          Validators.max(100),
          Validators.pattern('^[0-9]+\\.?[0-9]{0,2}$')
        );
      } else if (param.isDatatype === 'number') {
        validators.push(Validators.min(0));
      } else if (param.isDatatype === 'text' && param.control_type === 'T') {
        // ✅ FIX: Only apply to text inputs and allow more characters
        validators.push(Validators.pattern('^[a-zA-Z ()]*$'));
      }
      // --- MODIFICATION END ---

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
  public allowAlphabetsOnly(event: KeyboardEvent, param: Parameter): void {
    // Only apply this restriction if the datatype is 'text'
    if (param.isDatatype === 'text' && param.control_type === 'T') {
      // Added control_type check for safety
      const allowedKeys = [
        'Backspace',
        'Delete',
        'Tab',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
      ];
      if (allowedKeys.includes(event.key)) {
        return;
      }

      // ✅ UPDATED REGEX: To match the new pattern (allows letters, spaces, parentheses)
      const isAllowedChar = /^[a-zA-Z ()]$/.test(event.key);

      if (!isAllowedChar) {
        event.preventDefault();
      }
    }
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

          // --- MODIFICATION START ---
          if (param.isCalculationColumn === 'Y') {
            validators.push(
              Validators.min(0),
              Validators.max(100),
              Validators.pattern('^[0-9]+\\.?[0-9]{0,2}$')
            );
          } else if (param.isDatatype === 'number') {
            validators.push(Validators.min(0));
          } else if (
            param.isDatatype === 'text' &&
            param.control_type === 'T'
          ) {
            // ✅ FIX: Only apply to text inputs and allow more characters
            validators.push(Validators.pattern('^[a-zA-Z ()]*$'));
          }
          // --- MODIFICATION END ---

          ctrl.setValidators(validators);
          ctrl.updateValueAndValidity({ emitEvent: false });
        }
      });
    });
  }

  private loadFormData(): Observable<void> {
    const a_rec_adv_main_id = this.userData?.a_rec_adv_main_id;
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

                  m_parameter_master: 'Y',
                },
                'recruitement'
              )
            );
            return forkJoin(parameterRequests);
          }),
          switchMap((parameterResponses) => {
            this.parameters = parameterResponses.flatMap(
              (p) => p.body?.data || []
            );

            // Find all unique query_ids that need to be fetched
            const dropdownRequests = this.parameters
              .filter((p) => p.isQuery_id && p.isQuery_id > 0)
              .map((p) =>
                this.getDropdownData(p.isQuery_id).pipe(
                  // We map the result to an object containing the id and the data
                  map((data) => ({ queryId: p.isQuery_id, data }))
                )
              );

            if (dropdownRequests.length === 0) {
              return of(null); // No dropdowns to fetch
            }

            return forkJoin(dropdownRequests); // Fetch all dropdown data
          }),
          tap((dropdownResults) => {
            if (dropdownResults) {
              // Populate our dropdownData Map
              dropdownResults.forEach((result) => {
                this.dropdownData.set(result.queryId, result.data);
              });
            }

            // This part is now in the final tap
            this.buildFormControls();
            this.loading = false;
            this.cdr.markForCheck();
          }),
          // ✅ END MODIFICATION HERE

          switchMap(() => {
            return new Observable<void>((observer) => observer.next());
          })
        );
      }),
      catchError((error) => {
        this.errorMessage = 'Error loading form: ' + error.message;
        this.alertService.alert(true, this.errorMessage);
        this.loading = false;
        this.cdr.markForCheck();
        throw error;
      })
    );
  }

  private getParameterValuesAndPatch(): void {
    if (!this.heading) {
      return;
    }

    const registration_no = this.userData?.registration_no;
    const a_rec_app_main_id = this.userData?.a_rec_adv_main_id;

    // Request to get the child records (10th, 12th, etc.)
    const childrenRequest = this.HTTP.getParam(
      '/candidate/get/getParameterValues',
      {
        registration_no,
        a_rec_app_main_id,
        score_field_parent_id: this.heading.m_rec_score_field_id,
      },
      'recruitement'
    );

    // Request to get the parent record itself (Educational Qualification)
    const parentRequest = this.HTTP.getParam(
      '/candidate/get/getParameterValues',
      {
        registration_no,
        a_rec_app_main_id,
        m_rec_score_field_id: this.heading.m_rec_score_field_id,
        score_field_parent_id: 0, // Parent records have a parent_id of 0
      },
      'recruitement'
    );

    forkJoin({ children: childrenRequest, parent: parentRequest }).subscribe({
      next: ({ children, parent }) => {
        const savedChildren = children.body?.data || [];
        const savedParent = parent.body?.data || [];

        // ✅ STORE THE PARENT ID
        if (savedParent.length > 0) {
          this.existingParentDetailId =
            savedParent[0].a_rec_app_score_field_detail_id;
        }

        this.filePaths.clear();
        this.existingDetailIds.clear();
        this.existingParameterIds.clear();

        savedChildren.forEach((item: any) => {
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
              `${key}_${item.m_rec_score_field_parameter_new_id}_${rowIndex}`,
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
        this.alertService.alert(true, this.errorMessage);
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

  submitForm(): Promise<void> {
    this.form.markAllAsTouched();
    this.checkMandatorySubheadingsAndParameters();
    this.emitFormData(); // Emit data so the stepper can check validity

    if (this.form.invalid) {
      const firstMissed = this.form.get('firstMissedMandatory')?.value;
      this.alertService.alert(
        true,
        firstMissed
          ? `${firstMissed} is mandatory. Please provide the required information.`
          : 'Please fill all mandatory fields.'
      );
      // Reject the promise if the form is invalid
      return Promise.reject(new Error('Form is invalid'));
    }

    // Wrap the entire API logic in a new Promise
    return new Promise((resolve, reject) => {
      const registrationNo = this.userData?.registration_no;
      const a_rec_adv_main_id = this.userData?.a_rec_adv_main_id;

      // If there's no registration number, we can't proceed.
      if (!registrationNo || !a_rec_adv_main_id) {
        const errorMsg = 'User identification is missing. Cannot submit.';
        this.alertService.alert(true, errorMsg);
        return reject(new Error(errorMsg));
      }
      const formData = new FormData();

      // --- Payload Preparation ---
      const allDetails: any[] = [];
      const allParameters: any[] = [];
      let parentCalculatedValue = 0;

      // STEP 1: Loop through all subheadings to gather data for C/U/D
      this.subheadings.forEach((sub, index) => {
        const key = this.getUniqueKey(sub, index);
        const isSelected = this.form.get(`is${key}Selected`)?.value;
        const formArray = this.form.get(`qualifications${key}`) as FormArray;
        const group = formArray.at(0) as FormGroup;
        if (!group) return;

        const existingDetailId = group.get(
          'a_rec_app_score_field_detail_id'
        )?.value;

        if (isSelected) {
          // --- LOGIC FOR CREATE / UPDATE ---
          const formValues = group.getRawValue();
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

          const detail = {
            a_rec_app_score_field_detail_id: existingDetailId || undefined,
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
            action_remark: 'data inserted/updated',
            action_by: 1,
            score_field_row_index: 1,
            delete_flag: 'N', // Explicitly set to 'N' for create/update
          };
          allDetails.push(detail);

          this.getParameters(
            sub.m_rec_score_field_id,
            sub.a_rec_adv_post_detail_id
          ).forEach((param) => {
            const paramName = param.score_field_parameter_name;
            const paramValue = formValues[paramName];
            const isFile = paramValue instanceof File;
            const existingParamId = group.get(
              `param_${param.m_rec_score_field_parameter_new_id}_id`
            )?.value;

            if (paramValue) {
              let finalParameterValue = '';
              if (isFile) {
                finalParameterValue = this.generateFilePath(
                  registrationNo,
                  paramValue,
                  sub.score_field_parent_id,
                  sub.m_rec_score_field_id,
                  param.m_rec_score_field_parameter_new_id,
                  1
                );
                const fileControlName = `file_${sub.score_field_parent_id}_${
                  sub.m_rec_score_field_id
                }_${param.m_rec_score_field_parameter_new_id}_${
                  param.parameter_display_order || 0
                }_1`;
                formData.append(fileControlName, paramValue, paramValue.name);
              } else {
                finalParameterValue = String(paramValue ?? '');
              }

              const parameter = {
                a_rec_app_score_field_parameter_detail_id:
                  existingParamId || undefined,
                registration_no: registrationNo,
                a_rec_app_score_field_detail_id: existingDetailId || undefined,
                score_field_parent_id: sub.score_field_parent_id,
                m_rec_score_field_id: sub.m_rec_score_field_id,
                m_rec_score_field_parameter_new_id:
                  param.m_rec_score_field_parameter_new_id,
                parameter_value: finalParameterValue,
                parameter_row_index: 1,
                parameter_display_no: param.parameter_display_order,
                verify_remark: 'Not Verified',
                active_status: 'Y',
                action_type: existingParamId ? 'U' : 'C',
                action_date: new Date().toISOString(),
                action_remark: 'parameter inserted/updated',
                action_by: 1,
                delete_flag: 'N',
              };
              allParameters.push(parameter);
            }
          });
        } else if (!isSelected && existingDetailId) {
          // --- LOGIC FOR DELETION ---
          const detailToDelete = {
            a_rec_app_score_field_detail_id: existingDetailId,
            registration_no: registrationNo,
            a_rec_app_main_id: a_rec_adv_main_id,
            a_rec_adv_post_detail_id: sub.a_rec_adv_post_detail_id,
            score_field_parent_id: sub.score_field_parent_id,
            m_rec_score_field_id: sub.m_rec_score_field_id,
            delete_flag: 'Y',
            action_type: 'U',
          };
          allDetails.push(detailToDelete);
        }
      });

      // STEP 2: Create Parent Record
      const parentRecord = {
        ...(this.existingParentDetailId && {
          a_rec_app_score_field_detail_id: this.existingParentDetailId,
        }),
        registration_no: registrationNo,
        a_rec_app_main_id: a_rec_adv_main_id,
        a_rec_adv_post_detail_id: this.heading?.a_rec_adv_post_detail_id || 252,
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
        action_remark: 'parent data updated from recruitment form',
        action_by: 1,
        delete_flag: 'N',
      };

      // STEP 3: Append all data to FormData
      formData.append('parentScore', JSON.stringify(parentRecord));
      formData.append('registration_no', registrationNo.toString());
      formData.append('scoreFieldDetailList', JSON.stringify(allDetails));
      formData.append('scoreFieldParameterList', JSON.stringify(allParameters));

      // STEP 4: Make the SINGLE API call
      this.HTTP.postForm(
        '/candidate/postFile/saveOrUpdateCandidateScoreCard',
        formData,
        'recruitement'
      ).subscribe({
        // Make the 'next' handler async to allow 'await'
        next: async (res) => {
          // 1. CHECK FOR BACKEND ERRORS FIRST
          if (res?.body?.error) {
            this.alertService.alert(
              true,
              res.body.error.message || 'An error occurred on the server.'
            );
            reject(new Error(res.body.error.message));
            return;
          }

          // 2. AWAIT the success alert. The function will pause here.
          await this.alertService.alert(false, 'Data saved successfully!');

          // 3. This code runs ONLY AFTER the alert is closed.
          this.getParameterValuesAndPatch(); // Refresh data from DB
          this.cdr.markForCheck();
          resolve(); // Resolve the promise to let the stepper proceed.
        },
        error: (err) => {
          this.alertService.alert(true, `Error saving data: ${err.message}`);
          this.cdr.markForCheck();
          reject(err); // Reject the promise on API error
        },
      });
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
