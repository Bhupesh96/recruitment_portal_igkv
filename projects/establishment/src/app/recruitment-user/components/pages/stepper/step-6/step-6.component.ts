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
import { forkJoin, Observable } from 'rxjs';
import { HttpService } from 'shared';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { UtilsService } from '../../utils.service';
import { AlertService } from 'shared';

interface DetailFormGroup {
  type: FormControl<string | null>;
  [key: string]: FormControl<string | File | null>;
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
  private originalRowCounts: Map<string, number> = new Map();
  private previousCounts: Map<string, number> = new Map();
  years: number[] = [];
  private parameterIdsToDelete: number[] = [];
  constructor(
    private fb: FormBuilder,
    private HTTP: HttpService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private utils: UtilsService,
    private alertService: AlertService
  ) {
    this.form = this.fb.group({
      subHeadings: this.fb.group({}),
      details: this.fb.array([]),
      firstMissedMandatory: [''],
      mandatorySubheadingsSelected: [false, Validators.requiredTrue],
    });
  }

  get detailsArray(): FormArray<FormGroup<DetailFormGroup>> {
    return this.form.get('details') as FormArray<FormGroup<DetailFormGroup>>;
  }

  ngOnInit(): void {
    this.getYearDropDown();
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
  getYearDropDown(): void {
    this.HTTP.getParam(
      '/candidate/get/getYearDropdown/',
      {},
      'recruitement'
    ).subscribe((response: any): void => {
      this.years =
        response?.body?.data.map((item: any) => item.m_year_name) || [];
      this.years.sort((a, b) => b - a); // Sort descending
      this.cdr.markForCheck();
    });
  }

  // ✅ NEW: Logic to handle row deletion
removeRow(detailForm: AbstractControl): void {
  const typeValue = detailForm.get('type')?.value;
  const globalIndex = this.detailsArray.controls.indexOf(
    detailForm as FormGroup<DetailFormGroup>
  );

  if (!typeValue || globalIndex < 0) return;

  // --- Start: Logic to capture existing IDs before deleting ---
  const subHeading = this.subHeadings.find((sub) =>
    sub.items.some(
      (item: any) => item.m_rec_score_field_id.toString() === typeValue
    )
  );

  if (subHeading) {
    const subHeadingId = subHeading.m_rec_score_field_id;
    const indexInfo = this.getSubheadingScopedIndex(globalIndex);
    const paramsForSubheading = this.getParametersForSubHeading(subHeadingId);

    if (indexInfo) {
      paramsForSubheading.forEach((param) => {
        // Reconstruct the key used to store the parameter ID when patching
        const paramKey = `${indexInfo.subHeadingId}_${typeValue}_${param.m_rec_score_field_parameter_new_id}_${indexInfo.scopedIndex}`;
        if (this.existingParameterIds.has(paramKey)) {
          const idToDelete = this.existingParameterIds.get(paramKey)!;
          if (!this.parameterIdsToDelete.includes(idToDelete)) {
            this.parameterIdsToDelete.push(idToDelete);
          }
        }
      });
    }
  }
  // --- End: Logic to capture IDs ---

  // Directly remove the form group from the main details array.
  this.detailsArray.removeAt(globalIndex);

  // Manually update the count in the top section to keep UI in sync.
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
      countControl.setValue(currentCount > 0 ? currentCount.toString() : null, {
        emitEvent: false, // Prevent re-triggering generateDetailsTable
      });
    }
  }

