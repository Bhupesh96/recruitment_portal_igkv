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
  Validators,
  AbstractControl,
  FormControl,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { HttpService, LoaderService } from 'shared';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { UtilsService } from '../../utils.service';
import { AlertService } from 'shared';
import {
  RecruitmentStateService,
  UserRecruitmentData,
} from '../../recruitment-state.service';
interface DetailFormGroup {
  type: FormControl<string | null>;
  _rowIndex: FormControl<number | null>; // Explicitly define _rowIndex
  [key: string]: AbstractControl; // Allow any type of form control
}
interface SubHeading {
  m_rec_score_field_id: number;
  score_field_name_e: string;
  score_field_is_mandatory: string;
  a_rec_adv_post_detail_id: number;
  score_field_field_marks: number;
  score_field_field_weightage: number;
  score_field_parent_code?: number | null;
  score_field_title_name?: string;
  score_field_flag?: string | null;
  message?: string | null;
  m_rec_score_field_method_id?: number;
  score_field_validation_marks?: number;
  score_field_display_no?: number;
  score_field_is_attachment_required?: string;
  score_field_no_of_rows?: number;
  items: {
    m_rec_score_field_id: number;
    score_field_name_e: string;
    normalizedKey: string;
    is_mandatory: string; // Now required, as API provides score_field_is_mandatory
    score_field_field_marks: number;
    score_field_field_weightage: number;
    score_field_parent_code?: number;
    score_field_title_name?: string;
    score_field_flag?: string | null;
    message?: string | null;
    m_rec_score_field_method_id?: number;
    score_field_validation_marks?: number;
    score_field_display_no?: number;
    score_field_is_attachment_required?: string;
    score_field_no_of_rows?: number;
  }[];
}
interface Parameter {
  m_rec_score_field_id: number;
  m_rec_score_field_parameter_new_id: number;
  score_field_parameter_name: string;
  normalizedKey: string;
  control_type: string;
  is_mandatory: string;
  parameter_display_order: number;
  isQuery_id: number;
  isDatatype: string;
}
@Component({
  selector: 'app-step-6',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, HttpClientModule],
  templateUrl: './step-6.component.html',
  styleUrls: ['./step-6.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step6Component implements OnInit {
  @Output() formData = new EventEmitter<{ [key: string]: any }>();
  form: FormGroup;
  isEditing: boolean = true;
  subHeadings: any[] = [];
  subHeadingRows: { [key: string]: any[] } = {};
  parameters: any[] = [];
  score_field_title_name: string | undefined;
  filePaths: Map<string, string> = new Map();
  existingDetailIds: Map<string, number> = new Map();
  existingParameterIds: Map<string, number> = new Map();
  private isGeneratingTable: boolean = false;
  subHeadingParameters: { [key: string]: any[] } = {};
  subHeadingDetails: { [key: string]: FormGroup<DetailFormGroup>[] } = {};
  heading: any;
  existingParentDetailId: number | null = null;
  dropdownData: Map<number, any[]> = new Map<number, any[]>();
  private previousCounts: Map<string, number> = new Map();
  private userData: UserRecruitmentData | null = null;
  private parameterIdsToDelete: number[] = [];
  private highestRowIndexMap: Map<string, number> = new Map();
  constructor(
    private fb: FormBuilder,
    private HTTP: HttpService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private utils: UtilsService,
    private alertService: AlertService,
    private recruitmentState: RecruitmentStateService,
    private loader: LoaderService
  ) {
    this.form = this.fb.group({
      subHeadings: this.fb.group({}),
      details: this.fb.array([]),
      firstMissedMandatory: [''],
      mandatorySubheadingsSelected: [false, Validators.requiredTrue],
    });
    this.userData = this.recruitmentState.getCurrentUserData();
  }

  get detailsArray(): FormArray<FormGroup<DetailFormGroup>> {
    return this.form.get('details') as FormArray<FormGroup<DetailFormGroup>>;
  }

  ngOnInit(): void {
    this.loader.showLoader();
    this.loadFormStructure();
    this.form.get('subHeadings')?.valueChanges.subscribe(() => {
      this.generateDetailsTable();
      this.checkMandatorySubheadingsAndParameters();
      this.cdr.detectChanges();
    });
    this.form.get('details')?.valueChanges.subscribe(() => {
      this.checkMandatorySubheadingsAndParameters();
      this.cdr.detectChanges();
    });
  }

  public getExistingRowCount(item: any): number {
    if (!item || !this.detailsArray) {
      return 0;
    }
    const typeValue = item.m_rec_score_field_id.toString();
    return this.detailsArray.controls.filter(
      (control) => control.get('type')?.value === typeValue
    ).length;
  }
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

  // ✅ NEW: Logic to handle row deletion
  removeRow(detailForm: AbstractControl): void {
    // ✅ Ask for confirmation before doing anything else
    this.alertService
      .confirmAlert(
        'Confirm Deletion',
        'Are you sure you want to remove this row? This will be saved on the next "Save & Continue".',
        'warning'
      )
      .then((result: any) => {
        // ✅ Only proceed if the user confirms
        if (result.isConfirmed) {
          const typeValue = detailForm.get('type')?.value;
          const globalIndex = this.detailsArray.controls.indexOf(
            detailForm as FormGroup<DetailFormGroup>
          );

          if (!typeValue || globalIndex < 0) return;

          // --- Logic to capture existing IDs for deletion ---
          const subHeading = this.subHeadings.find((sub) =>
            sub.items.some(
              (item: any) => item.m_rec_score_field_id.toString() === typeValue
            )
          );
          const rowIndex = detailForm.get('_rowIndex')?.value;
          if (subHeading) {
            const indexInfo = this.getSubheadingScopedIndex(globalIndex);
            const paramsForSubheading = this.getParametersForSubHeading(
              subHeading.m_rec_score_field_id
            );

            if (indexInfo) {
              paramsForSubheading.forEach((param) => {
                const paramKey = `${subHeading.m_rec_score_field_id}_${typeValue}_${param.m_rec_score_field_parameter_new_id}_${rowIndex}`;
                if (this.filePaths.has(paramKey)) {
                  this.filePaths.delete(paramKey);
                }
                if (this.existingParameterIds.has(paramKey)) {
                  const idToDelete = this.existingParameterIds.get(paramKey)!;
                  if (!this.parameterIdsToDelete.includes(idToDelete)) {
                    this.parameterIdsToDelete.push(idToDelete);
                  }
                }
              });
            }
          }

          // --- Remove the row and update the UI ---
          this.detailsArray.removeAt(globalIndex);

          const item = subHeading?.items.find(
            (i: any) => i.m_rec_score_field_id.toString() === typeValue
          );
          if (item) {
            const countControl = this.form.get(
              `subHeadings.${subHeading.m_rec_score_field_id}.${item.normalizedKey}.count`
            );
            if (countControl) {
              const currentCount = this.detailsArray.controls.filter(
                (c) => c.get('type')?.value === typeValue
              ).length;
              countControl.setValue(
                currentCount > 0 ? currentCount.toString() : null,
                { emitEvent: false }
              );
            }
          }

          this.generateDetailsTable();
          this.checkMandatorySubheadingsAndParameters();
          this.cdr.markForCheck();
        }
        // If the user clicks "No" or cancels, do nothing.
      });
  }

  // In step-6.component.ts

  private checkMandatorySubheadingsAndParameters(): void {
    let firstMissedMandatory = '';
    let firstMissedParameter = '';
    let firstMissedSubheading = '';
    let aMandatoryItemWasMissed = false;

    // Part 1: Check if any mandatory ITEM has a count of zero.
    // This loop structure is changed to correctly find the first error.
    mainLoop: for (const sub of this.subHeadings) {
      const subGroup = this.form.get(
        `subHeadings.${sub.m_rec_score_field_id}`
      ) as FormGroup;
      if (!subGroup) continue;

      const subGroupValues = subGroup.getRawValue();

      for (const item of sub.items) {
        // ✅ FIX: Directly check if the ITEM is mandatory, regardless of the parent subheading.
        if (item.is_mandatory === '1') {
          const count = subGroupValues[item.normalizedKey]?.count
            ? parseInt(subGroupValues[item.normalizedKey].count, 10)
            : 0;

          if (count <= 0) {
            firstMissedMandatory = `${sub.score_field_name_e} - ${item.score_field_name_e}`;
            aMandatoryItemWasMissed = true;
            break mainLoop; // Found the first error, exit all loops.
          }
        }
      }
    }

    // Part 2: If all mandatory item counts are valid, then check the table row parameters.
    if (!aMandatoryItemWasMissed) {
      rowLoop: for (const sub of this.subHeadings) {
        const formArray = this.getRowsForSubHeading(sub.m_rec_score_field_id);
        const params = this.getParametersForSubHeading(
          sub.m_rec_score_field_id
        );

        for (const group of formArray) {
          const item = sub.items.find(
            (i: any) =>
              i.m_rec_score_field_id.toString() === group.get('type')?.value
          );
          if (!item) continue;

          for (const param of params) {
            if (param.is_mandatory === 'Y' || param.is_mandatory === '1') {
              const control = group.get(param.normalizedKey);
              let isControlInvalid = !!control?.invalid;

              if (param.control_type === 'A') {
                const globalIndex = this.detailsArray.controls.indexOf(
                  group as FormGroup<DetailFormGroup>
                );
                const filePath = this.getFilePath(
                  group, // Pass the whole form group
                  param.m_rec_score_field_parameter_new_id,
                  sub.m_rec_score_field_id
                );
                if (filePath) {
                  isControlInvalid = false;
                }
              }

              if (isControlInvalid) {
                firstMissedParameter = param.score_field_parameter_name;
                firstMissedSubheading = item.score_field_name_e;
                break rowLoop;
              }
            }
          }
        }
      }
    }

    // Set the final validation state of the form.
    const allMandatoryValid = !firstMissedMandatory && !firstMissedParameter;
    this.form
      .get('mandatorySubheadingsSelected')
      ?.setValue(allMandatoryValid, { emitEvent: false });
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

  normalizeControlName(name: any): string {
    return typeof name === 'string'
      ? name.toLowerCase().replace(/[^a-z0-9_]/gi, '_')
      : '';
  }

  hasParameter(subHeadingId: string | number, parameterName: string): boolean {
    const key = subHeadingId.toString();
    return this.subHeadingParameters[key]?.some(
      (p) => p.score_field_parameter_name === parameterName
    );
  }

  hasSubHeadingRows(subHeadingId: number): boolean {
    const key = subHeadingId.toString();
    const hasRows = !!this.subHeadingDetails[key]?.length;
    return hasRows;
  }

  getCountOptions(): number[] {
    return Array.from({ length: 10 }, (_, i) => i + 1);
  }

  getCheckboxName(detailForm: AbstractControl): string {
    const typeValue = detailForm.get('type')?.value;
    for (const subHeading of this.subHeadings) {
      const item = subHeading.items.find(
        (item: any) => item.m_rec_score_field_id.toString() === typeValue
      );
      if (item) {
        return item.score_field_name_e || typeValue || '';
      }
    }
    return typeValue || '';
  }

  isRowType(detailForm: AbstractControl, subHeadingId: number): boolean {
    const typeValue = detailForm.get('type')?.value;
    return typeValue === subHeadingId.toString();
  }

  getRowsForSubHeading(subHeadingId: number): FormGroup<DetailFormGroup>[] {
    const key = subHeadingId.toString();
    const rows = this.subHeadingDetails[key] || [];

    return rows;
  }

  getParametersForSubHeading(subHeadingId: number | string): any[] {
    return this.subHeadingParameters[subHeadingId.toString()] || [];
  }
  private getSubheadingScopedIndex(
    globalIndex: number
  ): { subHeadingId: number; scopedIndex: number } | null {
    const row = this.detailsArray.at(globalIndex);
    const typeValue = row?.get('type')?.value;
    if (!typeValue) {
      return null;
    }

    const scoreFieldId = Number(typeValue);
    const subHeading = this.subHeadings.find((sub) =>
      sub.items.some((item: any) => item.m_rec_score_field_id === scoreFieldId)
    );
    if (!subHeading) {
      return null;
    }

    const subHeadingId = subHeading.m_rec_score_field_id;
    let scopedIndex = 0;
    for (let i = 0; i <= globalIndex; i++) {
      const currentRow = this.detailsArray.at(i);
      const currentTypeValue = currentRow?.get('type')?.value;
      if (!currentTypeValue) {
        continue;
      }
      const currentScoreFieldId = Number(currentTypeValue);
      const currentSubHeading = this.subHeadings.find((sub) =>
        sub.items.some(
          (item: any) => item.m_rec_score_field_id === currentScoreFieldId
        )
      );
      if (
        currentSubHeading &&
        currentSubHeading.m_rec_score_field_id === subHeadingId
      ) {
        scopedIndex++;
      }
    }
    return { subHeadingId, scopedIndex };
  }
  getFilePath(
    detailForm: AbstractControl, // Pass the whole form group
    paramId: number,
    subHeadingId: number
  ): string | null {
    const scoreFieldId = detailForm.get('type')?.value;
    const rowIndex = detailForm.get('_rowIndex')?.value; // <-- Get stable index from the control

    if (!scoreFieldId || !rowIndex) {
      return null;
    }

    const key = `${subHeadingId}_${scoreFieldId}_${paramId}_${rowIndex}`;
    return this.filePaths.get(key) || null;
  }
  sanitizeFileUrl(filePath: string): SafeUrl {
    // filePath from the DB is already in the format "recruitment/24000001/filename.pdf"
    // We can use it directly to build the URL.
    const url = `http://192.168.1.57:3500/${filePath}`;
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  getFileName(filePath: string): string {
    return filePath.split('\\').pop() || 'Unknown File';
  }

  private getParameterValuesAndPatch(): void {
    const registrationNo = this.userData?.registration_no;
    const a_rec_adv_main_id = this.userData?.a_rec_adv_main_id;
    const a_rec_app_main_id = this.userData?.a_rec_app_main_id;
    if (!this.heading) {
      console.warn('Heading not loaded, cannot patch values.');
      return;
    }
    if (!registrationNo || !a_rec_app_main_id) {
      console.warn('User data is missing, cannot patch values.');
      this.loader.hideLoader();
      return;
    }
    const parentRequest = this.HTTP.getData(
      `/candidate/get/getParameterValues?registration_no=${registrationNo}&a_rec_app_main_id=${a_rec_app_main_id}&score_field_parent_id=0&m_rec_score_field_id=${this.heading.m_rec_score_field_id}&Application_Step_Flag_CES=C`,
      'recruitement'
    );

    const childParentIds = this.subHeadings.map((s) => s.m_rec_score_field_id);
    const childrenRequests = childParentIds.map((id) =>
      this.HTTP.getData(
        `/candidate/get/getParameterValues?registration_no=${registrationNo}&a_rec_app_main_id=${a_rec_app_main_id}&score_field_parent_id=${id}&Application_Step_Flag_CES=C`,
        'recruitement'
      )
    );

    forkJoin({
      parent: parentRequest,
      children: forkJoin(childrenRequests),
    }).subscribe({
      next: ({ parent, children }) => {
        const savedParentData = parent.body?.data || [];
        if (savedParentData.length > 0) {
          this.existingParentDetailId =
            savedParentData[0].a_rec_app_score_field_detail_id;
        } else {
          this.existingParentDetailId = null;
        }

        const savedChildrenData = children.flatMap(
          (res: any) => res.body?.data || []
        );

        this.detailsArray.clear();
        this.filePaths.clear();
        this.existingDetailIds.clear();
        this.existingParameterIds.clear();
        this.highestRowIndexMap.clear();
        Object.keys(this.subHeadingDetails).forEach(
          (key) => (this.subHeadingDetails[key] = [])
        );

        // 2. Group all parameter records into unique rows
        // A unique row is identified by parent_id + item_id + row_index
        const rowsGroupedByUniqueKey = new Map<string, any[]>();
        savedChildrenData.forEach((record) => {
          const uniqueRowKey = `${record.score_field_parent_id}_${record.m_rec_score_field_id}_${record.parameter_row_index}`;
          if (!rowsGroupedByUniqueKey.has(uniqueRowKey)) {
            rowsGroupedByUniqueKey.set(uniqueRowKey, []);
          }
          rowsGroupedByUniqueKey.get(uniqueRowKey)!.push(record);

          // While we're here, populate the map for existing detail IDs
          const detailKey = `${record.score_field_parent_id}_${record.m_rec_score_field_id}`;
          this.existingDetailIds.set(
            detailKey,
            record.a_rec_app_score_field_detail_id
          );
        });

        // 3. Create and patch a FormGroup for each unique row
        rowsGroupedByUniqueKey.forEach((rowData, uniqueRowKey) => {
          if (rowData.length === 0) return;

          const [subHeadingIdStr, scoreFieldIdStr, rowIndexStr] =
            uniqueRowKey.split('_');
          const subHeadingId = Number(subHeadingIdStr);
          const scoreFieldId = Number(scoreFieldIdStr);
          const rowIndex = Number(rowIndexStr);

          // Update the highest known row index for this item type
          const mapKey = `${subHeadingId}_${scoreFieldId}`;
          const currentMax = this.highestRowIndexMap.get(mapKey) || 0;
          if (rowIndex > currentMax) {
            this.highestRowIndexMap.set(mapKey, rowIndex);
          }

          // Create a new, correctly structured FormGroup for this row
          const newGroup = this.createDetailGroup(
            scoreFieldId.toString(),
            subHeadingId,
            rowIndex
          );

          // Patch the saved values into the new group
          rowData.forEach((paramData) => {
            const param = this.getParametersForSubHeading(subHeadingId).find(
              (p) =>
                p.m_rec_score_field_parameter_new_id ===
                paramData.m_rec_score_field_parameter_new_id
            );
            if (param) {
              const controlName = param.normalizedKey;
              const paramKey = `${subHeadingId}_${scoreFieldId}_${param.m_rec_score_field_parameter_new_id}_${rowIndex}`;

              this.existingParameterIds.set(
                paramKey,
                paramData.a_rec_app_score_field_parameter_detail_id
              );

              if (paramData.parameter_value?.includes('/')) {
                // It's a file path
                this.filePaths.set(paramKey, paramData.parameter_value);
                newGroup
                  .get(controlName)
                  ?.setValue('FILE_UPLOADED', { emitEvent: false });
              } else {
                newGroup
                  .get(controlName)
                  ?.setValue(paramData.parameter_value, { emitEvent: false });
              }
            }
          });

          // Add the completed group to the main FormArray
          this.detailsArray.push(newGroup);
        });

        // 4. Rebuild the `subHeadingDetails` map used by the template
        this.detailsArray.controls.forEach((control) => {
          const typeValue = control.get('type')?.value;
          const subHeading = this.subHeadings.find((sh) =>
            sh.items.some(
              (item: any) => item.m_rec_score_field_id.toString() === typeValue
            )
          );
          if (subHeading) {
            const key = subHeading.m_rec_score_field_id.toString();
            this.subHeadingDetails[key].push(
              control as FormGroup<DetailFormGroup>
            );
          }
        });

        // 5. Update the "count" dropdowns based on the rows we actually created
        const itemCounts = new Map<number, number>();
        this.detailsArray.controls.forEach((control) => {
          const scoreFieldId = Number(control.get('type')?.value);
          itemCounts.set(scoreFieldId, (itemCounts.get(scoreFieldId) || 0) + 1);
        });

        this.subHeadings.forEach((subHeading) => {
          const subGroup = this.form.get(
            `subHeadings.${subHeading.m_rec_score_field_id}`
          ) as FormGroup;
          if (subGroup) {
            subHeading.items.forEach((item: any) => {
              const count = itemCounts.get(item.m_rec_score_field_id) || 0;
              subGroup
                .get(`${item.normalizedKey}.count`)
                ?.setValue(count > 0 ? count.toString() : null, {
                  emitEvent: false,
                });
            });
          }
        });

        this.checkMandatorySubheadingsAndParameters();
        this.loader.hideLoader();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ Error fetching parameter values:', err);
        this.alertService.alert(true, 'Failed to load existing data.');
        this.loader.hideLoader();
        this.cdr.markForCheck();
      },
    });
  }

  loadFormStructure() {
    const a_rec_adv_main_id = this.userData?.a_rec_adv_main_id;
    const m_rec_score_field_id = 34; // Main Heading ID

    this.HTTP.getData(
      `/master/get/getSubHeadingParameterByParentScoreField?m_rec_score_field=N&a_rec_adv_main_id=${a_rec_adv_main_id}&m_rec_score_field_id=${m_rec_score_field_id}`,
      'recruitement'
    ).subscribe({
      next: (headingResponse: any) => {
        const headingData = headingResponse.body?.data || [];
        if (!headingData.length) {
          console.error('❌ No heading data found.');
          this.alertService.alert(
            true,
            'Could not load form heading structure.'
          );
          return;
        }
        this.heading = headingData[0];
        this.score_field_title_name = this.heading?.score_field_title_name;
        const a_rec_adv_post_detail_id = this.heading?.a_rec_adv_post_detail_id;

        this.HTTP.getData(
          `/master/get/getSubHeadingByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&score_field_parent_id=${m_rec_score_field_id}&a_rec_adv_post_detail_id=${a_rec_adv_post_detail_id}`,
          'recruitement'
        ).subscribe({
          next: (subHeadingResponse: any) => {
            const subHeadingData = subHeadingResponse.body?.data || [];

            this.subHeadings = subHeadingData.map((sub: any) => ({
              ...sub,
              items: [], // Initialize items array
            }));

            this.subHeadings.forEach((sub) => {
              const key = sub.m_rec_score_field_id.toString();
              this.subHeadingDetails[key] = [];
              this.subHeadingParameters[key] = [];
            });

            const itemRequests = this.subHeadings.map((sub) =>
              this.HTTP.getData(
                `/master/get/getSubHeadingByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&score_field_parent_id=${sub.m_rec_score_field_id}&a_rec_adv_post_detail_id=${a_rec_adv_post_detail_id}`,
                'recruitement'
              )
            );

            const paramRequests = this.subHeadings.map((sub) =>
              this.HTTP.getData(
                `/master/get/getSubHeadingParameterByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&m_rec_score_field_id=${sub.m_rec_score_field_id}&score_field_parent_code=${sub.score_field_parent_code}&m_parameter_master=Y`,
                'recruitement'
              )
            );

            forkJoin([forkJoin(itemRequests), forkJoin(paramRequests)])
              .pipe(
                switchMap(([itemResponses, paramResponses]) => {
                  itemResponses.forEach((res, index) => {
                    const itemData = res.body?.data || [];
                    this.subHeadings[index].items = itemData.map(
                      (item: any) => ({
                        ...item,
                        normalizedKey: this.normalizeControlName(
                          item.score_field_name_e
                        ),
                        is_mandatory: item.score_field_is_mandatory || 'N',
                      })
                    );
                    this.setupSubHeadingForm(this.subHeadings[index]);
                  });

                  paramResponses.forEach((res, index) => {
                    const paramData =
                      res.body?.data
                        ?.map((param: any) => ({
                          ...param,
                          normalizedKey: this.normalizeControlName(
                            param.score_field_parameter_name
                          ),
                        }))
                        .sort(
                          (a: any, b: any) =>
                            (a.parameter_display_order || 0) -
                            (b.parameter_display_order || 0)
                        ) || [];
                    const subHeadingId =
                      this.subHeadings[index].m_rec_score_field_id.toString();
                    this.subHeadingParameters[subHeadingId] = paramData;
                  });

                  const allParams = Object.values(
                    this.subHeadingParameters
                  ).flat();
                  const uniqueQueryIds = [
                    ...new Set(
                      allParams
                        .map((p: any) => p.isQuery_id)
                        .filter((id): id is number => id && id > 0)
                    ),
                  ];

                  if (uniqueQueryIds.length === 0) {
                    return of([]);
                  }

                  const dropdownRequests = uniqueQueryIds.map((queryId) =>
                    this.getDropdownData(queryId).pipe(
                      map((data) => ({ queryId, data }))
                    )
                  );

                  return forkJoin(dropdownRequests);
                })
              )
              .subscribe({
                next: (dropdownResults) => {
                  if (dropdownResults && dropdownResults.length > 0) {
                    dropdownResults.forEach((result) => {
                      this.dropdownData.set(result.queryId, result.data);
                    });
                  }
                  this.getParameterValuesAndPatch();
                  this.cdr.detectChanges();
                },
                error: (err) => {
                  console.error(
                    '❌ Error fetching items/params/dropdowns:',
                    err
                  );
                  this.alertService.alert(true, 'Failed to load form details.');
                },
              });
          },
          error: (err) => {
            console.error('❌ Error fetching subheadings:', err);
            this.alertService.alert(true, 'Failed to load form structure.');
          },
        });
      },
      error: (err) => {
        console.error('❌ Error fetching heading:', err);
        this.alertService.alert(
          true,
          'Failed to load main form configuration.'
        );
      },
    });
  }

  setupSubHeadingForm(subHeading: any) {
    const groupName = subHeading.m_rec_score_field_id.toString();
    const subGroup: any = {};

    subHeading.items.forEach((item: any) => {
      subGroup[item.normalizedKey] = this.fb.group({
        count: [null],
      });
    });

    (this.form.get('subHeadings') as FormGroup).setControl(
      groupName,
      this.fb.group(subGroup)
    );
  }

  toggleEdit() {
    if (this.isGeneratingTable) {
      return;
    }

    this.isEditing = !this.isEditing;

    if (!this.isEditing) {
      if (this.hasCountsChanged()) {
        setTimeout(() => {
          this.generateDetailsTable();
        }, 100);
      }
    }

    this.cdr.markForCheck();
  }

  private hasCountsChanged(): boolean {
    let countsChanged = false;

    this.subHeadings.forEach((subHeading) => {
      const groupName = subHeading.m_rec_score_field_id.toString();
      const subGroup = this.form.get(['subHeadings', groupName]) as FormGroup;

      if (!subGroup) return;

      const subGroupRaw = subGroup.getRawValue() || {};

      subHeading.items.forEach((item: any) => {
        const key = item.normalizedKey;
        const control = subGroupRaw[key];
        const currentCount = control?.count ? parseInt(control.count, 10) : 0;
        const previousCount =
          this.previousCounts.get(`${groupName}_${key}`) || 0;

        if (currentCount !== previousCount) {
          countsChanged = true;
        }

        this.previousCounts.set(`${groupName}_${key}`, currentCount);
      });
    });

    return countsChanged;
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

      // Use a regular expression to test if the key is allowed
      // This pattern allows letters, spaces, periods, and parentheses
      const isAllowedChar = /^[a-zA-Z ().,:&\-]$/.test(event.key);

      // If the key is not an allowed character, block the input
      if (!isAllowedChar) {
        event.preventDefault();
      }
    }
  }

  // In step-6.component.ts

  private createDetailGroup(
    typeValue: string,
    subHeadingId: number,
    rowIndex: number
  ): FormGroup {
    const parametersForSubHeading =
      this.getParametersForSubHeading(subHeadingId);
    const detailGroupData: DetailFormGroup = {
      type: new FormControl({ value: typeValue, disabled: true }, [
        Validators.required,
      ]),
      _rowIndex: new FormControl({ value: rowIndex, disabled: true }),
    };

    parametersForSubHeading.forEach((param: any) => {
      const validators = [];
      if (param.is_mandatory === 'Y') {
        validators.push(Validators.required);
      }

      if (param.control_type === 'T' && param.isDatatype === 'number') {
        validators.push(Validators.min(0));
      }

      // ✅ ADD THIS CONDITION for text pattern validation
      if (param.control_type === 'T' && param.isDatatype === 'text') {
        // Use the same flexible pattern here
        Validators.pattern('^[a-zA-Z ().,:&-]*$');
      }

      detailGroupData[param.normalizedKey] = new FormControl(
        param.control_type === 'A' ? null : '',
        validators
      );
    });

    return this.fb.group(detailGroupData);
  }

  generateDetailsTable() {
    if (this.isGeneratingTable) return;
    this.isGeneratingTable = true;

    try {
      const allGeneratedRows = new Set<AbstractControl>();

      this.subHeadings.forEach((subHeading) => {
        const groupName = subHeading.m_rec_score_field_id.toString();
        const subGroup = this.form.get(['subHeadings', groupName]) as FormGroup;
        if (!subGroup) return;

        if (!this.subHeadingDetails[groupName]) {
          this.subHeadingDetails[groupName] = [];
        }

        const subGroupRaw = subGroup.getRawValue();

        subHeading.items.forEach((item: any) => {
          const typeValue = item.m_rec_score_field_id.toString();
          const newCount =
            parseInt(subGroupRaw[item.normalizedKey]?.count, 10) || 0;

          let existingRowsOfType = this.detailsArray.controls.filter(
            (c) => c.get('type')?.value === typeValue
          );
          let oldCount = existingRowsOfType.length;

          // Add new rows if needed
          if (newCount > oldCount) {
            for (let i = 0; i < newCount - oldCount; i++) {
              // ✅ LOGIC TO FIND NEXT AVAILABLE INDEX
              const mapKey = `${subHeading.m_rec_score_field_id}_${item.m_rec_score_field_id}`;
              const newRowIndex =
                (this.highestRowIndexMap.get(mapKey) || 0) + 1;
              this.highestRowIndexMap.set(mapKey, newRowIndex); // Immediately update the new max

              const newGroup = this.createDetailGroup(
                typeValue,
                subHeading.m_rec_score_field_id,
                newRowIndex
              );
              this.detailsArray.push(newGroup);
            }
          }
          // Remove rows if needed
          else if (newCount < oldCount) {
            const toRemoveCount = oldCount - newCount;
            const rowsToRemove = existingRowsOfType.slice(-toRemoveCount);
            rowsToRemove.forEach((rowToRemove) => {
              const index = this.detailsArray.controls.indexOf(rowToRemove);
              if (index > -1) {
                this.detailsArray.removeAt(index);
              }
            });
          }
        });
      });

      // Final Sync Step: Rebuild subHeadingDetails from the single source of truth (detailsArray)
      Object.keys(this.subHeadingDetails).forEach(
        (key) => (this.subHeadingDetails[key] = [])
      );

      this.detailsArray.controls.forEach((control) => {
        const typeValue = control.get('type')?.value;
        if (typeValue) {
          const subHeading = this.subHeadings.find((sh) =>
            sh.items.some(
              (item: any) => item.m_rec_score_field_id.toString() === typeValue
            )
          );
          if (subHeading) {
            const groupName = subHeading.m_rec_score_field_id.toString();
            if (this.subHeadingDetails[groupName]) {
              this.subHeadingDetails[groupName].push(
                control as FormGroup<DetailFormGroup>
              );
            }
          }
        }
      });

      this.debugFormState();
      this.cdr.detectChanges();
    } catch (error) {
      console.error('❌ Error in generateDetailsTable:', error);
    } finally {
      this.isGeneratingTable = false;
    }
  }

  //remove this after the completion
  private debugFormState() {
    this.detailsArray.controls.forEach((control, index) => {
      const typeValue = control.get('type')?.value;
      const rawValue = control.getRawValue();
    });
  }

  // In step-6.component.ts

  onFileChange(
    event: Event,
    detailForm: AbstractControl, // <-- Changed from index
    controlName: string
  ) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    let file: File | null = input.files[0];
    const detailType = detailForm.get('type')?.value;
    const rowIndex = detailForm.get('_rowIndex')?.value; // <-- Get stable index
    let param: any = null;
    let subHeading: any = null;

    // Find the parameter configuration to access its properties
    if (detailType) {
      subHeading = this.subHeadings.find((sub) =>
        sub.items.some(
          (item: any) => item.m_rec_score_field_id.toString() === detailType
        )
      );
      if (subHeading) {
        const parameters = this.getParametersForSubHeading(
          subHeading.m_rec_score_field_id
        );
        param = parameters.find((p) => p.normalizedKey === controlName);
      }
    }

    // File size validation logic...
    if (param && param.data_type_size && file) {
      const maxSizeKB = param.data_type_size;
      const maxSizeInBytes = maxSizeKB * 1024;

      if (file.size > maxSizeInBytes) {
        this.alertService.alert(
          true,
          `File size for "${
            param.score_field_parameter_name
          }" cannot exceed ${maxSizeKB}KB. Your file is ~${Math.round(
            file.size / 1024
          )}KB.`
        );
        // If invalid, clear the input and nullify the file variable
        input.value = '';
        file = null;
      }
    }

    // Patch the new file into the form control
    detailForm.patchValue({ [controlName]: file }, { emitEvent: false });

    // If a user selects a new file, we must delete the old file path from memory.
    if (detailType && param && subHeading && rowIndex) {
      const paramKey = `${subHeading.m_rec_score_field_id}_${detailType}_${param.m_rec_score_field_parameter_new_id}_${rowIndex}`;
      if (this.filePaths.has(paramKey)) {
        this.filePaths.delete(paramKey);
      }
    }

    this.cdr.markForCheck();
  }

  private logFormData(title: string, formData: FormData) {
    for (const [key, value] of formData.entries()) {
      if (
        key === 'scoreFieldDetailList' ||
        key === 'scoreFieldParameterList' ||
        key === 'parentScore'
      ) {
        try {
          const parsedValue = JSON.parse(value as string);
        } catch (e) {}
      } else if (key.startsWith('file_')) {
      } else {
      }
    }
  }

  private logExistingIds() {}

  private generateFilePath(
    registrationNo: number,
    file: File,
    scoreFieldId: number,
    parameterId: number,
    rowIndex: number,
    subHeadingId: number
  ): string {
    const originalName = file.name;
    // Use path.parse to correctly separate the name and extension
    const parsedFile = {
      name: originalName.substring(0, originalName.lastIndexOf('.')),
      ext: originalName.substring(originalName.lastIndexOf('.')),
    };

    const sanitizedName = parsedFile.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    // Append the original extension at the end
    const fileName = `${registrationNo}_${subHeadingId}_${scoreFieldId}_${parameterId}_${rowIndex}_${sanitizedName}${parsedFile.ext}`;

    return `recruitment/${registrationNo}/${fileName}`;
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.checkMandatorySubheadingsAndParameters();
    const freshUserData = this.recruitmentState.getCurrentUserData();
    this.userData = freshUserData;
    // Emit the latest form data and validity state
    const formData = this.getFormData();
    this.formData.emit(formData);

    if (!formData._isValid) {
      const firstMissed = this.form.get('firstMissedMandatory')?.value;
      this.alertService.alert(
        true,
        firstMissed
          ? `${firstMissed} is mandatory. Please provide the required information.`
          : 'Please fill all mandatory fields.'
      );
      // ✅ Reject the promise to signal failure to the stepper
      return Promise.reject(new Error('Form is invalid'));
    }

    const anySelected = this.detailsArray.length > 0;
    if (anySelected) {
      // ✅ Await the database save operation, which includes waiting for the success alert
      await this.saveToDatabase();
    } else {
      // If nothing is selected, resolve immediately as there's nothing to save.
      console.log('No items were selected, so nothing was saved.');
      return Promise.resolve();
    }
  }

  // Helper method to prepare form data for emission (optional, to avoid duplication)
  // Helper method to prepare form data for emission
  private getFormData(): any {
    const formValue = this.form.getRawValue();

    // Process details to convert IDs to Names and handle Files
    const processedDetails = formValue.details.map((detail: any) => {
      // Destructure to isolate metadata like rowIndex and type
      const { _rowIndex, type, ...rest } = detail;

      // Start the processed object with the type
      const processedRow: any = { type };

      // 1. Find the configuration for this specific row type
      const typeValue = type; // This is the m_rec_score_field_id of the ITEM
      const subHeading = this.subHeadings.find((sub) =>
        sub.items.some(
          (item: any) => item.m_rec_score_field_id.toString() === typeValue
        )
      );

      if (subHeading) {
        // Get parameters defined for this SubHeading
        const parameters = this.getParametersForSubHeading(
          subHeading.m_rec_score_field_id
        );

        // 2. Iterate over the form values in this row
        Object.keys(rest).forEach((key) => {
          const value = rest[key];
          // Find the parameter definition that matches this form control name (normalizedKey)
          const param = parameters.find((p: any) => p.normalizedKey === key);

          if (param) {
            // ✅ START: DROPDOWN LOGIC (ID -> Name Conversion)
            if (
              ['D', 'DC', 'DY'].includes(param.control_type) &&
              param.isQuery_id
            ) {
              const options = this.dropdownData.get(param.isQuery_id);
              // Find option where data_id matches value (use == for string/number comparison)
              const selectedOption = options?.find(
                (opt) => opt.data_id == value
              );

              if (selectedOption) {
                processedRow[key] = selectedOption.data_name;
              } else {
                processedRow[key] = value; // Fallback
              }
            }
            // ✅ END: DROPDOWN LOGIC

            // FILE LOGIC (Consistent with Step 2)
            else if (param.control_type === 'A') {
              if (value instanceof File) {
                processedRow[key] = value;
              } else {
                // Reconstruct key to check existing file path
                const paramKey = `${subHeading.m_rec_score_field_id}_${typeValue}_${param.m_rec_score_field_parameter_new_id}_${_rowIndex}`;
                const existingFilePath = this.filePaths.get(paramKey);
                if (existingFilePath) {
                  processedRow[key] = existingFilePath;
                } else {
                  processedRow[key] = null;
                }
              }
            }
            // STANDARD TEXT/NUMBER
            else {
              processedRow[key] = value;
            }
          } else {
            // If it's not a mapped parameter (e.g., hidden ID fields), keep as is
            processedRow[key] = value;
          }
        });
      } else {
        // If structure not found, return original values
        Object.assign(processedRow, rest);
      }

      return processedRow;
    });

    const subheadingsData = this.subHeadings.reduce((acc, sub) => {
      acc[sub.m_rec_score_field_id] = {
        m_rec_score_field_id: sub.m_rec_score_field_id,
        score_field_name_e: sub.score_field_name_e,
        a_rec_adv_post_detail_id: sub.a_rec_adv_post_detail_id,
        items: sub.items.map((item: any) => ({
          m_rec_score_field_id: item.m_rec_score_field_id,
          score_field_name_e: item.score_field_name_e,
          normalizedKey: item.normalizedKey,
        })),
      };
      return acc;
    }, {} as { [key: string]: any });

    return {
      ...formValue,
      details: processedDetails, // Use the processed array
      _isValid: this.form.valid,
      heading: {
        score_field_title_name: this.score_field_title_name,
        m_rec_score_field_id: 8,
      },
      subheadings: subheadingsData,
    };
  }

  // in step-6.component.ts

  saveToDatabase(): Promise<void> {
    // ✅ Wrap the entire logic in a new Promise
    return new Promise((resolve, reject) => {
      this.loader.showLoader();
      const registrationNo = this.userData?.registration_no;
      const a_rec_adv_main_id = this.userData?.a_rec_adv_main_id;
      const a_rec_app_main_id = this.userData?.a_rec_app_main_id;
      if (!registrationNo || !a_rec_adv_main_id || !a_rec_app_main_id) {
        const errorMsg = 'User identification is missing. Cannot save data.';
        this.alertService.alert(true, errorMsg);
        this.loader.hideLoader(); // Also hide loader on early exit
        return reject(new Error(errorMsg)); // Stop the function here
      }
      const formData = new FormData();
      const finalDetailList: any[] = [];
      const finalParameterList: any[] = [];

      // STEP 1: Create Summary Detail Records (One per item type)
      const rowsGroupedByType = new Map<string, any[]>();
      this.detailsArray.controls.forEach((control) => {
        const typeValue = control.get('type')?.value;
        if (typeValue) {
          if (!rowsGroupedByType.has(typeValue)) {
            rowsGroupedByType.set(typeValue, []);
          }
          rowsGroupedByType.get(typeValue)!.push(control);
        }
      });

      rowsGroupedByType.forEach((rowControls, typeValue) => {
        const scoreFieldId = Number(typeValue);
        const totalCount = rowControls.length;
        const subHeading = this.subHeadings.find((sub) =>
          sub.items.some(
            (item: any) => item.m_rec_score_field_id === scoreFieldId
          )
        );
        if (!subHeading) return;
        const subHeadingId = subHeading.m_rec_score_field_id;
        const item = subHeading.items.find(
          (i: any) => i.m_rec_score_field_id === scoreFieldId
        )!;
        const detailKey = `${subHeadingId}_${scoreFieldId}`;
        const existingDetailId = this.existingDetailIds.get(detailKey);
        const scoreResult = this.utils.calculateScore(
          3,
          {
            quantityInputs: [
              {
                scoreFieldId: item.m_rec_score_field_id,
                quantity: totalCount,
                weightage: item.score_field_field_weightage || 0,
                scoreFieldMarks: item.score_field_field_marks || 0,
              },
            ],
          },
          item.score_field_field_marks || 0
        );
        const detailRecord = {
          ...(existingDetailId && {
            a_rec_app_score_field_detail_id: existingDetailId,
          }),
          registration_no: registrationNo,
          a_rec_app_main_id: a_rec_app_main_id,
          a_rec_adv_post_detail_id: subHeading.a_rec_adv_post_detail_id,
          score_field_parent_id: subHeadingId,
          m_rec_score_field_id: scoreFieldId,
          m_rec_score_field_method_id: 3,
          score_field_value: totalCount,
          score_field_actual_value: scoreResult.score_field_actual_value,
          score_field_calculated_value:
            scoreResult.score_field_calculated_value,
          field_marks: item.score_field_field_marks || 0,
          field_weightage: item.score_field_field_weightage || 0,
          verify_remark: 'Not Verified',
          active_status: 'Y',
          delete_flag: 'N',
          action_type: existingDetailId ? 'U' : 'C',
          action_date: new Date().toISOString(),
          action_remark: existingDetailId ? 'data updated' : 'data inserted',

          action_by: 1,
        };
        finalDetailList.push(detailRecord);
      });

      // STEP 2: Create Granular Parameter Records for each UI row
      const subHeadingRowCounters: { [key: number]: number } = {};
      this.detailsArray.controls.forEach((rowControl) => {
        const typeValue = rowControl.get('type')?.value;
        if (!typeValue) return;
        const scoreFieldId = Number(typeValue);
        const subHeading = this.subHeadings.find((sub) =>
          sub.items.some(
            (item: any) => item.m_rec_score_field_id === scoreFieldId
          )
        );
        if (!subHeading) return;
        const subHeadingId = subHeading.m_rec_score_field_id;
        const detailKey = `${subHeadingId}_${scoreFieldId}`;
        const detailRecordFk = this.existingDetailIds.get(detailKey);

        const rowIndex = rowControl.get('_rowIndex')?.value;
        if (rowIndex === null || rowIndex === undefined) {
          console.warn('Skipping a row because it has no rowIndex.');
          return; // This skips the current iteration of the forEach loop
        }
        const subHeadingParameters =
          this.subHeadingParameters[subHeadingId.toString()] || [];
        subHeadingParameters.forEach((param: any) => {
          const paramValue = rowControl.getRawValue()[param.normalizedKey];
          const isFile = paramValue instanceof File;
          const paramKey = `${subHeadingId}_${scoreFieldId}_${param.m_rec_score_field_parameter_new_id}_${rowIndex}`;
          const existingParamId = this.existingParameterIds.get(paramKey);
          const existingFilePath = this.filePaths.get(paramKey);
          if (paramValue || existingParamId) {
            const parameter = {
              ...(existingParamId && {
                a_rec_app_score_field_parameter_detail_id: existingParamId,
              }),
              ...(detailRecordFk && {
                a_rec_app_score_field_detail_id: detailRecordFk,
              }),
              registration_no: registrationNo,
              score_field_parent_id: subHeadingId,
              m_rec_score_field_id: scoreFieldId,
              m_rec_score_field_parameter_new_id:
                param.m_rec_score_field_parameter_new_id,
              parameter_value: isFile
                ? this.generateFilePath(
                    registrationNo,
                    paramValue,
                    scoreFieldId,
                    param.m_rec_score_field_parameter_new_id,
                    rowIndex,
                    subHeadingId
                  )
                : paramValue === 'FILE_UPLOADED' && existingFilePath
                ? existingFilePath
                : String(paramValue ?? ''),
              parameter_row_index: rowIndex,
              parameter_display_order: param.parameter_display_order || 0,
              verify_remark: 'Not Verified',
              active_status: 'Y',
              delete_flag: 'N',
              action_type: existingParamId ? 'U' : 'C',
              action_date: new Date().toISOString(),
              action_remark: existingParamId
                ? 'parameter updated'
                : 'parameter inserted',

              action_by: 1,
            };
            finalParameterList.push(parameter);
            if (isFile) {
              const fileControlName = `file_${subHeadingId}_${scoreFieldId}_${
                param.m_rec_score_field_parameter_new_id
              }_${param.parameter_display_order || 0}_${rowIndex}`;
              formData.append(fileControlName, paramValue, paramValue.name);
            }
          }
        });
      });

      // STEP 3: Append the list of parameter IDs to be DELETED.
      if (this.parameterIdsToDelete.length > 0) {
        formData.append(
          'parameterIdsToDelete',
          JSON.stringify(this.parameterIdsToDelete)
        );
      }

      // STEP 4: Create the Parent Record
      const parentRecord = this.createParentRecord(
        registrationNo,
        a_rec_app_main_id
      );
      if (parentRecord) {
        formData.append('parentScore', JSON.stringify(parentRecord));
      }

      // STEP 5: Append final lists and make the API call
      formData.append('registration_no', registrationNo.toString());
      formData.append('scoreFieldDetailList', JSON.stringify(finalDetailList));
      formData.append(
        'scoreFieldParameterList',
        JSON.stringify(finalParameterList)
      );

      // STEP 6: Call the API Endpoint
      this.HTTP.postForm(
        '/candidate/postFile/saveOrUpdateQuantityBasedCandidateDetails',
        formData,
        'recruitement'
      ).subscribe({
        // ✅ Make the 'next' handler async
        next: async (res) => {
          // ✅ 1. CHECK FOR BACKEND ERRORS FIRST
          if (res?.body?.error) {
            this.alertService.alert(
              true,
              res.body.error.message || 'An error occurred on the server.'
            );
            this.loader.hideLoader();
            reject(new Error(res.body.error.message));
            return;
          }
          this.loader.hideLoader();
          // ✅ 2. AWAIT the success alert. The function will pause here.
          await this.alertService.alert(false, 'Data saved successfully!');

          // ✅ 3. This code runs ONLY AFTER the alert is closed.
          this.parameterIdsToDelete = [];
          this.getParameterValuesAndPatch();
          this.cdr.markForCheck();
          resolve(); // Resolve the promise to let the stepper proceed.
        },
        error: (err) => {
          this.alertService.alert(
            true,
            'Error saving records: ' + (err.error?.message || err.message)
          );
          this.cdr.markForCheck();
          this.loader.hideLoader();
          reject(err); // ✅ Reject the promise on API error
        },
      });
    });
  }

  // You might need a helper function for the parent record to avoid duplicating code
  private createParentRecord(
    registrationNo: number,
    a_rec_app_main_id: number
  ): any {
    if (!this.heading) return null;

    const quantityInputs: any[] = [];
    this.subHeadings.forEach((subHeading) => {
      const groupName = subHeading.m_rec_score_field_id.toString();
      const subGroupRaw =
        (
          this.form.get(['subHeadings', groupName]) as FormGroup
        )?.getRawValue() || {};
      subHeading.items.forEach((item: any) => {
        const key = item.normalizedKey;
        const count = parseInt(subGroupRaw[key]?.count, 10) || 0;
        if (count > 0) {
          quantityInputs.push({
            scoreFieldId: item.m_rec_score_field_id,
            quantity: count,
            weightage:
              item.score_field_field_weightage ||
              subHeading.score_field_field_weightage ||
              0,
            scoreFieldMarks: item.score_field_field_marks || 0,
          });
        }
      });
    });

    const parentMaxMarks = this.heading.score_field_field_marks || 20;
    const scoreResult = this.utils.calculateScore(
      3,
      { quantityInputs },
      parentMaxMarks
    );

    return {
      ...(this.existingParentDetailId && {
        a_rec_app_score_field_detail_id: this.existingParentDetailId,
      }),
      registration_no: registrationNo,
      a_rec_app_main_id: a_rec_app_main_id,
      a_rec_adv_post_detail_id: this.heading.a_rec_adv_post_detail_id,
      score_field_parent_id: 0,
      m_rec_score_field_id: this.heading.m_rec_score_field_id,
      m_rec_score_field_method_id: this.heading.m_rec_score_field_method_id,
      score_field_value: scoreResult.score_field_value,
      score_field_actual_value: scoreResult.score_field_actual_value,
      score_field_calculated_value: scoreResult.score_field_calculated_value,
      field_marks: parentMaxMarks,
      field_weightage: this.heading.score_field_field_weightage || 0,
      verify_remark: 'Not Verified',
      action_type: 'U',
      action_date: new Date().toISOString(),

      action_remark: 'parent data updated from recruitment form',
      action_by: 1,
      delete_flag: 'N',
    };
  }
}
