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
import { UtilsService } from '../../utils.service';
import { AlertService } from 'shared'; // Assuming 'shared' is the correct path to your AlertService

interface DetailFormGroup {
  type: FormControl<string | null>;
  [key: string]: FormControl<string | File | null>;
}

@Component({
  selector: 'app-step-3',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, HttpClientModule],
  templateUrl: './step-3.component.html',
  styleUrls: ['./step-3.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step3Component implements OnInit {
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
  private originalRowCounts: Map<string, number> = new Map();
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
    }
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
    if (isDevMode()) {
    }
    return rows;
  }

  getParametersForSubHeading(subHeadingId: number | string): any[] {
    return this.subHeadingParameters[subHeadingId.toString()] || [];
  }

  getFilePath(
    scoreFieldId: string | null | undefined,
    paramId: number,
    rowIndex: number
  ): string | null {
    if (!scoreFieldId) return null;

    // ✅ This must match exactly the key generation in generateDetailsTable()
    const key = `${scoreFieldId}_${paramId}_${rowIndex}`;

    const filePath = this.filePaths.get(key);

    if (filePath) {
      console.log(`✅ Found file for key ${key}: ${filePath}`);
    } else {
      console.log(`❌ No file found for key ${key}`);
      console.log(`🔍 All file paths keys:`, Array.from(this.filePaths.keys()));
    }

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

  private getParameterValuesAndPatch(): void {
    const registrationNo = 24000001;
    const a_rec_adv_main_id = 96;

    const subheadingIds = Object.keys(this.subHeadingDetails);

    if (subheadingIds.length === 0) {
      return;
    }

    const requests = subheadingIds.map((subId) =>
      this.HTTP.getData(
        `/candidate/get/getParameterValues?registration_no=${registrationNo}&a_rec_app_main_id=${a_rec_adv_main_id}&score_field_parent_id=${subId}`,
        'recruitement'
      )
    );

    forkJoin(requests).subscribe({
      next: (responses: any[]) => {
        const savedData = responses.flatMap(
          (res) => res.body?.data || res.data || []
        );
        console.log(
          '📌 Saved data for step-3 from:',
          JSON.stringify(savedData, null, 2)
        );
        this.subHeadings.forEach((subHeading) => {
          const groupName = subHeading.m_rec_score_field_id.toString();
          const subGroup = this.form.get(
            `subHeadings.${groupName}`
          ) as FormGroup;

          subHeading.items.forEach((item: any) => {
            subGroup
              .get(`${item.normalizedKey}.count`)
              ?.setValue(null, { emitEvent: false });
          });
        });

        this.filePaths.clear();

        if (savedData.length > 0) {
          savedData.forEach((item: any) => {
            this.existingDetailIds.set(
              `${item.m_rec_score_field_id}`,
              item.a_rec_app_score_field_detail_id
            );
            this.existingParameterIds.set(
              `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_new_id}`,
              item.a_rec_app_score_field_parameter_detail_id
            );
            const scoreFieldKey = item.m_rec_score_field_id.toString();
            const currentCount = this.originalRowCounts.get(scoreFieldKey) || 0;
            let rowIndex = 0;
            if (item.parameter_value?.includes('.pdf')) {
              // Extract row index from filename pattern: ..._<rowIndex>_<filename>.pdf
              const filename = item.parameter_value.split('/').pop() || '';
              const parts = filename.split('_');
              let rowIndex = 0;

              if (parts.length >= 4) {
                rowIndex = parseInt(parts[3]) || 0;
              }

              this.filePaths.set(
                `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_new_id}_${rowIndex}`,
                item.parameter_value
              );
            }
            if (rowIndex + 1 > currentCount) {
              this.originalRowCounts.set(scoreFieldKey, rowIndex + 1);
            }
          });

          this.subHeadings.forEach((subHeading) => {
            const groupName = subHeading.m_rec_score_field_id.toString();
            const subGroup = this.form.get(
              `subHeadings.${groupName}`
            ) as FormGroup;

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

        this.generateDetailsTable(savedData);
      },
      error: (err) => {
        this.initializeFormWithDefaults();
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
    const a_rec_adv_main_id = 96;
    const m_rec_score_field_id = 8;

    // 🔹 Heading API
    this.HTTP.getData(
      `/master/get/getSubHeadingParameterByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&m_rec_score_field_id=${m_rec_score_field_id}&m_rec_score_field=N`,
      'recruitement'
    ).subscribe({
      next: (headingResponse: any) => {
        const data = headingResponse.body?.data || [];
        console.log('📌 Heading API Response:', JSON.stringify(data, null, 2));

        this.heading = data[0];
        this.score_field_title_name = data[0]?.score_field_title_name;
        console.log('📌 Title name:', this.score_field_title_name);
        const a_rec_adv_post_detail_id = data[0]?.a_rec_adv_post_detail_id;

        // 🔹 SubHeading API
        this.HTTP.getData(
          `/master/get/getSubHeadingByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&score_field_parent_id=${m_rec_score_field_id}&a_rec_adv_post_detail_id=${a_rec_adv_post_detail_id}`,
          'recruitement'
        ).subscribe({
          next: (subHeadingResponse: any) => {
            const subHeadingData = subHeadingResponse.body?.data || [];
            console.log(
              '📌 SubHeading API Response:',
              JSON.stringify(subHeadingData, null, 2)
            );

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
                `/master/get/getSubHeadingParameterByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&m_rec_score_field_id=${sub.m_rec_score_field_id}&score_field_parent_code=${sub.score_field_parent_id}&m_rec_score_field_parameter_new=N&m_parameter_master=Y`,
                'recruitement'
              )
            );

            forkJoin([
              forkJoin(itemRequests),
              forkJoin(paramRequests),
            ]).subscribe({
              next: ([itemResponses, paramResponses]) => {
                console.log('📌 forkJoin completed');

                itemResponses.forEach((res, index) => {
                  const itemData = res.body?.data || [];
                  console.log(
                    `📌 Parameter API Response for subHeading[${index}]`,
                    JSON.stringify(itemData, null, 2)
                  );

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

                  console.log(
                    `📌 Parameter API Response for subHeading[${index}]`,
                    JSON.stringify(paramData, null, 2)
                  );

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
        this.score_field_title_name;
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

  // Add this class property
  private previousCounts: Map<string, number> = new Map();

  toggleEdit() {
    if (this.isGeneratingTable) {
      return;
    }

    this.isEditing = !this.isEditing;

    if (!this.isEditing) {
      // Check if counts actually changed before regenerating
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

        // Update previous counts
        this.previousCounts.set(`${groupName}_${key}`, currentCount);
      });
    });

    return countsChanged;
  }

  private addNewRowsOnly() {
    this.subHeadings.forEach((subHeading) => {
      const groupName = subHeading.m_rec_score_field_id.toString();
      const subGroup = this.form.get(['subHeadings', groupName]) as FormGroup;

      if (!subGroup) return;

      const subGroupRaw = subGroup.getRawValue() || {};
      const parametersForSubHeading =
        this.getParametersForSubHeading(groupName);

      subHeading.items.forEach((item: any) => {
        const key = item.normalizedKey;
        const control = subGroupRaw[key];
        const count = control?.count ? parseInt(control.count, 10) : 0;
        const existingRows = this.getRowsForSubHeading(
          item.m_rec_score_field_id
        ).length;

        // Only add new rows if count > existing rows
        for (let i = existingRows; i < count; i++) {
          const detailGroup: DetailFormGroup = {
            type: this.fb.control(
              {
                value: item.m_rec_score_field_id.toString(),
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
        }
      });
    });
  }

  generateDetailsTable(savedData: any[] = []) {
    console.log('🔄 Generating details table...');
    console.log('📊 Saved data input:', JSON.stringify(savedData, null, 2));
    if (this.isGeneratingTable) {
      console.log('⏸️ Table generation already in progress, skipping');
      return;
    }

    this.isGeneratingTable = true;

    try {
      // Step 1: Preserve existing data and files
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

          const parameters = this.getParametersForSubHeading(typeValue);
          parameters.forEach((param: any) => {
            const controlName = param.normalizedKey;
            if (rowData[controlName] instanceof File) {
              existingFiles[
                `${typeValue}_${param.m_rec_score_field_parameter_new_id}_${index}`
              ] = rowData[controlName];
            }
          });
        }
      });

      // Step 2: Group saved data by scoreFieldId and row index
      const savedDataByType: { [key: string]: any[][] } = {};
      savedData.forEach((item) => {
        const scoreFieldId = item.m_rec_score_field_id.toString();
        const filename = item.parameter_value?.split('/').pop() || '';
        const parts = filename.split('_');
        let rowIndex = 0;
        if (parts.length >= 4) {
          rowIndex = parseInt(parts[3]) || 0;
        }

        if (!savedDataByType[scoreFieldId]) {
          savedDataByType[scoreFieldId] = [];
        }
        if (!savedDataByType[scoreFieldId][rowIndex]) {
          savedDataByType[scoreFieldId][rowIndex] = [];
        }
        savedDataByType[scoreFieldId][rowIndex].push(item);
      });

      // Step 3: Process each subheading and its items
      this.subHeadings.forEach((subHeading) => {
        const groupName = subHeading.m_rec_score_field_id.toString();
        const subGroup = this.form.get(['subHeadings', groupName]) as FormGroup;
        const parametersForSubHeading =
          this.getParametersForSubHeading(groupName);

        if (!subGroup || parametersForSubHeading.length === 0) {
          if (isDevMode()) {
            console.log(`⚠️ No subGroup or parameters for ${groupName}`);
          }
          return;
        }

        const subGroupRaw = subGroup.getRawValue() || {};

        subHeading.items.forEach((item: any) => {
          const key = item.normalizedKey;
          const control = subGroupRaw[key];
          const count = control?.count ? parseInt(control.count, 10) : 0;
          const typeValue = item.m_rec_score_field_id.toString();

          if (isNaN(count) || count <= 0) {
            if (isDevMode()) {
              console.log(`⚠️ Invalid count for ${key}: ${count}`);
            }
            return;
          }

          // Step 4: Get existing rows for this item
          const existingRows = this.getRowsForSubHeading(
            subHeading.m_rec_score_field_id
          ).filter((row) => row.get('type')?.value === typeValue);
          const currentRowCount = existingRows.length;

          // Step 5: Remove excess rows if count decreased
          while (existingRows.length > count) {
            const lastRow = existingRows.pop();
            const index = this.detailsArray.controls.indexOf(lastRow!);
            this.detailsArray.removeAt(index);
            this.subHeadingDetails[groupName] = this.subHeadingDetails[
              groupName
            ].filter((row) => row !== lastRow);
          }

          // Step 6: Add new rows or update existing ones
          for (let i = 0; i < count; i++) {
            let detailGroup: DetailFormGroup;
            let newGroup: FormGroup<DetailFormGroup>;

            if (i < currentRowCount) {
              // Update existing row
              newGroup = existingRows[i];
              detailGroup = newGroup.controls as DetailFormGroup;
            } else {
              // Create new row
              detailGroup = {
                type: this.fb.control({ value: typeValue, disabled: true }, [
                  Validators.required,
                ]),
              };
              parametersForSubHeading.forEach((param: any) => {
                const controlName = param.normalizedKey;
                detailGroup[controlName] = this.fb.control(
                  '',
                  param.is_mandatory === 'Y' ? [Validators.required] : []
                );
              });
              newGroup = this.fb.group(detailGroup);
              this.detailsArray.push(newGroup);
              if (!this.subHeadingDetails[groupName]) {
                this.subHeadingDetails[groupName] = [];
              }
              this.subHeadingDetails[groupName].push(newGroup);
            }

            // Step 7: Restore saved data for this row
            const savedRowGroup = savedDataByType[typeValue]?.[i] || [];
            savedRowGroup.forEach((savedRow: any) => {
              parametersForSubHeading.forEach((param: any) => {
                if (
                  savedRow.m_rec_score_field_parameter_new_id ===
                  param.m_rec_score_field_parameter_new_id
                ) {
                  const paramValue = savedRow.parameter_value;
                  const controlName = param.normalizedKey;
                  const key = `${item.m_rec_score_field_id}_${param.m_rec_score_field_parameter_new_id}_${i}`;

                  console.log(
                    `🔑 Mapping parameter: ${param.score_field_parameter_name}`
                  );
                  console.log(`   Key: ${key}, Value: ${paramValue}`);
                  console.log(
                    `   Current item ID: ${item.m_rec_score_field_id}, Saved row ID: ${savedRow.m_rec_score_field_id}`
                  );

                  if (paramValue?.includes('.pdf')) {
                    this.filePaths.set(key, paramValue);
                    newGroup
                      .get(controlName)
                      ?.setValue(null, { emitEvent: false });
                    console.log(`   📁 Set as file: ${paramValue}`);
                  } else {
                    newGroup
                      .get(controlName)
                      ?.setValue(paramValue, { emitEvent: false });
                    console.log(`   📝 Set as text: ${paramValue}`);
                  }
                }
              });
            });

            // Step 8: Restore cached data (from form before regeneration)
            const cachedRow = existingData[typeValue]?.[i];
            if (cachedRow) {
              Object.keys(cachedRow).forEach((key) => {
                if (key !== 'type' && newGroup.get(key)) {
                  const control = newGroup.get(key);
                  if (control && !control.disabled) {
                    control.setValue(cachedRow[key], { emitEvent: false });
                  }
                }
              });

              parametersForSubHeading.forEach((param: any) => {
                const fileKey = `${typeValue}_${param.m_rec_score_field_parameter_new_id}_${i}`;
                if (existingFiles[fileKey]) {
                  newGroup
                    .get(param.normalizedKey)
                    ?.setValue(existingFiles[fileKey], { emitEvent: false });
                  this.filePaths.delete(fileKey);
                }
              });
            }
          }
        });
      });

      this.cdr.detectChanges();
      console.log('✅ Table generation completed');
    } catch (error) {
      console.error('❌ Error in generateDetailsTable:', error);
    } finally {
      this.isGeneratingTable = false;
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
          const paramKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_new_id}_${index}`;
          if (this.filePaths.has(paramKey)) {
            this.filePaths.delete(paramKey);
          }
        }
      }

      this.cdr.markForCheck();
    }
  }
  private logFormData(title: string, formData: FormData) {
    console.log(`📤 ${title} - FormData contents:`);

    // Log all entries in the FormData
    for (const [key, value] of formData.entries()) {
      if (
        key === 'scoreFieldDetailList' ||
        key === 'scoreFieldParameterList' ||
        key === 'parentScore'
      ) {
        try {
          const parsedValue = JSON.parse(value as string);
          console.log(`   ${key}:`, JSON.stringify(parsedValue, null, 2));
        } catch (e) {
          console.log(`   ${key}:`, value);
        }
      } else if (key.startsWith('file_')) {
        console.log(
          `   ${key}:`,
          value instanceof File ? `File: ${value.name}` : value
        );
      } else {
        console.log(`   ${key}:`, value);
      }
    }
  }

  private logSaveData(details: any[], parameters: any[], parentRecord: any) {
    console.log('💾 SAVE OPERATION - Data being sent:');
    console.log('📋 Details:', JSON.stringify(details, null, 2));
    console.log('📋 Parameters:', JSON.stringify(parameters, null, 2));
    console.log('📋 Parent Record:', JSON.stringify(parentRecord, null, 2));
  }

  private logUpdateData(details: any[], parameters: any[], parentRecord: any) {
    console.log('🔄 UPDATE OPERATION - Data being sent:');
    console.log('📋 Details:', JSON.stringify(details, null, 2));
    console.log('📋 Parameters:', JSON.stringify(parameters, null, 2));
    console.log('📋 Parent Record:', JSON.stringify(parentRecord, null, 2));
  }

  private logExistingIds() {
    console.log(
      '🔍 Existing Detail IDs:',
      Array.from(this.existingDetailIds.entries())
    );
    console.log(
      '🔍 Existing Parameter IDs:',
      Array.from(this.existingParameterIds.entries())
    );
  }
  private generateFilePath(
    registrationNo: number,
    file: File,
    scoreFieldId: number,
    parameterId: number,
    rowIndex: number
  ): string {
    // Sanitize the original filename WITHOUT extension
    const originalName = file.name;
    const fileNameWithoutExt = originalName.replace(/\.[^/.]+$/, ''); // Remove extension

    const sanitizedName = fileNameWithoutExt
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    // Do NOT append .pdf here
    const fileName = `${registrationNo}_${scoreFieldId}_${parameterId}_${rowIndex}_${sanitizedName}`;
    return `recruitment/${registrationNo}/${fileName}`;
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
        m_rec_score_field_id: 8,
        a_rec_adv_post_detail_id: 246,
      },
      subheadings: subheadingsData,
    };
    console.log(
      '📤 Step3 form emitting data:',
      JSON.stringify(emitData, null, 2)
    );
    this.formData.emit(emitData);

    if (isDev || anySelected) {
      this.saveToDatabase();
    } else {
      this.alertService.alert(
        true,
        'Please select at least one count for an item.'
      );
    }
  }
  private async handleExistingFile(
    filePath: string,
    fileControlName: string,
    formData: FormData
  ): Promise<void> {
    try {
      // If it's a path string, we need to fetch the file
      if (typeof filePath === 'string' && filePath.includes('/')) {
        const response = await fetch(`http://192.168.1.57:3500/${filePath}`);
        if (response.ok) {
          const blob = await response.blob();
          const fileName = filePath.split('/').pop() || 'file.pdf';
          const file = new File([blob], fileName, { type: blob.type });
          formData.append(fileControlName, file);
        } else {
          console.warn('⚠️ Could not fetch existing file:', filePath);
          formData.append(fileControlName, filePath);
        }
      } else {
        formData.append(fileControlName, filePath);
      }
    } catch (error) {
      console.error('❌ Error handling existing file:', error);
      formData.append(fileControlName, filePath);
    }
  }

  saveToDatabase() {
    console.log('💾 Starting saveToDatabase process...');
    this.logExistingIds();
    this.logExistingParameterKeys();
    const registrationNo = 24000001;
    const a_rec_adv_main_id = 96;
    const formData = new FormData();

    const newDetails: any[] = [];
    const existingDetails: any[] = [];
    const newParameters: any[] = [];
    const existingParameters: any[] = [];

    // Prepare quantity inputs for parent and child calculations
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
            a_rec_adv_post_detail_id:
              item.a_rec_adv_post_detail_id ||
              subHeading.a_rec_adv_post_detail_id,
          });
        }
      });
    });

    // Parent record calculation
    let parentRecord: any = {};
    if (this.heading) {
      const headingId = this.heading.m_rec_score_field_id;
      console.log('Heading Id for parent record: ', headingId);
      const isParentAndChildSame = this.subHeadings.some(
        (sub) => sub.m_rec_score_field_id === headingId
      );

      if (!isParentAndChildSame) {
        const parentMaxMarks = this.heading.score_field_field_marks || 20; // Fallback to 20 if undefined

        const scoreResult = this.utils.calculateScore(
          3,
          { quantityInputs },
          parentMaxMarks
        );

        parentRecord = {
          registration_no: registrationNo,
          a_rec_app_main_id: a_rec_adv_main_id,
          a_rec_adv_post_detail_id:
            this.heading.a_rec_adv_post_detail_id || 246,
          score_field_parent_id: 0,
          m_rec_score_field_id: this.heading.m_rec_score_field_id,
          m_rec_score_field_method_id: 3,
          score_field_value: scoreResult.score_field_value,
          score_field_actual_value: scoreResult.score_field_actual_value,
          score_field_calculated_value:
            scoreResult.score_field_calculated_value,
          field_marks: parentMaxMarks,
          field_weightage: this.heading.score_field_field_weightage || 0,
          verify_remark: 'Not Verified',
          action_type: 'U',
          action_date: new Date().toISOString(),
          action_ip_address: '127.0.0.1',
          delete_flag: 'N',
        };
        console.log(
          '📌 parentRecord values:',
          JSON.stringify(parentRecord, null, 2)
        );
        console.log(
          '📋 Parent Record Calculation:',
          JSON.stringify(parentRecord, null, 2)
        );
        formData.append('parentScore', JSON.stringify(parentRecord));
      }
    }

    // Child record calculations
    const processedDetails = new Map<
      number,
      { count: number; detail: any; rows: any[] }
    >();
    this.detailsArray.controls.forEach((rowControl, rowIndex) => {
      const typeValue = rowControl.get('type')?.value;
      if (typeValue) {
        const scoreFieldId = Number(typeValue);
        const subHeading = this.subHeadings.find((sub) =>
          sub.items.some(
            (item: any) => item.m_rec_score_field_id === scoreFieldId
          )
        );
        const item = subHeading?.items.find(
          (item: any) => item.m_rec_score_field_id === scoreFieldId
        );

        let detailEntry = processedDetails.get(scoreFieldId);
        if (!detailEntry) {
          const existingDetailId = this.existingDetailIds.get(typeValue);
          const detail = {
            ...(existingDetailId && {
              a_rec_app_score_field_detail_id: existingDetailId,
            }),
            registration_no: registrationNo,
            a_rec_app_main_id: a_rec_adv_main_id,
            a_rec_adv_post_detail_id:
              subHeading?.a_rec_adv_post_detail_id || 246,
            score_field_parent_id: subHeading?.m_rec_score_field_id,
            m_rec_score_field_id: scoreFieldId,
            m_rec_score_field_method_id: 3,
            score_field_value: 0, // Updated below
            score_field_actual_value: 0, // Updated below
            score_field_calculated_value: 0, // Updated below
            field_marks: item?.score_field_field_marks || 0,
            field_weightage:
              item?.score_field_field_weightage ||
              subHeading?.score_field_field_weightage ||
              0,
            remark: existingDetailId ? 'row updated' : 'row inserted',
            unique_parameter_display_no: String(
              subHeading?.score_field_display_no || 0
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
          detailEntry = { count: 0, detail, rows: [] };
          processedDetails.set(scoreFieldId, detailEntry);
        }
        detailEntry.count++;
        detailEntry.rows.push({ rowControl, rowIndex });
      }
    });

    processedDetails.forEach((entry) => {
      const subHeading = this.subHeadings.find(
        (sub) => sub.m_rec_score_field_id === entry.detail.score_field_parent_id
      );
      const item = subHeading?.items.find(
        (item: any) =>
          item.m_rec_score_field_id === entry.detail.m_rec_score_field_id
      );

      // Calculate score for this child record
      const scoreResult = this.utils.calculateQuantityBasedScore(
        [
          {
            scoreFieldId: entry.detail.m_rec_score_field_id,
            quantity: entry.count,
            weightage:
              item?.score_field_field_weightage ||
              subHeading?.score_field_field_weightage ||
              0,
            scoreFieldMarks: item?.score_field_field_marks || 0,
          },
        ],
        item?.score_field_field_marks || 0
      );

      entry.detail.score_field_value = scoreResult.score_field_value;
      entry.detail.score_field_actual_value =
        scoreResult.score_field_actual_value;
      entry.detail.score_field_calculated_value =
        scoreResult.score_field_calculated_value;

      if (entry.detail.action_type === 'C') {
        newDetails.push(entry.detail);
      } else {
        existingDetails.push(entry.detail);
      }

      const subHeadingParameters =
        this.subHeadingParameters[
          entry.detail.score_field_parent_id.toString()
        ] || [];

      entry.rows.forEach(({ rowControl, rowIndex }) => {
        const scoreFieldId = entry.detail.m_rec_score_field_id.toString();
        const originalRowCount = this.originalRowCounts.get(scoreFieldId) || 0;
        const isNewRow = rowIndex >= originalRowCount;

        subHeadingParameters.forEach((param: any) => {
          const paramValue = rowControl.getRawValue()[param.normalizedKey];
          const isFile = paramValue instanceof File;
          const displayOrder = param.parameter_display_order || 0;

          // ✅ For parameter ID lookup: use format WITHOUT row index
          const paramKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_new_id}`;
          let existingParamId: number | undefined;
          // ✅ For file path lookup: use format WITH row index
          if (isNewRow) {
            // ✅ For NEW rows, don't use existing parameter IDs
            console.log(
              `➕ New row detected for ${scoreFieldId}, row ${rowIndex}`
            );
          } else {
            // ✅ For EXISTING rows, try to find the parameter ID
            // Try key WITH row index first
            let paramKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_new_id}_${rowIndex}`;
            existingParamId = this.existingParameterIds.get(paramKey);

            // If not found, try key WITHOUT row index (backward compatibility)
            if (!existingParamId) {
              paramKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_new_id}`;
              existingParamId = this.existingParameterIds.get(paramKey);

              if (existingParamId) {
                console.log(
                  `🔄 Found existing parameter with old key format: ${paramKey}`
                );
              }
            }
          }

          const fileKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_new_id}_${rowIndex}`;
          const existingFilePath = this.filePaths.get(fileKey);

          console.log(`🔍 Looking up parameter ID with key: ${paramKey}`);
          console.log(`🔍 Looking up file path with key: ${fileKey}`);

          const parameter = {
            ...(existingParamId && {
              a_rec_app_score_field_parameter_detail_id: existingParamId,
            }),
            registration_no: registrationNo,
            score_field_parent_id: entry.detail.score_field_parent_id,
            m_rec_score_field_id: entry.detail.m_rec_score_field_id,
            m_rec_score_field_parameter_new_id:
              param.m_rec_score_field_parameter_new_id,
            parameter_value: isFile
              ? this.generateFilePath(
                  registrationNo,
                  paramValue,
                  entry.detail.m_rec_score_field_id,
                  param.m_rec_score_field_parameter_new_id,
                  rowIndex
                )
              : existingFilePath && !paramValue
              ? existingFilePath
              : String(paramValue ?? 'Not Provided'),
            is_active: 'Y',
            parameter_display_no: displayOrder,
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
            row_index: rowIndex,
          };

          if (existingParamId) {
            existingParameters.push(parameter);
            console.log(
              `✅ Found existing parameter ID: ${existingParamId} for key: ${paramKey}`
            );
          } else {
            newParameters.push(parameter);
            console.log(`➕ Creating new parameter for key: ${paramKey}`);
          }

          if (isFile) {
            const fileControlName = `file_${entry.detail.m_rec_score_field_id}_${param.m_rec_score_field_parameter_new_id}_${displayOrder}_${rowIndex}`;
            formData.append(fileControlName, paramValue, paramValue.name);
            console.log(`📁 Added new file: ${fileControlName}`);
          } else if (existingFilePath && !paramValue) {
            const fileControlName = `file_${entry.detail.m_rec_score_field_id}_${param.m_rec_score_field_parameter_new_id}_${displayOrder}_${rowIndex}`;
            formData.append(fileControlName, existingFilePath);
            console.log(`📁 Added existing file path: ${fileControlName}`);
          }
        });
      });
    });
    console.log('🔍 Parameters to be sent:');
    console.log('   New Parameters:', newParameters.length);
    console.log('   Existing Parameters:', existingParameters.length);
    console.log(
      '   New Parameters details:',
      JSON.stringify(newParameters, null, 2)
    );
    console.log(
      '   Existing Parameters details:',
      JSON.stringify(existingParameters, null, 2)
    );
    if (newDetails.length > 0) {
      console.log('➕ NEW RECORDS FOUND:', newDetails.length);
      this.logSaveData(newDetails, newParameters, parentRecord);
      this.saveNewRecords(registrationNo, formData, newDetails, newParameters);
    }

    if (existingDetails.length > 0) {
      console.log('✏️ EXISTING RECORDS FOUND:', existingDetails.length);
      this.logUpdateData(existingDetails, existingParameters, parentRecord);
      this.updateExistingRecords(
        registrationNo,
        formData,
        existingDetails,
        existingParameters
      );
    }

    if (newDetails.length === 0 && existingDetails.length === 0) {
      console.log('❌ NO RECORDS TO SAVE');
      this.alertService.alert(
        true,
        'No data to save. Please add at least one record.'
      );
    }
  }
  private logExistingParameterKeys() {
    console.log('🔑 Existing Parameter Keys:');
    for (const [key, value] of this.existingParameterIds.entries()) {
      console.log(`   ${key} -> ${value}`);
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
    saveFormData.append('parentScore', formData.get('parentScore') as string);

    Array.from(formData.entries()).forEach(([key, value]) => {
      if (key.startsWith('file_')) {
        saveFormData.append(key, value);
      }
    });

    this.HTTP.postForm(
      '/candidate/postFile/saveCandidateScoreCard',
      saveFormData,
      'recruitement'
    ).subscribe({
      next: (res) => {
        console.log('✅ SAVE RESPONSE:', JSON.stringify(res?.body.data));
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
              const paramKey = `${param.m_rec_score_field_id}_${param.m_rec_score_field_parameter_new_id}_${param.unique_parameter_display_no}`;
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
        this.alertService.alert(
          true,
          'Error saving new records: ' + err.message
        );
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
    updateFormData.append('parentScore', formData.get('parentScore') as string);

    Array.from(formData.entries()).forEach(([key, value]) => {
      if (key.startsWith('file_')) {
        updateFormData.append(key, value);
      }
    });
    this.logFormData('UPDATE EXISTING RECORDS', updateFormData);

    this.HTTP.postForm(
      '/candidate/postFile/updateCandidateScoreCard',
      updateFormData,
      'recruitement'
    ).subscribe({
      next: (res) => {
        console.log('✅ UPDATE RESPONSE:', JSON.stringify(res?.body.data));
        this.alertService.alert(false, 'Data saved successfully!');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.alertService.alert(true, 'Error updating records: ' + err.message);
        this.cdr.markForCheck();
      },
    });
  }
}