  // Re-sync the subHeadingDetails map and re-run validation
  this.generateDetailsTable();
  this.checkMandatorySubheadingsAndParameters();
  this.cdr.markForCheck();
}

  private checkMandatorySubheadingsAndParameters(): void {
    let firstMissedMandatory: string = '';
    let firstMissedParameter: string = '';
    let firstMissedSubheading: string = ''; // Check for mandatory subheadings and their mandatory items

    const missedMandatoryItem = this.subHeadings.find((sub: SubHeading) => {
      if (sub.score_field_is_mandatory !== '1') return false;

      const subGroup = this.form.get(
        `subHeadings.${sub.m_rec_score_field_id}`
      ) as FormGroup;
      if (!subGroup) return true; // Subgroup not found, consider it missing

      const subGroupValues = subGroup.getRawValue(); // Check if any mandatory item is missing a count
      return sub.items.some(
        (item: {
          m_rec_score_field_id: number;
          score_field_name_e: string;
          normalizedKey: string;
          is_mandatory: string;
        }) => {
          // Check if item is mandatory
          const isItemMandatory = item.is_mandatory === '1';
          if (!isItemMandatory) return false;

          const count = subGroupValues[item.normalizedKey]?.count
            ? parseInt(subGroupValues[item.normalizedKey].count, 10)
            : 0;
          if (count <= 0) {
            firstMissedMandatory = item.score_field_name_e; // e.g., "Gold Medal"
            return true;
          }
          return false;
        }
      );
    });

    if (missedMandatoryItem) {
      firstMissedMandatory =
        missedMandatoryItem.score_field_name_e + ': ' + firstMissedMandatory;
    } else {
      // Check for mandatory parameters in selected subheadings
      for (const sub of this.subHeadings) {
        const groupName = sub.m_rec_score_field_id.toString();
        const subGroup = this.form.get(`subHeadings.${groupName}`) as FormGroup;
        const subGroupRaw = subGroup?.getRawValue() || {};

        for (const item of sub.items) {
          const key = item.normalizedKey;
          const count = subGroupRaw[key]?.count
            ? parseInt(subGroupRaw[key].count, 10)
            : 0;
          if (count > 0) {
            const formArray = this.getRowsForSubHeading(
              sub.m_rec_score_field_id
            );
            const params = this.getParametersForSubHeading(
              sub.m_rec_score_field_id
            );

            for (const group of formArray) {
              if (
                group.get('type')?.value ===
                item.m_rec_score_field_id.toString()
              ) {
                for (const param of params) {
                  if (param.is_mandatory === 'Y') {
                    const control = group.get(param.normalizedKey);
                    const globalIndex = this.detailsArray.controls.indexOf(
                      group as FormGroup<DetailFormGroup>
                    );
                    const isFile = param.control_type === 'A';
                    const filePath = this.getFilePath(
                      item.m_rec_score_field_id.toString(),
                      param.m_rec_score_field_parameter_new_id,
                      globalIndex,
                      sub.m_rec_score_field_id
                    );

                    if (!control?.value && (!isFile || (isFile && !filePath))) {
                      firstMissedParameter = param.score_field_parameter_name;
                      firstMissedSubheading = item.score_field_name_e;
                      break;
                    }
                  }
                }
                if (firstMissedParameter) break;
              }
            }
            if (firstMissedParameter) break;
          }
        }
        if (firstMissedParameter) break;
      }
    }

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
    scoreFieldId: string | null | undefined,
    paramId: number,
    rowIndex: number,
    subHeadingId: number
  ): string | null {
    if (!scoreFieldId) return null;

    // Calculate the correct group-scoped index before creating the key
    const indexInfo = this.getSubheadingScopedIndex(rowIndex);
    if (!indexInfo) return null;

    const key = `${indexInfo.subHeadingId}_${scoreFieldId}_${paramId}_${indexInfo.scopedIndex}`;
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

  // In step-6.component.ts


private getParameterValuesAndPatch(): void {
  const registrationNo = 24000001;
  const a_rec_adv_main_id = 115;

  if (!this.heading) {
    console.warn('Heading not loaded, cannot patch values.');
    return;
  }

  const parentRequest = this.HTTP.getData(
    `/candidate/get/getParameterValues?registration_no=${registrationNo}&a_rec_app_main_id=${a_rec_adv_main_id}&score_field_parent_id=0&m_rec_score_field_id=${this.heading.m_rec_score_field_id}`,
    'recruitement'
  );

  const childParentIds = this.subHeadings.map((s) => s.m_rec_score_field_id);
  const childrenRequests = childParentIds.map((id) =>
    this.HTTP.getData(
      `/candidate/get/getParameterValues?registration_no=${registrationNo}&a_rec_app_main_id=${a_rec_adv_main_id}&score_field_parent_id=${id}`,
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
      this.subHeadingDetails = {};
      this.filePaths.clear();
      this.existingDetailIds.clear();
      this.existingParameterIds.clear();
      this.subHeadings.forEach((sub) => {
        this.subHeadingDetails[sub.m_rec_score_field_id.toString()] = [];
      });

      const dataBySubheading = new Map<number, any[]>();
      savedChildrenData.forEach((item) => {
        const subHeadingId = item.score_field_parent_id;
        if (!dataBySubheading.has(subHeadingId)) {
          dataBySubheading.set(subHeadingId, []);
        }
        dataBySubheading.get(subHeadingId)!.push(item);
      });

      dataBySubheading.forEach((records, subHeadingId) => {
        const rowsByRowIndex = new Map<number, any[]>();
        records.forEach((record) => {
          const rowIndex = record.parameter_row_index;
          if (!rowsByRowIndex.has(rowIndex)) {
            rowsByRowIndex.set(rowIndex, []);
          }
          rowsByRowIndex.get(rowIndex)!.push(record);
          const detailKey = `${record.score_field_parent_id}_${record.m_rec_score_field_id}`;
          this.existingDetailIds.set(
            detailKey,
            record.a_rec_app_score_field_detail_id
          );
        });

        const sortedRows = Array.from(rowsByRowIndex.entries()).sort(
          ([a], [b]) => a - b
        );
        const itemCounts = new Map<number, number>();

        sortedRows.forEach(([rowIndex, rowData]) => {
          if (rowData.length === 0) return;

          const firstRecord = rowData[0];
          const scoreFieldId = firstRecord.m_rec_score_field_id;
          itemCounts.set(
            scoreFieldId,
            (itemCounts.get(scoreFieldId) || 0) + 1
          );

          // --- Start of Corrected Logic ---
          // 1. Create the group using the centralized method that has the correct validators.
          const newGroup = this.createDetailGroup(
            scoreFieldId.toString(),
            subHeadingId
          );

          // 2. Now, patch the saved values into the correctly built group.
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
          // --- End of Corrected Logic ---

          this.detailsArray.push(newGroup);
          const subHeadingIdStr = subHeadingId.toString();
          if (!this.subHeadingDetails[subHeadingIdStr]) {
            this.subHeadingDetails[subHeadingIdStr] = [];
          }
          this.subHeadingDetails[subHeadingIdStr].push(newGroup);
        });

        const subHeadingMeta = this.subHeadings.find(
          (s) => s.m_rec_score_field_id === subHeadingId
        );
        if (subHeadingMeta) {
          const subGroup = this.form.get(
            `subHeadings.${subHeadingId}`
          ) as FormGroup;
          subHeadingMeta.items.forEach((item: any) => {
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
      this.cdr.markForCheck();
    },
    error: (err) => {
      console.error('❌ Error fetching parameter values:', err);
      this.alertService.alert(true, 'Failed to load existing data.');
      this.cdr.markForCheck();
    },
  });
}

  private initializeFormWithDefaults(): void {
    this.subHeadings.forEach((subHeading) => {
      const groupName = subHeading.m_rec_score_field_id.toString();
      const subGroup = this.form.get(`subHeadings.${groupName}`) as FormGroup;

      subHeading.items.forEach((item: any) => {
        subGroup
          .get(`${item.normalizedKey}.count`)
          ?.setValue('', { emitEvent: false });
      });
    });

    this.generateDetailsTable();
    this.cdr.markForCheck();
  }

  loadFormStructure() {
    const a_rec_adv_main_id = 115;
    const m_rec_score_field_id = 34;

    this.HTTP.getData(
      `/master/get/getSubHeadingParameterByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&m_rec_score_field_id=${m_rec_score_field_id}&m_rec_score_field=N`,
      'recruitement'
    ).subscribe({
      next: (headingResponse: any) => {
        const data = headingResponse.body?.data || [];

        this.heading = data[0];
        this.score_field_title_name = data[0]?.score_field_title_name;

        const a_rec_adv_post_detail_id = data[0]?.a_rec_adv_post_detail_id;

        this.HTTP.getData(
          `/master/get/getSubHeadingByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&score_field_parent_id=${m_rec_score_field_id}&a_rec_adv_post_detail_id=${a_rec_adv_post_detail_id}`,
          'recruitement'
        ).subscribe({
          next: (subHeadingResponse: any) => {
            const subHeadingData = subHeadingResponse.body?.data || [];

            this.subHeadings = subHeadingData.map((sub: any) => ({
              m_rec_score_field_id: sub.m_rec_score_field_id,
              score_field_name_e: sub.score_field_name_e,
              score_field_is_mandatory: sub.score_field_is_mandatory,
              a_rec_adv_post_detail_id: sub.a_rec_adv_post_detail_id,
              score_field_field_marks: sub.score_field_field_marks,
              score_field_field_weightage: sub.score_field_field_weightage,
              score_field_parent_code: sub.score_field_parent_code,
              score_field_title_name: sub.score_field_title_name,
              score_field_flag: sub.score_field_flag,
              message: sub.message,
              m_rec_score_field_method_id: sub.m_rec_score_field_method_id,
              score_field_validation_marks: sub.score_field_validation_marks,
              score_field_display_no: sub.score_field_display_no,
              score_field_is_attachment_required:
                sub.score_field_is_attachment_required,
              score_field_no_of_rows: sub.score_field_no_of_rows,
              items: [],
            }));

            this.subHeadings.forEach((sub) => {
              const key = sub.m_rec_score_field_id.toString();
              this.subHeadingRows[key] = [];
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
                `/master/get/getSubHeadingParameterByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&m_rec_score_field_id=${sub.m_rec_score_field_id}&score_field_parent_code=${sub.score_field_parent_code}&m_rec_score_field_parameter_new=N&m_parameter_master=Y`,
                'recruitement'
              )
            );

            forkJoin([
              forkJoin(itemRequests),
              forkJoin(paramRequests),
            ]).subscribe({
              next: ([itemResponses, paramResponses]) => {
                itemResponses.forEach((res, index) => {
                  const itemData = res.body?.data || [];

                  // Map items using API-provided score_field_is_mandatory
                  this.subHeadings[index].items = itemData.map((item: any) => ({
                    m_rec_score_field_id: item.m_rec_score_field_id,
                    score_field_name_e: item.score_field_name_e,
                    normalizedKey: this.normalizeControlName(
                      item.score_field_name_e
                    ),
                    is_mandatory: item.score_field_is_mandatory || 'N', // Use API field
                    score_field_field_marks: item.score_field_field_marks,
                    score_field_field_weightage:
                      item.score_field_field_weightage,
                    score_field_parent_code: item.score_field_parent_code,
                    score_field_title_name: item.score_field_title_name,
                    score_field_flag: item.score_field_flag,
                    message: item.message,
                    m_rec_score_field_method_id:
                      item.m_rec_score_field_method_id,
                    score_field_validation_marks:
                      item.score_field_validation_marks,
                    score_field_display_no: item.score_field_display_no,
                    score_field_is_attachment_required:
                      item.score_field_is_attachment_required,
                    score_field_no_of_rows: item.score_field_no_of_rows,
                  }));
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

                this.getParameterValuesAndPatch();
                this.cdr.detectChanges();
              },
              error: (err) => {
                console.error('❌ Error in forkJoin:', err);
                this.parameters = [];
                this.subHeadingDetails = {};
                this.generateDetailsTable();
                this.getParameterValuesAndPatch();
                this.cdr.detectChanges();
              },
            });
          },
          error: (err) => {
            console.error('❌ Error in SubHeading API:', err);
            this.subHeadings = [];
            this.subHeadingDetails = {};
            this.generateDetailsTable();
            this.getParameterValuesAndPatch();
            this.cdr.detectChanges();
          },
        });
      },
      error: (err) => {
        console.error('❌ Error in Heading API:', err);
        this.score_field_title_name = undefined;
        this.subHeadingDetails = {};
        this.generateDetailsTable();
        this.getParameterValuesAndPatch();
        this.cdr.detectChanges();
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
private createDetailGroup(
  typeValue: string,
  subHeadingId: number
): FormGroup {
  const parametersForSubHeading =
    this.getParametersForSubHeading(subHeadingId);
  const detailGroupData: DetailFormGroup = {
    type: new FormControl({ value: typeValue, disabled: true }, [
      Validators.required,
    ]),
  };
  
  parametersForSubHeading.forEach((param: any) => {
    const validators = [];
    if (param.is_mandatory === 'Y') {
      validators.push(Validators.required);
    }

    // ✅ ROBUST FIX: This condition now precisely targets number inputs.
    // It checks if the control is a text-based input AND its data type is 'number'.
    if (param.control_type === 'T' && param.isDatatype === 'number') {
      validators.push(Validators.min(0));
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
              const newGroup = this.createDetailGroup(
                typeValue,
                subHeading.m_rec_score_field_id
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
  onFileChange(event: Event, index: number, controlName: string) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const detailForm = this.detailsArray.at(index);
      detailForm.patchValue({ [controlName]: file }, { emitEvent: false });

      const detailType = detailForm.get('type')?.value;
      if (detailType) {
        // Find the correct subheading that contains this item
        const subHeading = this.subHeadings.find((sub) =>
          sub.items.some(
            (item: any) => item.m_rec_score_field_id.toString() === detailType
          )
        );

        if (subHeading) {
          const parameters = this.getParametersForSubHeading(
            subHeading.m_rec_score_field_id.toString()
          );
          const param = parameters.find((p) => p.normalizedKey === controlName);

          if (param) {
            const indexInfo = this.getSubheadingScopedIndex(index);
            if (indexInfo) {
              const paramKey = `${indexInfo.subHeadingId}_${detailType}_${param.m_rec_score_field_parameter_new_id}_${indexInfo.scopedIndex}`;
              if (this.filePaths.has(paramKey)) {
                this.filePaths.delete(paramKey);
              }
            }
          }
        }
      }

      this.cdr.markForCheck();
    }
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
    const fileName = `${registrationNo}_${subHeadingId}_${scoreFieldId}_${parameterId}_${
      rowIndex + 1
    }_${sanitizedName}${parsedFile.ext}`;

    return `recruitment/${registrationNo}/${fileName}`;
  }

  // submit method with corrected emit calls
  submit(): void {
    this.form.markAllAsTouched();
    this.checkMandatorySubheadingsAndParameters();

    const firstMissed = this.form.get('firstMissedMandatory')?.value;
    if (firstMissed) {
      this.alertService.alert(
        true,
        `${firstMissed} is mandatory. Please provide the required information.`,
        3000
      );
      this.formData.emit(this.getFormData()); // Corrected from emitFormData()
      return;
    }

    if (this.form.invalid) {
      this.alertService.alert(true, 'Please fill all mandatory fields.', 3000);
      this.formData.emit(this.getFormData()); // Corrected from emitFormData()
      return;
    }

    const anySelected = this.detailsArray.length > 0;

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

    const emitData = {
      ...this.form.getRawValue(),
      _isValid: this.form.valid,
      heading: {
        score_field_title_name:
          this.score_field_title_name || 'Academic Excellence',
        m_rec_score_field_id: 8,
        a_rec_adv_post_detail_id: 252,
      },
      subheadings: subheadingsData,
    };

    this.formData.emit(emitData);

    if (anySelected) {
      this.saveToDatabase();
    } 
  }

  // Helper method to prepare form data for emission (optional, to avoid duplication)
  private getFormData(): any {
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
      ...this.form.getRawValue(),
      _isValid: this.form.valid,
      heading: {
        score_field_title_name:
          this.score_field_title_name || 'Academic Excellence',
        m_rec_score_field_id: 8,
        a_rec_adv_post_detail_id: 252,
      },
      subheadings: subheadingsData,
    };
  }

  // in step-6.component.ts

saveToDatabase() {
  const registrationNo = 24000001;
  const a_rec_adv_main_id = 115;
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
      sub.items.some((item: any) => item.m_rec_score_field_id === scoreFieldId)
    );
    if (!subHeading) return;
    const subHeadingId = subHeading.m_rec_score_field_id;
    const item = subHeading.items.find(
      (i: any) => i.m_rec_score_field_id === scoreFieldId
    )!;
    const detailKey = `${subHeadingId}_${scoreFieldId}`;
    const existingDetailId = this.existingDetailIds.get(detailKey);
    const scoreResult = this.utils.calculateScore(3, {
        quantityInputs: [{
          scoreFieldId: item.m_rec_score_field_id,
          quantity: totalCount,
          weightage: item.score_field_field_weightage || 0,
          scoreFieldMarks: item.score_field_field_marks || 0,
        }, ],
      },
      item.score_field_field_marks || 0
    );
    const detailRecord = {
      ...(existingDetailId && {
        a_rec_app_score_field_detail_id: existingDetailId,
      }),
      registration_no: registrationNo,
      a_rec_app_main_id: a_rec_adv_main_id,
      a_rec_adv_post_detail_id: subHeading.a_rec_adv_post_detail_id,
      score_field_parent_id: subHeadingId,
      m_rec_score_field_id: scoreFieldId,
      m_rec_score_field_method_id: 3,
      score_field_value: totalCount,
      score_field_actual_value: scoreResult.score_field_actual_value,
      score_field_calculated_value: scoreResult.score_field_calculated_value,
      field_marks: item.score_field_field_marks || 0,
      field_weightage: item.score_field_field_weightage || 0,
      verify_remark: 'Not Verified',
      active_status: 'Y',
      delete_flag: 'N',
      action_type: existingDetailId ? 'U' : 'C',
      action_date: new Date().toISOString(),
      action_remark: existingDetailId ? 'data updated' : 'data inserted',
      action_ip_address: '127.0.0.1',
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
      sub.items.some((item: any) => item.m_rec_score_field_id === scoreFieldId)
    );
    if (!subHeading) return;
    const subHeadingId = subHeading.m_rec_score_field_id;
    const detailKey = `${subHeadingId}_${scoreFieldId}`;
    const detailRecordFk = this.existingDetailIds.get(detailKey);
    subHeadingRowCounters[subHeadingId] =
      (subHeadingRowCounters[subHeadingId] || 0) + 1;
    const rowIndex = subHeadingRowCounters[subHeadingId];
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
          m_rec_score_field_parameter_new_id: param.m_rec_score_field_parameter_new_id,
          parameter_value: isFile ?
            this.generateFilePath(
              registrationNo,
              paramValue,
              scoreFieldId,
              param.m_rec_score_field_parameter_new_id,
              rowIndex - 1,
              subHeadingId
            ) :
            paramValue === 'FILE_UPLOADED' && existingFilePath ?
            existingFilePath :
            String(paramValue ?? ''),
          parameter_row_index: rowIndex,
          parameter_display_order: param.parameter_display_order || 0,
          verify_remark: 'Not Verified',
          active_status: 'Y',
          delete_flag: 'N',
          action_type: existingParamId ? 'U' : 'C',
          action_date: new Date().toISOString(),
          action_remark: existingParamId ? 'parameter updated' : 'parameter inserted',
          action_ip_address: '127.0.0.1',
          action_by: 1,
        };
        finalParameterList.push(parameter);
        if (isFile) {
          const fileControlName = `file_${subHeadingId}_${scoreFieldId}_${param.m_rec_score_field_parameter_new_id}_${param.parameter_display_order || 0}_${rowIndex}`;
          formData.append(fileControlName, paramValue, paramValue.name);
        }
      }
    });
  });

  // ✅ STEP 3: Append the list of parameter IDs to be DELETED.
  if (this.parameterIdsToDelete.length > 0) {
    formData.append(
      'parameterIdsToDelete',
      JSON.stringify(this.parameterIdsToDelete)
    );
  }

  // STEP 4: Create the Parent Record
  const parentRecord = this.createParentRecord(registrationNo, a_rec_adv_main_id);
  if (parentRecord) {
    formData.append('parentScore', JSON.stringify(parentRecord));
  }

  if (finalDetailList.length === 0 && finalParameterList.length === 0 && !parentRecord) {
    this.alertService.alert(true, 'No changes to save.');
    return;
  }

  // STEP 5: Append final lists and make the API call
  formData.append('registration_no', registrationNo.toString());
  formData.append('scoreFieldDetailList', JSON.stringify(finalDetailList));
  formData.append('scoreFieldParameterList', JSON.stringify(finalParameterList));

  this.logFormData('SAVE OR UPDATE PAYLOAD', formData);

  // ✅ Call the NEW API Endpoint
  this.HTTP.postForm(
    '/candidate/postFile/saveOrUpdateQuantityBasedCandidateDetails',
    formData,
    'recruitement'
  ).subscribe({
    next: (res) => {
      this.alertService.alert(false, 'Data saved successfully!');
      // ✅ Clear the delete list on success to prevent re-deleting
      this.parameterIdsToDelete = []; 
      this.getParameterValuesAndPatch(); // Refresh data from DB
      this.cdr.markForCheck();
    },
    error: (err) => {
      console.error('❌ SAVE/UPDATE ERROR:', err);
      this.alertService.alert(
        true,
        'Error saving records: ' + (err.error?.message || err.message)
      );
      this.cdr.markForCheck();
    },
  });
}

  // You might need a helper function for the parent record to avoid duplicating code
  private createParentRecord(
    registrationNo: number,
    a_rec_adv_main_id: number
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
      a_rec_app_main_id: a_rec_adv_main_id,
      a_rec_adv_post_detail_id: this.heading.a_rec_adv_post_detail_id || 252,
      score_field_parent_id: 0,
      m_rec_score_field_id: this.heading.m_rec_score_field_id,
      m_rec_score_field_method_id: 3,
      score_field_value: scoreResult.score_field_value,
      score_field_actual_value: scoreResult.score_field_actual_value,
      score_field_calculated_value: scoreResult.score_field_calculated_value,
      field_marks: parentMaxMarks,
      field_weightage: this.heading.score_field_field_weightage || 0,
      verify_remark: 'Not Verified',
      action_type: 'U',
      action_date: new Date().toISOString(),
      action_ip_address: '127.0.0.1',
      action_remark: 'parent data updated from recruitment form',
      action_by: 1,
      delete_flag: 'N',
    };
  }
}
