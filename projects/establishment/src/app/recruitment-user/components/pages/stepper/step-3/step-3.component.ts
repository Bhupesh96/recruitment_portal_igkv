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
import { AlertService } from 'shared';

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
  private previousCounts: Map<string, number> = new Map();

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

    // Use 1-based row index to match API
    const key = `${scoreFieldId}_${paramId}_${rowIndex + 1}`;
    return this.filePaths.get(key) || null;
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
      const savedData = responses.flatMap((res) => res.body?.data || res.data || []);
      console.log('📌 Saved data for step-3:', JSON.stringify(savedData, null, 2));

      // Clear existing data
      this.filePaths.clear();
      this.existingDetailIds.clear();
      this.existingParameterIds.clear();
      this.detailsArray.clear();
      this.subHeadingDetails = {};

      // Group saved data by score field and row index
      const savedDataByType: { [key: string]: { [key: number]: any[] } } = {};
      savedData.forEach((item) => {
        const scoreFieldId = item.m_rec_score_field_id.toString();
        const rowIndex = item.parameter_row_index || 1;

        if (!savedDataByType[scoreFieldId]) {
          savedDataByType[scoreFieldId] = {};
        }
        if (!savedDataByType[scoreFieldId][rowIndex]) {
          savedDataByType[scoreFieldId][rowIndex] = [];
        }
        savedDataByType[scoreFieldId][rowIndex].push(item);
      });

      // Update existing IDs and row counts
      savedData.forEach((item) => {
        const scoreFieldId = item.m_rec_score_field_id.toString();
        const rowIndex = item.parameter_row_index || 1;

        this.existingDetailIds.set(scoreFieldId, item.a_rec_app_score_field_detail_id);

        const paramKey = `${scoreFieldId}_${item.m_rec_score_field_parameter_new_id}_${rowIndex}`;
        this.existingParameterIds.set(paramKey, item.a_rec_app_score_field_parameter_detail_id);

        if (item.parameter_value?.includes('/')) {
          const fileKey = `${scoreFieldId}_${item.m_rec_score_field_parameter_new_id}_${rowIndex}`;
          this.filePaths.set(fileKey, item.parameter_value);
        }

        const currentCount = this.originalRowCounts.get(scoreFieldId) || 0;
        if (rowIndex > currentCount) {
          this.originalRowCounts.set(scoreFieldId, rowIndex);
        }
      });

      // Update subheading counts
      this.subHeadings.forEach((subHeading) => {
        const groupName = subHeading.m_rec_score_field_id.toString();
        const subGroup = this.form.get(`subHeadings.${groupName}`) as FormGroup;

        subHeading.items.forEach((item: any) => {
          const key = item.normalizedKey;
          const scoreFieldId = item.m_rec_score_field_id.toString();
          const savedRows = savedDataByType[scoreFieldId] || {};

          const count = Object.keys(savedRows).length;
          subGroup.get(`${key}.count`)?.setValue(count === 0 ? null : count.toString(), {
            emitEvent: false,
          });
        });
      });

      // Generate form rows
      this.subHeadings.forEach((subHeading) => {
        const groupName = subHeading.m_rec_score_field_id.toString();
        const parametersForSubHeading = this.getParametersForSubHeading(groupName);

        subHeading.items.forEach((item: any) => {
          const scoreFieldId = item.m_rec_score_field_id.toString();
          const savedRows = savedDataByType[scoreFieldId] || {};

          Object.keys(savedRows).forEach((rowIndexStr) => {
            const rowIndex = parseInt(rowIndexStr);
            const rowData = savedRows[rowIndex];

            const detailGroup: DetailFormGroup = {
              type: this.fb.control({ value: scoreFieldId, disabled: true }, [
                Validators.required,
              ]),
            };

            parametersForSubHeading.forEach((param: any) => {
              const controlName = param.normalizedKey;
              // Initialize with null for files to indicate no new file is selected
              detailGroup[controlName] = this.fb.control(
                param.control_type === 'A' ? null : '',
                param.is_mandatory === 'Y' ? [Validators.required] : []
              );
            });

            const newGroup = this.fb.group(detailGroup);
            this.detailsArray.push(newGroup);

            if (!this.subHeadingDetails[groupName]) {
              this.subHeadingDetails[groupName] = [];
            }
            this.subHeadingDetails[groupName].push(newGroup);

            // Patch parameter values
            rowData.forEach((item: any) => {
              const param = parametersForSubHeading.find(
                (p: any) =>
                  p.m_rec_score_field_parameter_new_id ===
                  item.m_rec_score_field_parameter_new_id
              );
              if (param) {
                const controlName = param.normalizedKey;
                if (
                  item.parameter_value?.includes('.pdf') ||
                  item.parameter_value?.includes('/')
                ) {
                  // File parameter - store path and set form control to indicate file presence
                  const fileKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_new_id}_${rowIndex}`;
                  this.filePaths.set(fileKey, item.parameter_value);
                  // Set a placeholder value to indicate file presence
                  newGroup.get(controlName)?.setValue('FILE_UPLOADED', { emitEvent: false });
                } else {
                  // Text parameter
                  newGroup.get(controlName)?.setValue(item.parameter_value, { emitEvent: false });
                }
              }
            });
          });
        });
      });

      this.generateDetailsTable(savedData);
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('❌ Error fetching parameter values:', err);
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

generateDetailsTable(savedData: any[] = []) {
  console.log('🔄 Generating details table...');
  console.log('📊 Saved data input:', JSON.stringify(savedData, null, 2));
  if (this.isGeneratingTable) {
    console.log('⏸️ Table generation already in progress, skipping');
    return;
  }

  this.isGeneratingTable = true;

  try {
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
              `${typeValue}_${param.m_rec_score_field_parameter_new_id}_${index + 1}`
            ] = rowData[controlName];
          }
        });
      }
    });

    const savedDataByType: { [key: string]: any[][] } = {};
    savedData.forEach((item) => {
      const scoreFieldId = item.m_rec_score_field_id.toString();
      const filename = item.parameter_value?.split('/').pop() || '';
      const parts = filename.split('_');
      let rowIndex = 1;
      if (parts.length >= 4) {
        rowIndex = parseInt(parts[3]) || 1;
      }

      if (!savedDataByType[scoreFieldId]) {
        savedDataByType[scoreFieldId] = [];
      }
      if (!savedDataByType[scoreFieldId][rowIndex]) {
        savedDataByType[scoreFieldId][rowIndex] = [];
      }
      savedDataByType[scoreFieldId][rowIndex].push(item);
    });

    this.subHeadings.forEach((subHeading) => {
      const groupName = subHeading.m_rec_score_field_id.toString();
      const subGroup = this.form.get(['subHeadings', groupName]) as FormGroup;
      const parametersForSubHeading = this.getParametersForSubHeading(groupName);

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

        const existingRows = this.getRowsForSubHeading(
          subHeading.m_rec_score_field_id
        ).filter((row) => row.get('type')?.value === typeValue);
        const currentRowCount = existingRows.length;

        while (existingRows.length > count) {
          const lastRow = existingRows.pop();
          const index = this.detailsArray.controls.indexOf(lastRow!);
          this.detailsArray.removeAt(index);
          this.subHeadingDetails[groupName] = this.subHeadingDetails[groupName].filter(
            (row) => row !== lastRow
          );
        }

        for (let i = 0; i < count; i++) {
          let detailGroup: DetailFormGroup;
          let newGroup: FormGroup<DetailFormGroup>;
          const rowIndex = i + 1;

          if (i < currentRowCount) {
            newGroup = existingRows[i];
            detailGroup = newGroup.controls as DetailFormGroup;
          } else {
            detailGroup = {
              type: this.fb.control({ value: typeValue, disabled: true }, [
                Validators.required,
              ]),
            };
            parametersForSubHeading.forEach((param: any) => {
              const controlName = param.normalizedKey;
              detailGroup[controlName] = this.fb.control(
                param.control_type === 'A' ? null : '',
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

          const savedRowGroup = savedDataByType[typeValue]?.[rowIndex] || [];

          savedRowGroup.forEach((savedRow: any) => {
            parametersForSubHeading.forEach((param: any) => {
              if (
                savedRow.m_rec_score_field_parameter_new_id ===
                param.m_rec_score_field_parameter_new_id
              ) {
                const paramValue = savedRow.parameter_value;
                const controlName = param.normalizedKey;
                const key = `${item.m_rec_score_field_id}_${param.m_rec_score_field_parameter_new_id}_${rowIndex}`;

                console.log(`🔑 Mapping parameter: ${param.score_field_parameter_name}`);
                console.log(`   Key: ${key}, Value: ${paramValue}`);
                console.log(
                  `   Current item ID: ${item.m_rec_score_field_id}, Saved row ID: ${savedRow.m_rec_score_field_id}`
                );

                if (savedRow.parameter_row_index === rowIndex) {
                  if (
                    paramValue?.includes('.pdf') ||
                    paramValue?.includes('/')
                  ) {
                    this.filePaths.set(key, paramValue);
                    newGroup.get(controlName)?.setValue('FILE_UPLOADED', { emitEvent: false });
                    console.log(`   📁 Set as file: ${paramValue}`);
                  } else {
                    newGroup.get(controlName)?.setValue(paramValue, { emitEvent: false });
                    console.log(`   📝 Set as text: ${paramValue}`);
                  }
                }
              }
            });
          });

          const cachedRow = existingData[typeValue]?.[i];
          if (cachedRow) {
            Object.keys(cachedRow).forEach((key) => {
              if (key !== 'type' && newGroup.get(key)) {
                const control = newGroup.get(key);
                if (control && !control.disabled) {
                  if (cachedRow[key] instanceof File) {
                    control.setValue(cachedRow[key], { emitEvent: false });
                  } else if (cachedRow[key] === 'FILE_UPLOADED') {
                    const fileKey = `${typeValue}_${parametersForSubHeading.find(
                      (p: any) => p.normalizedKey === key
                    )?.m_rec_score_field_parameter_new_id}_${rowIndex}`;
                    if (this.filePaths.has(fileKey)) {
                      control.setValue('FILE_UPLOADED', { emitEvent: false });
                    }
                  } else {
                    control.setValue(cachedRow[key], { emitEvent: false });
                  }
                }
              }
            });
          }
        }
      });
    });

    this.debugFormState();
    this.cdr.detectChanges();
    console.log('✅ Table generation completed');
  } catch (error) {
    console.error('❌ Error in generateDetailsTable:', error);
  } finally {
    this.isGeneratingTable = false;
  }
}

  //remove this after the completion
  private debugFormState() {
    console.log('🔍 Current form state:');
    this.detailsArray.controls.forEach((control, index) => {
      const typeValue = control.get('type')?.value;
      const rawValue = control.getRawValue();
      console.log(
        `   Row ${index + 1} (Type: ${typeValue}):`,
        JSON.stringify(rawValue, null, 2)
      );
    });

    console.log(
      '🔍 File paths:',
      JSON.stringify(Array.from(this.filePaths.entries()))
    );
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
          const paramKey = `${scoreFieldId}_${
            param.m_rec_score_field_parameter_new_id
          }_${index + 1}`;
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

  private logExistingParameterKeys() {
    console.log('🔑 Existing Parameter Keys:');
    for (const [key, value] of this.existingParameterIds.entries()) {
      console.log(`   ${key} -> ${value}`);
    }
  }

  private generateFilePath(
    registrationNo: number,
    file: File,
    scoreFieldId: number,
    parameterId: number,
    rowIndex: number
  ): string {
    const originalName = file.name;
    const fileNameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    const sanitizedName = fileNameWithoutExt
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    const fileName = `${registrationNo}_${scoreFieldId}_${parameterId}_${
      rowIndex + 1
    }_${sanitizedName}`;
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

  const quantityInputs: any[] = [];
  this.subHeadings.forEach((subHeading) => {
    const groupName = subHeading.m_rec_score_field_id.toString();
    const subGroupRaw =
      (this.form.get(['subHeadings', groupName]) as FormGroup)?.getRawValue() || {};
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

  let parentRecord: any = {};
  if (this.heading) {
    const headingId = this.heading.m_rec_score_field_id;
    const isParentAndChildSame = this.subHeadings.some(
      (sub) => sub.m_rec_score_field_id === headingId
    );

    if (!isParentAndChildSame) {
      const parentMaxMarks = this.heading.score_field_field_marks || 20;
      const scoreResult = this.utils.calculateScore(
        3,
        { quantityInputs },
        parentMaxMarks
      );

      parentRecord = {
        registration_no: registrationNo,
        a_rec_app_main_id: a_rec_adv_main_id,
        a_rec_adv_post_detail_id: this.heading.a_rec_adv_post_detail_id || 246,
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
        delete_flag: 'N',
      };
      formData.append('parentScore', JSON.stringify(parentRecord));
    }
  }

  const processedDetails = new Map<
    number,
    { count: number; detail: any; rows: any[] }
  >();
  this.detailsArray.controls.forEach((rowControl, index) => {
    const typeValue = rowControl.get('type')?.value;
    if (typeValue) {
      const scoreFieldId = Number(typeValue);
      const subHeading = this.subHeadings.find((sub) =>
        sub.items.some((item: any) => item.m_rec_score_field_id === scoreFieldId)
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
          a_rec_adv_post_detail_id: subHeading?.a_rec_adv_post_detail_id || 246,
          score_field_parent_id: subHeading?.m_rec_score_field_id,
          m_rec_score_field_id: scoreFieldId,
          m_rec_score_field_method_id: 3,
          score_field_value: 0,
          score_field_actual_value: 0,
          score_field_calculated_value: 0,
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
      detailEntry.rows.push({ rowControl, rowIndex: index });
    }
  });

  processedDetails.forEach((entry) => {
    const subHeading = this.subHeadings.find(
      (sub) => sub.m_rec_score_field_id === entry.detail.score_field_parent_id
    );
    const item = subHeading?.items.find(
      (item: any) => item.m_rec_score_field_id === entry.detail.m_rec_score_field_id
    );

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
    entry.detail.score_field_actual_value = scoreResult.score_field_actual_value;
    entry.detail.score_field_calculated_value = scoreResult.score_field_calculated_value;

    if (entry.detail.action_type === 'C') {
      newDetails.push(entry.detail);
    } else {
      existingDetails.push(entry.detail);
    }

    const subHeadingParameters =
      this.subHeadingParameters[entry.detail.score_field_parent_id.toString()] || [];

    entry.rows.forEach(({ rowControl, rowIndex }) => {
      const scoreFieldId = entry.detail.m_rec_score_field_id.toString();
      const originalRowCount = this.originalRowCounts.get(scoreFieldId) || 0;
      const adjustedRowIndex = rowIndex + 1;
      const isNewRow = adjustedRowIndex > originalRowCount;

      subHeadingParameters.forEach((param: any) => {
        const paramValue = rowControl.getRawValue()[param.normalizedKey];
        const isFile = paramValue instanceof File;
        const displayOrder = param.parameter_display_order || 0;

        const paramKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_new_id}_${adjustedRowIndex}`;
        const existingParamId = isNewRow
          ? undefined
          : this.existingParameterIds.get(paramKey);
        const fileKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_new_id}_${adjustedRowIndex}`;
        const existingFilePath = this.filePaths.get(fileKey);

        console.log(
          `🔍 Parameter key: ${paramKey}, Existing ID: ${existingParamId}`
        );
        console.log(
          `🔍 File key: ${fileKey}, Existing File Path: ${existingFilePath}, Param Value: ${paramValue}`
        );

        const parameter = {
          ...(existingParamId && {
            a_rec_app_score_field_parameter_detail_id: existingParamId,
          }),
          registration_no: registrationNo,
          score_field_parent_id: entry.detail.score_field_parent_id,
          m_rec_score_field_id: entry.detail.m_rec_score_field_id,
          m_rec_score_field_parameter_new_id: param.m_rec_score_field_parameter_new_id,
          parameter_value: isFile
            ? this.generateFilePath(
                registrationNo,
                paramValue,
                entry.detail.m_rec_score_field_id,
                param.m_rec_score_field_parameter_new_id,
                rowIndex // generateFilePath already adds 1
              )
            : paramValue === 'FILE_UPLOADED' && existingFilePath
            ? existingFilePath
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
          parameter_row_index: adjustedRowIndex,
        };

        if (existingParamId) {
          existingParameters.push(parameter);
        } else {
          newParameters.push(parameter);
        }

        if (isFile) {
          const fileControlName = `file_${entry.detail.m_rec_score_field_id}_${param.m_rec_score_field_parameter_new_id}_${displayOrder}_${adjustedRowIndex}`;
          formData.append(fileControlName, paramValue, paramValue.name);
          console.log(`📁 Added new file: ${fileControlName}`);
        } else if (existingFilePath && (paramValue === 'FILE_UPLOADED' || !paramValue)) {
          const fileControlName = `file_${entry.detail.m_rec_score_field_id}_${param.m_rec_score_field_parameter_new_id}_${displayOrder}_${adjustedRowIndex}`;
          this.handleExistingFile(existingFilePath, fileControlName, formData);
          console.log(`📁 Added existing file path: ${fileControlName}`);
        }
      });
    });
  });

  if (newDetails.length > 0) {
    this.logSaveData(newDetails, newParameters, parentRecord);
    this.saveNewRecords(registrationNo, formData, newDetails, newParameters);
  }

  if (existingDetails.length > 0) {
    this.logUpdateData(existingDetails, existingParameters, parentRecord);
    this.updateExistingRecords(
      registrationNo,
      formData,
      existingDetails,
      existingParameters
    );
  }

  if (newDetails.length === 0 && existingDetails.length === 0) {
    this.alertService.alert(
      true,
      'No data to save. Please add at least one record.'
    );
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
              const paramKey = `${param.m_rec_score_field_id}_${param.m_rec_score_field_parameter_new_id}_${param.parameter_row_index}`;
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
