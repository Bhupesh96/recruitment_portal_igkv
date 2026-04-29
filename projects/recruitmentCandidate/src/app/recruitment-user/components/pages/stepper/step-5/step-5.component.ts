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
import { InputTooltipDirective } from '../../../../../directives/input-tooltip.directive';
import { environment } from 'environment';

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
  control_type: 'T' | 'TR' | 'DT' | 'DE' | 'A' | 'DY' | 'DP';
  parameter_display_order: number;
  is_mandatory: 'Y' | 'N';
  isDatatype: string;
  isCalculationColumn: 'Y' | 'N';
  isQuery_id: number;
  data_type_size: number;
  m_parameter_master_id: number;
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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SharedModule,
    InputTooltipDirective,
  ],
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

  ghostDetailsToDelete: any[] = [];

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
  }

  private dateRangeValidator(fromKey: string, toKey: string): ValidatorFn {
    return (group: AbstractControl): { [key: string]: any } | null => {
      const fromControl = group.get(fromKey);
      const toControl = group.get(toKey);

      if (!fromControl || !toControl) return null;

      const fromDate = fromControl.value;
      const toDate = toControl.value;

      if (fromDate && toDate) {
        const start = new Date(fromDate);
        const end = new Date(toDate);

        if (start > end) {
          return { dateRangeInvalid: true };
        }
      }
      return null;
    };
  }

  private getDropdownData(queryId: number): Observable<any[]> {
    if (!queryId || queryId === 0) {
      return of([]);
    }
    return this.HTTP.getParam(
      '/master/get/getDataByQueryId',
      { query_id: queryId },
      'recruitement'
    ).pipe(
      map((res: any) => res?.body?.data || []),
      catchError(() => of([]))
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

  private hasValidData(formValues: any, rowIndex: number, sub: Subheading, key: string): boolean {
    const params = this.getParameters(sub.m_rec_score_field_id, sub.a_rec_adv_post_detail_id);
    return params.some((param) => {
      const val = formValues[param.score_field_parameter_name];
      if (val instanceof File) return true;
      if (typeof val === 'string' && val.trim() !== '') return true;
      if (typeof val === 'number' && !isNaN(val)) return true;
      if (typeof val === 'boolean' && val === true) return true;

      const existingFilePath = param.control_type === 'A'
        ? this.getFilePath(key, param.m_rec_score_field_parameter_new_id, rowIndex)
        : null;
      if (existingFilePath) return true;

      return false;
    });
  }

  private getParameterValuesAndPatch(): void {
    if (!this.heading) return;

    const registration_no = this.userData?.registration_no;
    const a_rec_app_main_id = this.userData?.a_rec_app_main_id;
    this.ghostDetailsToDelete = [];

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
          if (item.parameter_row_index == null || item.m_rec_score_field_parameter_new_id == null) {
            if (item.a_rec_app_score_field_detail_id && !this.ghostDetailsToDelete.some(g => g.a_rec_app_score_field_detail_id === item.a_rec_app_score_field_detail_id)) {
              this.ghostDetailsToDelete.push(item);
            }
            return;
          }

          const subId = item.m_rec_score_field_id;
          if (!recordsBySubheading.has(subId)) {
            recordsBySubheading.set(subId, []);
          }
          recordsBySubheading.get(subId)!.push(item);
        });

        this.subheadings.forEach((sub, i) => {
          const key = this.getUniqueKey(sub, i);
          const formArray = this.form.get(key) as FormArray;
          formArray.clear();

          const recordsForThisSubheading =
            recordsBySubheading.get(sub.m_rec_score_field_id) || [];

          const recordsByRow = new Map<number, any[]>();
          recordsForThisSubheading.forEach((item) => {
            const rowIndex = item.parameter_row_index;
            if (!recordsByRow.has(rowIndex)) {
              recordsByRow.set(rowIndex, []);
            }
            recordsByRow.get(rowIndex)!.push(item);
          });

          if (recordsByRow.size === 0) {
            formArray.push(this.createQualificationGroup(sub));
          } else {
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
  }

  private updateTotalExperience(): void {
    let total = 0;
    this.subheadings.forEach((sub, subIndex) => {
      const key = this.getUniqueKey(sub, subIndex);
      const formArray = this.form.get(key) as FormArray;

      if (formArray) {
        formArray.getRawValue().forEach((formValues: any) => {
          if (!formValues.is_deleted) {
            total += formValues.calculated_experience || 0;
          }
        });
      }
    });

    this.totalExperience = parseFloat(total.toFixed(2));
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
        if (result.isConfirmed) {
          if (group) {
            group.get('is_deleted')?.setValue(true);
            group.disable({ emitEvent: false });
          }
          this.checkMandatorySubheadingsAndParameters();
          this.updateTotalExperience();
          this.cdr.markForCheck();
        }
      });
  }

  public allowAlphabetsOnly(event: KeyboardEvent, param: Parameter): void {
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

      if (allowedKeys.includes(event.key)) {
        return;
      }

      const isAllowedChar = /^[a-zA-Z ()]*$/.test(event.key);

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

    let fromParamName: string | null = null;
    let toParamName: string | null = null;

    params.forEach((param) => {
      const validators: ValidatorFn[] =
        param.is_mandatory === 'Y' && param.control_type !== 'A'
          ? [Validators.required]
          : [];

      if (param.control_type === 'T' && param.isDatatype === 'text') {
        Validators.pattern('^[a-zA-Z ().,:&-]*$');
      }

      if (param.m_parameter_master_id === 26)
        fromParamName = param.score_field_parameter_name;
      if (param.m_parameter_master_id === 27)
        toParamName = param.score_field_parameter_name;

      const isDropdownOrFile = ['A', 'DE', 'DY', 'DP', 'DC'].includes(
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

    if (fromParamName && toParamName) {
      group.addValidators(this.dateRangeValidator(fromParamName, toParamName));
    }

    group.valueChanges.subscribe(() => {
      if (group.hasError('dateRangeInvalid')) {
        if (group.dirty || group.touched) {
          this.alertService.alert(
            true,
            "Period 'To' cannot be earlier than Period 'From'."
          );
          group.patchValue({ calculated_experience: 0 }, { emitEvent: false });
        }
      } else {
        this.checkMandatorySubheadingsAndParameters();
        this.recalculateExperience(group, sub);
      }
    });

    return group;
  }

  private recalculateExperience(
    group: FormGroup,
    subheading: Subheading
  ): void {
    const toDateName = this.parameters
      .filter((p) => p.isCalculationColumn === 'Y')
      .sort(
        (a, b) => a.parameter_display_order - b.parameter_display_order
      )[1]?.score_field_parameter_name;

    if (group.hasError('dateRangeInvalid')) {
      if (toDateName && group.get(toDateName)?.touched) {
        this.alertService.alert(
          true,
          "'Period To' date cannot be earlier than the 'Period From' date."
        );
      }
      group.get('calculated_experience')?.setValue(0, { emitEvent: false });
      this.updateTotalExperience();
      return;
    }

    const calculationParams = this.parameters.filter(
      (p) => p.isCalculationColumn === 'Y'
    );

    if (calculationParams.length < 2) {
      return;
    }

    calculationParams.sort(
      (a, b) => a.parameter_display_order - b.parameter_display_order
    );

    const fromDateFieldName = calculationParams[0].score_field_parameter_name;
    const toDateFieldName = calculationParams[1].score_field_parameter_name;

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
        ?.setValue(experience, { emitEvent: false });

      this.updateTotalExperience();
    }
  }

  private loadFormData(): Observable<void> {
    const a_rec_adv_main_id = this.userData?.a_rec_adv_main_id;
    const m_rec_score_field_id = 32;

    const headingRequest = this.HTTP.getParam(
      '/master/get/getSubHeadingParameterByParentScoreField',
      {
        m_rec_score_field: 'N',
        adv_main_id: a_rec_adv_main_id,
        m_rec_score_field_id,
      },
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
  }

  private checkMandatorySubheadingsAndParameters(): void {
    let firstMissedParameter = '';
    let firstMissedSubheading = '';
    let missingMandatorySection = '';

    subheadingLoop: for (const sub of this.subheadings) {
      const key = this.getUniqueKey(sub, this.subheadings.indexOf(sub));
      const formArray = this.form.get(key) as FormArray;
      if (!formArray) continue;

      let hasAtLeastOneValidRow = false;

      for (const [groupIndex, group] of formArray.controls.entries()) {
        const formGroup = group as FormGroup;

        if (formGroup.get('is_deleted')?.value) {
          continue;
        }

        const rawValues = formGroup.getRawValue();
        const hasUserEnteredData = this.hasValidData(rawValues, groupIndex, sub, key);

        if (hasUserEnteredData) {
          hasAtLeastOneValidRow = true;

          const params = this.getParameters(
            sub.m_rec_score_field_id,
            sub.a_rec_adv_post_detail_id
          );

          for (const param of params) {
            if (param.is_mandatory === 'Y') {
              const control = formGroup.get(param.score_field_parameter_name);
              let isControlValid = control?.value;

              if (param.control_type === 'A') {
                const existingFilePath = this.getFilePath(
                  key,
                  param.m_rec_score_field_parameter_new_id,
                  groupIndex
                );
                isControlValid = control?.value || existingFilePath;
              }

              if (!isControlValid) {
                firstMissedParameter = param.score_field_parameter_name;
                firstMissedSubheading = sub.score_field_title_name;
                break subheadingLoop;
              }
            }
          }
        }
      }

      if (sub.score_field_is_mandatory === '1' && !hasAtLeastOneValidRow) {
        missingMandatorySection = sub.score_field_title_name;
        break subheadingLoop;
      }
    }

    const allMandatoryValid = !firstMissedParameter && !missingMandatorySection;

    this.form
      .get('mandatorySubheadingsSelected')
      ?.setValue(allMandatoryValid, { emitEvent: false });

    let errorMessage = '';
    if (missingMandatorySection) {
      errorMessage = `At least one entry is required for "${missingMandatorySection}"`;
    } else if (firstMissedParameter) {
      errorMessage = `${firstMissedParameter} under ${firstMissedSubheading} is missing`;
    }

    this.form
      .get('firstMissedMandatory')
      ?.setValue(errorMessage, { emitEvent: false });
  }

  getQualifications(key: string): FormArray {
    return this.form.get(key) as FormArray;
  }

  getFilePath(key: string, paramId: number, index: number): string | null {
    return this.filePaths.get(`${key}_${paramId}_${index}`) || null;
  }

  sanitizeFileUrl(filePath: string): SafeUrl {
    const url = `${environment.recruitmentFileBaseUrl}/${filePath}`;
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
      let file: File | null = input.files[0];

      const formArray = this.form.get(arrayName) as FormArray;
      const control = formArray.at(index).get(fieldName);
      if (file.type !== 'application/pdf') {
        this.alertService.alert(true, 'Only PDF files are allowed.');
        input.value = '';
        control?.setValue(null);
        return;
      }

      const param = this.parameters.find(
        (p) => p.score_field_parameter_name === fieldName
      );

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
          input.value = '';
          file = null;
        }
      }

      control?.setValue(file, { emitEvent: false });

      if (param) {
        const fileKey = `${arrayName}_${param.m_rec_score_field_parameter_new_id}_${index}`;
        this.filePaths.delete(fileKey);
      }
      this.checkMandatorySubheadingsAndParameters();
      this.cdr.markForCheck();
    }
  }

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

  async submitForm(): Promise<void> {
    this.form.markAllAsTouched();
    this.checkMandatorySubheadingsAndParameters();

    if (!this.form.get('mandatorySubheadingsSelected')?.value) {
      const firstMissed = this.form.get('firstMissedMandatory')?.value;
      this.alertService.alert(
        true,
        `${firstMissed}. Please provide the required information.`
      );
      return Promise.reject(new Error('Mandatory field missing.'));
    }
    let hasDateError = false;
    this.subheadings.forEach((sub, index) => {
      const key = this.getUniqueKey(sub, index);
      const formArray = this.form.get(key) as FormArray;
      if (
        formArray.controls.some((group) => group.hasError('dateRangeInvalid'))
      ) {
        hasDateError = true;
      }
    });

    if (hasDateError) {
      this.alertService.alert(
        true,
        'Invalid Date Range detected in Experience details. Please correct the dates before saving.'
      );
      return Promise.reject(new Error('Invalid Date Range'));
    }

    // Temporarily disable empty placeholder rows so they don't block `this.form.invalid`
    const disabledGroups: AbstractControl[] = [];
    let hasAnyValidDataAtAll = false; // ✅ Track if the form is completely empty overall

    this.subheadings.forEach((sub, subIndex) => {
      const key = this.getUniqueKey(sub, subIndex);
      const formArray = this.form.get(key) as FormArray;

      formArray.controls.forEach((group, rawIndex) => {
        const formValues = group.getRawValue();
        const existingDetailId = formValues.a_rec_app_score_field_detail_id;
        const isDeleted = formValues.is_deleted;
        const hasUserEnteredData = this.hasValidData(formValues, rawIndex, sub, key);

        if (hasUserEnteredData) {
          hasAnyValidDataAtAll = true; // Found valid data
        }

        if (!hasUserEnteredData && !existingDetailId && !isDeleted) {
          group.disable({ emitEvent: false });
          disabledGroups.push(group);
        }
      });
    });

    // ✅ NEW CHECK: If the entire form is completely blank and we don't even have a parent ID, do not fire the API
    if (!hasAnyValidDataAtAll && !this.existingParentDetailId && this.ghostDetailsToDelete.length === 0) {
      // Just emit empty data to allow the stepper to move forward without saving garbage to DB
      this.emitFormData();
      return;
    }

    if (this.form.invalid) {
      this.alertService.alert(
        true,
        'Please fill all required fields correctly.'
      );
      // Re-enable in case user needs to fix the actual errors
      disabledGroups.forEach(g => g.enable({ emitEvent: false }));
      return;
    }

    const freshUserData = this.recruitmentState.getCurrentUserData();
    this.userData = freshUserData;

    const registrationNo = this.userData?.registration_no;
    const a_rec_app_main_id = this.userData?.a_rec_app_main_id;
    if (!registrationNo || !a_rec_app_main_id) {
      this.alertService.alert(
        true,
        'Cannot submit, user identification is missing.'
      );
      disabledGroups.forEach(g => g.enable({ emitEvent: false }));
      return Promise.reject(new Error('User identification is missing.'));
    }
    const formData = new FormData();

    const allDetails: any[] = [];
    const allParameters: any[] = [];
    let totalCalculatedExperience = 0;

    this.ghostDetailsToDelete.forEach(ghost => {
      allDetails.push({
        a_rec_app_score_field_detail_id: ghost.a_rec_app_score_field_detail_id,
        registration_no: registrationNo,
        a_rec_app_main_id: a_rec_app_main_id,
        a_rec_adv_post_detail_id: ghost.a_rec_adv_post_detail_id,
        score_field_parent_id: ghost.score_field_parent_id,
        m_rec_score_field_id: ghost.m_rec_score_field_id,
        m_rec_score_field_method_id: ghost.m_rec_score_field_method_id,
        score_field_value: 0,
        score_field_actual_value: 0,
        score_field_calculated_value: 0,
        field_marks: ghost.field_marks || 0,
        field_weightage: ghost.field_weightage || 0,
        verify_remark: 'Not Verified',
        action_type: 'U',
        action_date: new Date().toISOString(),
        action_ip_address: '127.0.0.1',
        action_remark: 'Cleaning up ghost record',
        action_by: 1,
        score_field_row_index: 0,
        delete_flag: 'Y'
      });
    });

    this.subheadings.forEach((sub, subIndex) => {
      const key = this.getUniqueKey(sub, subIndex);
      const formArray = this.form.get(key) as FormArray;

      let validRowIndex = 1;

      formArray.getRawValue().forEach((formValues: any, rawIndex: number) => {
        const existingDetailId = formValues.a_rec_app_score_field_detail_id;
        let isDeleted = formValues.is_deleted;

        const hasUserEnteredData = this.hasValidData(formValues, rawIndex, sub, key);

        if (!hasUserEnteredData && existingDetailId) {
          isDeleted = true;
        }

        if (!hasUserEnteredData && !existingDetailId && !isDeleted) {
          return;
        }

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
          m_rec_score_field_method_id: sub.m_rec_score_field_method_id,
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
          score_field_row_index: validRowIndex,
          delete_flag: isDeleted ? 'Y' : 'N',
        };
        allDetails.push(detail);

        if (!isDeleted || (isDeleted && existingDetailId)) {
          const formGroup = formArray.at(rawIndex);
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
                  rawIndex
                )
                : null;

            let finalParameterValue = '';

            if (isNewFile) {
              const { fullPath } = this.generateFilePath(
                registrationNo,
                paramValue,
                sub.score_field_parent_id,
                sub.m_rec_score_field_id,
                param.m_rec_score_field_parameter_new_id,
                validRowIndex
              );
              finalParameterValue = fullPath;
              const fileControlName = `${registrationNo}_${
                sub.score_field_parent_id
              }_${sub.m_rec_score_field_id}_${
                param.m_rec_score_field_parameter_new_id
              }_${param.parameter_display_order || 0}_${validRowIndex}`;
              formData.append(fileControlName, paramValue, paramValue.name);
            } else if (param.control_type === 'A' && existingFilePath) {
              finalParameterValue = existingFilePath;
            } else if (param.control_type !== 'A' && paramValue != null) {
              finalParameterValue = String(paramValue);
            }

            if (finalParameterValue !== '' || existingParamId) {
              const parameter = {
                a_rec_app_score_field_parameter_detail_id:
                  existingParamId || undefined,
                a_rec_app_score_field_detail_id: existingDetailId || undefined,
                registration_no: registrationNo,
                score_field_parent_id: sub.score_field_parent_id,
                m_rec_score_field_id: sub.m_rec_score_field_id,
                m_rec_score_field_parameter_new_id:
                param.m_rec_score_field_parameter_new_id,
                parameter_value: finalParameterValue || '',
                parameter_row_index: validRowIndex,
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
        }
        validRowIndex++;
      });
    });

    if (!this.heading) {
      this.alertService.alert(
        true,
        'Cannot submit, heading information is missing.',
        5000
      );
      disabledGroups.forEach(g => g.enable({ emitEvent: false }));
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
      m_rec_score_field_method_id: this.heading.m_rec_score_field_method_id,
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

    formData.append('parentScore', JSON.stringify(parentRecord));
    formData.append('registration_no', registrationNo.toString());
    formData.append('scoreFieldDetailList', JSON.stringify(allDetails));
    formData.append('scoreFieldParameterList', JSON.stringify(allParameters));
    this.loader.showLoader();

    try {
      const res: HttpResponse<any> = await lastValueFrom(
        this.HTTP.postForm(
          '/candidate/postFile/saveOrUpdateCandidateScoreCard',
          formData,
          'recruitement'
        )
      );

      if (res?.body?.error) {
        this.alertService.alert(
          true,
          res.body.error.message || 'An error occurred on the server.'
        );
        this.loader.hideLoader();
        disabledGroups.forEach(g => g.enable({ emitEvent: false }));
        throw new Error(res.body.error.message);
      }
      this.loader.hideLoader();
      disabledGroups.forEach(g => g.enable({ emitEvent: false }));
      await this.alertService.alert(false, 'Data saved successfully!');

      this.getParameterValuesAndPatch();
      this.cdr.markForCheck();
    } catch (err: any) {
      const errorMessage =
        err.error?.message ||
        err.message ||
        'An unknown error occurred while saving.';
      this.alertService.alert(true, `Error: ${errorMessage}`);
      this.loader.hideLoader();
      disabledGroups.forEach(g => g.enable({ emitEvent: false }));
      this.cdr.markForCheck();
      throw err;
    }

    this.emitFormData();
  }

  private emitFormData(): void {
    const processedSubheadingData: { [key: string]: any[] } = {};

    this.subheadings.forEach((sub, index) => {
      const key = this.getUniqueKey(sub, index);
      const formArray = this.form.get(key) as FormArray;

      if (formArray) {
        const rawRows = formArray.getRawValue();

        const activeRows = rawRows.filter((row: any, rowIndex: number) => {
          if (row.is_deleted) return false;

          const hasUserEnteredData = this.hasValidData(row, rowIndex, sub, key);

          return hasUserEnteredData || row.a_rec_app_score_field_detail_id;
        });

        const processedRows = activeRows.map((row: any, rowIndex: number) => {
          const processedRow: any = { ...row };
          const params = this.getParameters(
            sub.m_rec_score_field_id,
            sub.a_rec_adv_post_detail_id
          );

          params.forEach((param) => {
            const paramName = param.score_field_parameter_name;
            const value = row[paramName];

            if (
              ['DE', 'DY', 'DP', 'DC', 'DT'].includes(param.control_type) &&
              param.isQuery_id
            ) {
              const options = this.dropdownData.get(param.isQuery_id);
              const selectedOption = options?.find(
                (opt) => opt.data_id == value
              );

              if (selectedOption) {
                processedRow[paramName] = selectedOption.data_name;
              } else {
                processedRow[paramName] = value;
              }
            } else if (param.control_type === 'A') {
              if (value instanceof File) {
                processedRow[paramName] = value;
              } else {
                const fileKey = `${key}_${param.m_rec_score_field_parameter_new_id}_${rowIndex}`;
                const existingPath = this.filePaths.get(fileKey);
                processedRow[paramName] = existingPath || null;
              }
            }
          });

          return processedRow;
        });

        processedSubheadingData[key] = processedRows;
      }
    });

    const subheadingsInfo = this.subheadings.reduce((acc, sub, index) => {
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
      ...processedSubheadingData,
      _isValid: this.form.valid,
      heading: this.heading
        ? {
          score_field_title_name: this.heading.score_field_title_name,
          m_rec_score_field_id: this.heading.m_rec_score_field_id,
          a_rec_adv_post_detail_id: this.heading.a_rec_adv_post_detail_id,
        }
        : null,
      subheadings: subheadingsInfo,
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
