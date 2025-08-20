import {
  Component,
  OnInit,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { isDevMode } from '@angular/core';
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
import { forkJoin } from 'rxjs';
import { HttpService } from 'shared';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

interface DetailFormGroup {
  type: FormControl<string | null>;
  [key: string]: FormControl<string | File | null>;
}

@Component({
  selector: 'app-step-4',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, HttpClientModule],
  templateUrl: './step-4.component.html',
  styleUrls: ['./step-4.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step4Component implements OnInit {
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
  // New property to organize rows by subheading

  constructor(
    private fb: FormBuilder,
    private HTTP: HttpService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      subHeadings: this.fb.group({}),
      details: this.fb.array<FormGroup<DetailFormGroup>>([]),
    });
  }

  get detailsArray(): FormArray<FormGroup<DetailFormGroup>> {
    return this.form.get('details') as FormArray<FormGroup<DetailFormGroup>>;
  }

  ngOnInit(): void {
    this.loadFormStructure();
    this.form.get('subHeadings')?.valueChanges.subscribe(() => {
      this.generateDetailsTable();
      this.cdr.detectChanges();
    });
    this.form.valueChanges.subscribe((values) => {
      if (isDevMode()) {
        console.log('Form values:', JSON.stringify(values, null, 2));
      }
    });
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
    if (isDevMode()) {
      console.log(
        `hasSubHeadingRows(${subHeadingId}):`,
        hasRows,
        this.subHeadingDetails[key]
      );
    }
    return hasRows;
  }

  getCountOptions(maxRows: number | undefined): number[] {
    const count = maxRows && maxRows > 0 ? maxRows : 10;
    return Array.from({ length: count }, (_, i) => i + 1);
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
    if (isDevMode()) {
      console.log(`getRowsForSubHeading(${subHeadingId}):`, rows);
    }
    return rows;
  }

  getParametersForSubHeading(subHeadingId: number | string): any[] {
    return this.subHeadingParameters[subHeadingId.toString()] || [];
  }

  getFilePath(
    scoreFieldId: string | null | undefined,
    paramId: number
  ): string | null {
    if (!scoreFieldId) return null;
    return this.filePaths.get(`${scoreFieldId}_${paramId}`) || null;
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

private getParameterValuesAndPatch(): void {
  const registrationNo = 24000001;
  const a_rec_adv_main_id = 95;
  const score_field_parent_id = 18;

  this.HTTP.getData(
    `/candidate/get/getParameterValues?registration_no=${registrationNo}&a_rec_app_main_id=${a_rec_adv_main_id}&score_field_parent_id=${score_field_parent_id}`,
    'recruitement'
  ).subscribe({
    next: (res: any) => {
      const savedData = res.body?.data || res.data || [];
      const allParameters = Object.values(this.subHeadingParameters).flat();
      const paramIdToNameMap: Record<number, string> = {};
      allParameters.forEach((p) => {
        paramIdToNameMap[p.m_rec_score_field_parameter_id] = p.normalizedKey;
      });

      // Initialize all counts as null first
      this.subHeadings.forEach((subHeading) => {
        const groupName = subHeading.m_rec_score_field_id.toString();
        const subGroup = this.form.get(`subHeadings.${groupName}`) as FormGroup;

        subHeading.items.forEach((item: any) => {
          subGroup
            .get(`${item.normalizedKey}.count`)
            ?.setValue(null, { emitEvent: false });
        });
      });

      // Clear filePaths to avoid stale data
      this.filePaths.clear();

      if (savedData.length > 0) {
        const savedDataMap: Record<string, any> = {};
        savedData.forEach((item: any) => {
          const key = `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_id}`;
          if (!savedDataMap[key]) {
            savedDataMap[key] = [];
          }
          savedDataMap[key].push(item);

          this.existingDetailIds.set(
            `${item.m_rec_score_field_id}`,
            item.a_rec_app_score_field_detail_id
          );
          this.existingParameterIds.set(
            `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_id}`,
            item.a_rec_app_score_field_parameter_detail_id
          );

          // Store file paths for parameters with .pdf values
          if (item.parameter_value.includes('.pdf')) {
            this.filePaths.set(
              `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_id}`,
              item.parameter_value
            );
          }
        });

        // Set counts
        this.subHeadings.forEach((subHeading) => {
          const groupName = subHeading.m_rec_score_field_id.toString();
          const subGroup = this.form.get(`subHeadings.${groupName}`) as FormGroup;

          subHeading.items.forEach((item: any) => {
            const key = item.normalizedKey;
            const savedRows = savedData.filter(
              (d: any) =>
                d.m_rec_score_field_id.toString() ===
                item.m_rec_score_field_id.toString()
            );
            const count =
              savedRows.length > 0
                ? Math.ceil(
                    savedRows.length /
                      (this.subHeadingParameters[
                        subHeading.m_rec_score_field_id
                      ]?.length || 1)
                  )
                : 0;

            subGroup
              .get(`${key}.count`)
              ?.setValue(count === 0 ? null : count.toString(), {
                emitEvent: false,
              });
          });
        });
      }

      this.generateDetailsTable();

      if (savedData.length > 0) {
        savedData.forEach((item: any) => {
          const scoreFieldId = item.m_rec_score_field_id.toString();
          const paramName =
            paramIdToNameMap[item.m_rec_score_field_parameter_id];

          if (!paramName) return;

          const matchingRowIndex = this.detailsArray.controls.findIndex(
            (control) => control.get('type')?.value === scoreFieldId
          );

          if (matchingRowIndex !== -1) {
            const row = this.detailsArray.at(matchingRowIndex) as FormGroup;

            if (item.parameter_value.includes('.pdf')) {
              const paramKey = `${scoreFieldId}_${item.m_rec_score_field_parameter_id}`;
              this.filePaths.set(paramKey, item.parameter_value);
              row.get(paramName)?.setValue(null, { emitEvent: false });
            } else {
              row.get(paramName)?.setValue(item.parameter_value, { emitEvent: false });
            }
          }
        });
      }

      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('Prefill failed', err);
      this.initializeFormWithDefaults();
    },
  });
}
  private initializeFormWithDefaults(): void {
    this.subHeadings.forEach((subHeading) => {
      const groupName = subHeading.m_rec_score_field_id.toString();
      const subGroup = this.form.get(`subHeadings.${groupName}`) as FormGroup;

      subHeading.items.forEach((item: any) => {
        const key = item.normalizedKey;
        subGroup.get(`${key}.count`)?.setValue('', { emitEvent: false });
      });
    });

    this.generateDetailsTable();
    this.cdr.markForCheck();
  }

  loadFormStructure() {
    const a_rec_adv_main_id = 95;
    const m_rec_score_field_id = 18;

    this.HTTP.getData(
      `/master/get/getHeadingByScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&m_rec_score_field_id=${m_rec_score_field_id}`,
      'recruitement'
    ).subscribe({
      next: (headingResponse: any) => {
        const data = headingResponse.body?.data || headingResponse.data || [];
        this.score_field_title_name =
          data[0]?.score_field_title_name || 'Academic Excellence';
        const a_rec_adv_post_detail_id =
          data[0]?.a_rec_adv_post_detail_id || 244;

        this.HTTP.getData(
          `/master/get/getSubHeadingByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&score_field_parent_id=${m_rec_score_field_id}&a_rec_adv_post_detail_id=${a_rec_adv_post_detail_id}`,
          'recruitement'
        ).subscribe({
          next: (subHeadingResponse: any) => {
            const subHeadingData = subHeadingResponse.body?.data || [];
            this.subHeadings = subHeadingData.map((sub: any) => ({
              ...sub,
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
                `/master/get/getSubHeadingParameterByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&m_rec_score_field_id=${sub.m_rec_score_field_id}&a_rec_adv_post_detail_id=${a_rec_adv_post_detail_id}`,
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
                  this.subHeadings[index].items = itemData.map((item: any) => ({
                    ...item,
                    normalizedKey: this.normalizeControlName(
                      item.score_field_name_e
                    ),
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
                  const subHeadingId = this.subHeadings[index].m_rec_score_field_id.toString();
                  this.subHeadingParameters[subHeadingId] = paramData;
                  if (isDevMode()) {
                    console.log(`Parameters for subHeading ${subHeadingId}:`, JSON.stringify(paramData, null, 2));
                  }
                });

                this.getParameterValuesAndPatch();
                this.cdr.detectChanges();
              },
              error: () => {
                this.parameters = [];
                this.subHeadingDetails = {};
                this.generateDetailsTable();
                this.getParameterValuesAndPatch();
                this.cdr.detectChanges();
              },
            });
          },
          error: () => {
            this.subHeadings = [];
            this.subHeadingDetails = {};
            this.generateDetailsTable();
            this.getParameterValuesAndPatch();
            this.cdr.detectChanges();
          },
        });
      },
      error: () => {
        this.score_field_title_name = 'Academic Excellence';
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
    this.subHeadings.forEach((subHeading) => {
      const groupName = subHeading.m_rec_score_field_id.toString();
      const subGroup = this.form.get(`subHeadings.${groupName}`) as FormGroup;
      if (subGroup) {
        subHeading.items.forEach((item: any) => {
          const countControl = subGroup.get(`${item.normalizedKey}.count`);
          if (countControl) {
            if (this.isEditing) {
              countControl.enable();
            } else {
              countControl.disable();
            }
          }
        });
      }
    });

    if (!this.isEditing) {
      setTimeout(() => {
        this.generateDetailsTable();
      }, 100);
    }

    this.cdr.markForCheck();
  }

generateDetailsTable() {
  if (this.isGeneratingTable) {
    return;
  }

  this.isGeneratingTable = true;

  try {
    // Preserve existing valid data, including files
    const existingData: { [key: string]: any[] } = {};
    const existingFiles: { [key: string]: File | null } = {};
    this.detailsArray.controls.forEach((control, index) => {
      const typeValue = control.get('type')?.value;
      if (typeValue && control.valid) {
        if (!existingData[typeValue]) {
          existingData[typeValue] = [];
        }
        const rowData = control.getRawValue();
        existingData[typeValue].push(rowData);

        // Store file data using a stable key (typeValue + parameter ID)
        const parameters = this.getParametersForSubHeading(typeValue);
        parameters.forEach((param: any) => {
          const controlName = param.normalizedKey;
          if (rowData[controlName] instanceof File) {
            // Use a key that doesn't rely on index to avoid mismatches
            existingFiles[`${typeValue}_${param.m_rec_score_field_parameter_id}_${index}`] = rowData[controlName];
          }
        });
      }
    });

    // Preserve existing filePaths
    const preservedFilePaths = new Map(this.filePaths);

    // Clear existing details
    while (this.detailsArray.length > 0) {
      this.detailsArray.removeAt(0);
    }

    // Initialize subHeadingDetails
    this.subHeadingDetails = {};
    this.subHeadings.forEach((sub) => {
      const key = sub.m_rec_score_field_id.toString();
      this.subHeadingDetails[key] = this.subHeadingDetails[key] || [];
    });

    // Track row indices for each type to restore files correctly
    const rowIndices: { [key: string]: number } = {};

    this.subHeadings.forEach((subHeading) => {
      const groupName = subHeading.m_rec_score_field_id.toString();
      const subGroup = this.form.get(['subHeadings', groupName]) as FormGroup;
      const parametersForSubHeading = this.getParametersForSubHeading(groupName);

      if (!subGroup || parametersForSubHeading.length === 0) {
        if (isDevMode()) {
          console.log(`Skipping subHeading ${groupName}: No subGroup or parameters`);
        }
        return;
      }

      const subGroupRaw = subGroup.getRawValue() || {};

      subHeading.items.forEach((item: any) => {
        const key = item.normalizedKey;
        const control = subGroupRaw[key];
        const count = control?.count ? parseInt(control.count, 10) : 0;

        if (isNaN(count) || count <= 0) {
          if (isDevMode()) {
            console.log(`No rows for item ${key} in subHeading ${groupName}: count=${count}`);
          }
          return;
        }

        const typeValue = item.m_rec_score_field_id.toString();
        if (!rowIndices[typeValue]) {
          rowIndices[typeValue] = 0;
        }

        for (let i = 0; i < count; i++) {
          const detailGroup: DetailFormGroup = {
            type: this.fb.control(
              {
                value: typeValue,
                disabled: true,
              },
              [Validators.required]
            ),
          };

          parametersForSubHeading.forEach((param: any) => {
            const controlName = param.normalizedKey;
            detailGroup[controlName] = this.fb.control(
              '',
              param.is_mandatory === 'Y' ? [Validators.required] : []
            );
          });

          const newGroup = this.fb.group(detailGroup);
          this.detailsArray.push(newGroup);

          if (!this.subHeadingDetails[groupName]) {
            this.subHeadingDetails[groupName] = [];
          }
          this.subHeadingDetails[groupName].push(newGroup);

          // Restore file and non-file data for this row
          const currentIndex = rowIndices[typeValue];
          const savedData = existingData[typeValue]?.[currentIndex];
          if (savedData) {
            Object.keys(savedData).forEach((key) => {
              if (key !== 'type' && newGroup.get(key)) {
                const control = newGroup.get(key);
                if (control && !control.disabled) {
                  control.setValue(savedData[key], { emitEvent: false });
                }
              }
            });

            // Restore file data
            parametersForSubHeading.forEach((param: any) => {
              const fileKey = `${typeValue}_${param.m_rec_score_field_parameter_id}_${currentIndex}`;
              if (existingFiles[fileKey]) {
                newGroup.get(param.normalizedKey)?.setValue(existingFiles[fileKey], { emitEvent: false });
              }
            });
          }

          rowIndices[typeValue]++;
        }
      });
    });

    // Restore filePaths
    this.filePaths = preservedFilePaths;

    if (isDevMode()) {
      console.log(
        'Existing Files:', existingFiles,
        'Preserved File Paths:', Array.from(preservedFilePaths.entries()),
        'Restored Details Array:', this.detailsArray.controls.map(c => c.getRawValue())
      );
      console.log(
        'SubHeading Details Organization:',
        JSON.stringify(
          Object.keys(this.subHeadingDetails).reduce((acc, key) => {
            acc[key] = this.subHeadingDetails[key].map((group) =>
              group.getRawValue()
            );
            return acc;
          }, {} as { [key: string]: any[] }),
          null,
          2
        )
      );
      console.log(
        'Flat Details Array:',
        JSON.stringify(
          this.detailsArray.controls.map((control) => control.getRawValue()),
          null,
          2
        )
      );
    }
  } catch (error) {
    console.error('Error generating details table:', error);
  } finally {
    this.isGeneratingTable = false;
    this.cdr.detectChanges();
  }
}
onFileChange(event: Event, index: number, controlName: string) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    const detailForm = this.detailsArray.at(index);
    detailForm.patchValue({ [controlName]: file }, { emitEvent: false });

    const detailType = detailForm.get('type')?.value;
    if (detailType) {
      const parameters = this.getParametersForSubHeading(detailType);
      const param = parameters.find((p) => p.normalizedKey === controlName);
      if (param) {
        const scoreFieldId = detailType;
        const paramKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_id}`;
        // Only clear the filePath if a new file is uploaded for this specific parameter
        if (this.filePaths.has(paramKey)) {
          this.filePaths.delete(paramKey);
        }
      }
    }

    this.cdr.markForCheck();
  }
}

  submit() {
    const isDev = isDevMode();
    const anySelected = this.detailsArray.length > 0;

    const subheadingsData = this.subHeadings.reduce((acc, sub) => {
      acc[sub.m_rec_score_field_id] = {
        m_rec_score_field_id: sub.m_rec_score_field_id,
        score_field_title_name: sub.score_field_title_name,
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
      _isValid: isDev || this.form.valid,
      heading: {
        score_field_title_name:
          this.score_field_title_name || 'Academic Excellence',
        m_rec_score_field_id: 18,
        a_rec_adv_post_detail_id: 244,
      },
      subheadings: subheadingsData,
    };

    this.formData.emit(emitData);

    if (isDev || anySelected) {
      this.saveToDatabase();
    } else {
      alert('Please select at least one count for an item.');
    }
  }

  saveToDatabase() {
    const registrationNo = 24000001;
    const a_rec_adv_main_id = 95;
    const formData = new FormData();

    const newDetails: any[] = [];
    const existingDetails: any[] = [];
    const newParameters: any[] = [];
    const existingParameters: any[] = [];

    this.subHeadings.forEach((subHeading) => {
      const groupName = subHeading.m_rec_score_field_id.toString();
      const subGroupRaw =
        (this.form.get(['subHeadings', groupName]) as FormGroup)?.getRawValue() ||
        {};
      const parametersForSubHeading = this.getParametersForSubHeading(groupName);

      subHeading.items.forEach((item: any) => {
        const key = item.normalizedKey;
        const count = parseInt(subGroupRaw[key]?.count, 10) || 0;

        if (count > 0) {
          const matchingRows = this.detailsArray.controls.filter(
            (control) =>
              control.get('type')?.value === item.m_rec_score_field_id.toString()
          );

          matchingRows.forEach((row) => {
            const formValues = row.getRawValue();
            const scoreFieldId = item.m_rec_score_field_id.toString();
            const existingDetailId = this.existingDetailIds.get(scoreFieldId);
            const detail = {
              ...(existingDetailId && {
                a_rec_app_score_field_detail_id: existingDetailId,
              }),
              registration_no: registrationNo,
              a_rec_app_main_id: a_rec_adv_main_id,
              a_rec_adv_post_detail_id:
                subHeading.a_rec_adv_post_detail_id || 244,
              score_field_parent_id: subHeading.score_field_parent_id || 18,
              m_rec_score_field_id:
                item.m_rec_score_field_id || subHeading.m_rec_score_field_id,
              m_rec_score_field_method_id: 3,
              score_field_value: 0,
              score_field_actual_value: 0,
              score_field_calculated_value: 0,
              field_marks: 0,
              field_weightage: 0,
              remark: existingDetailId ? 'row updated' : 'row inserted',
              unique_parameter_display_no: String(
                subHeading.score_field_display_no || 0
              ),
              verify_remark: 'Not Verified',
              active_status: 'Y',
              action_type: existingDetailId ? 'U' : 'C',
              action_ip_address: '127.0.0.1',
              action_remark: existingDetailId
                ? 'data updated from recruitment form'
                : 'data inserted from recruitment form',
              action_by: 1,
              delete_flag: 'N',
            };

            if (existingDetailId) {
              existingDetails.push(detail);
            } else {
              newDetails.push(detail);
            }

            parametersForSubHeading.forEach((param) => {
              const paramValue = formValues[param.normalizedKey];
              const isFile = paramValue instanceof File;
              const displayOrder = param.parameter_display_order || 0;
              const paramKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_id}`;
              const existingParamId = this.existingParameterIds.get(paramKey);
              const existingFilePath = this.filePaths.get(paramKey);

              const parameter = {
                ...(existingParamId && {
                  a_rec_app_score_field_parameter_detail_id: existingParamId,
                }),
                registration_no: registrationNo,
                score_field_parent_id: detail.score_field_parent_id,
                m_rec_score_field_id: detail.m_rec_score_field_id,
                m_rec_score_field_parameter_id:
                  param.m_rec_score_field_parameter_id,
                parameter_value: isFile
                  ? paramValue?.name ?? ''
                  : existingFilePath && !paramValue
                  ? existingFilePath
                  : String(paramValue ?? 'Not Provided'),
                is_active: 'Y',
                parameter_display_no: displayOrder,
                obt_marks: 0,
                unique_parameter_display_no: String(displayOrder),
                verify_remark: 'Not Verified',
                active_status: 'Y',
                action_type: existingParamId ? 'U' : 'C',
                action_date: new Date().toISOString(),
                action_ip_address: '127.0.0.1',
                action_remark: existingParamId
                  ? 'parameter updated from recruitment form'
                  : 'parameter inserted from recruitment form',
                action_by: 1,
                delete_flag: 'N',
              };

              if (existingDetailId) {
                existingParameters.push(parameter);
              } else {
                newParameters.push(parameter);
              }

              if (isFile) {
                const fileControlName = `file_${detail.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}_${displayOrder}`;
                formData.append(fileControlName, paramValue, paramValue.name);
              } else if (existingFilePath && !paramValue) {
                const fileControlName = `file_${detail.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}_${displayOrder}`;
                formData.append(fileControlName, existingFilePath);
              }
            });
          });
        }
      });
    });

    if (newDetails.length > 0) {
      this.saveNewRecords(registrationNo, formData, newDetails, newParameters);
    }

    if (existingDetails.length > 0) {
      this.updateExistingRecords(
        registrationNo,
        formData,
        existingDetails,
        existingParameters
      );
    }

    if (newDetails.length === 0 && existingDetails.length === 0) {
      alert('No data to save. Please add at least one record.');
    }
  }

  private saveNewRecords(
    registrationNo: number,
    formData: FormData,
    details: any[],
    parameters: any[]
  ) {
    const saveFormData = new FormData();
    saveFormData.append('registration_no', registrationNo.toString());
    saveFormData.append('scoreFieldDetailList', JSON.stringify(details));
    saveFormData.append('scoreFieldParameterList', JSON.stringify(parameters));

    Array.from(formData.entries()).forEach(([key, value]) => {
      if (value instanceof File) {
        saveFormData.append(key, value, value.name);
      }
    });

    this.HTTP.postForm(
      '/candidate/postFile/saveCandidateScoreCard',
      saveFormData,
      'recruitement'
    ).subscribe({
      next: (res) => {
        if (res.body?.data) {
          details.forEach((detail, index) => {
            if (res.body.data[index]?.a_rec_app_score_field_detail_id) {
              this.existingDetailIds.set(
                detail.m_rec_score_field_id.toString(),
                res.body.data[index].a_rec_app_score_field_detail_id
              );
            }
          });

          parameters.forEach((param, index) => {
            if (
              res.body.data[index]?.a_rec_app_score_field_parameter_detail_id
            ) {
              const paramKey = `${param.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}`;
              this.existingParameterIds.set(
                paramKey,
                res.body.data[index].a_rec_app_score_field_parameter_detail_id
              );
            }
          });
        }

        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error saving new records:', err);
        alert('Error saving new records: ' + err.message);
      },
    });
  }

  private updateExistingRecords(
    registrationNo: number,
    formData: FormData,
    details: any[],
    parameters: any[]
  ) {
    const updateFormData = new FormData();
    updateFormData.append('registration_no', registrationNo.toString());
    updateFormData.append('scoreFieldDetailList', JSON.stringify(details));
    updateFormData.append(
      'scoreFieldParameterList',
      JSON.stringify(parameters)
    );

    Array.from(formData.entries()).forEach(([key, value]) => {
      if (value instanceof File) {
        updateFormData.append(key, value, value.name);
      }
    });

    this.HTTP.postForm(
      '/candidate/postFile/updateCandidateScoreCard',
      updateFormData,
      'recruitement'
    ).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error updating records:', err);
        alert('Error updating records: ' + err.message);
      },
    });
  }

  private updateIdMaps(response: any) {
    if (response.body?.data) {
      if (response.body.data.new_details) {
        response.body.data.new_details.forEach((detail: any) => {
          if (
            detail.a_rec_app_score_field_detail_id &&
            detail.m_rec_score_field_id
          ) {
            this.existingDetailIds.set(
              detail.m_rec_score_field_id.toString(),
              detail.a_rec_app_score_field_detail_id
            );
          }
        });
      }

      if (response.body.data.new_parameters) {
        response.body.data.new_parameters.forEach((param: any) => {
          if (
            param.a_rec_app_score_field_parameter_detail_id &&
            param.m_rec_score_field_id &&
            param.m_rec_score_field_parameter_id
          ) {
            const paramKey = `${param.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}`;
            this.existingParameterIds.set(
              paramKey,
              param.a_rec_app_score_field_parameter_detail_id
            );
          }
        });
      }
    }
    this.cdr.markForCheck();
  }
}