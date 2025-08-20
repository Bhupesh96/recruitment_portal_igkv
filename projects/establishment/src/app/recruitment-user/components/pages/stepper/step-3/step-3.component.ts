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

  constructor(
    private fb: FormBuilder,
    private HTTP: HttpService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private utils: UtilsService
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
    paramId: number,
    rowIndex: number
  ): string | null {
    if (!scoreFieldId) return null;
    const key = `${scoreFieldId}_${paramId}_${rowIndex}`;
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
    const a_rec_adv_main_id = 95;

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
          '✅ Combined savedData for Step-3:',
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
              `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_id}`,
              item.a_rec_app_score_field_parameter_detail_id
            );

            if (item.parameter_value?.includes('.pdf')) {
              this.filePaths.set(
                `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_id}`,
                item.parameter_value
              );
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
        console.error('❌ Prefill failed', err);
        this.initializeFormWithDefaults();
      },
    });
  }

  private initializeFormWithDefaults(): void {
    this.subHeadings.forEach((subHeading) => {
      const groupName = subHeading.m_rec_score_field_id.toString();
      const subGroup = this.form.get(`subHeadings.${groupName}`) as FormGroup;

      subHeading.items.forEach((item: any) => {
        subGroup.get(`${item.normalizedKey}.count`)?.setValue('', { emitEvent: false });
      });
    });

    this.generateDetailsTable();
    this.cdr.markForCheck();
  }

  loadFormStructure() {
    const a_rec_adv_main_id = 95;
    const m_rec_score_field_id = 8;

    this.HTTP.getData(
      `/master/get/getHeadingByScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&m_rec_score_field_id=${m_rec_score_field_id}`,
      'recruitement'
    ).subscribe({
      next: (headingResponse: any) => {
        const data = headingResponse.body?.data || headingResponse.data || [];
        console.log('Heading Data:', JSON.stringify(data, null, 2));
        this.heading = data[0];
        this.score_field_title_name =
          data[0]?.score_field_title_name || 'Academic Excellence';
        if (!data[0]?.score_field_field_marks) {
          console.warn('Warning: Heading score_field_field_marks is missing or zero');
        }
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
                  const subHeadingId =
                    this.subHeadings[index].m_rec_score_field_id.toString();
                  this.subHeadingParameters[subHeadingId] = paramData;
                  if (isDevMode()) {
                    console.log(
                      `Parameters for subHeading ${subHeadingId}:`,
                      JSON.stringify(paramData, null, 2)
                    );
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

  generateDetailsTable(savedData: any[] = []) {
    console.log(
      'saved data for generating table ',
      JSON.stringify(savedData, null, 2)
    );

    if (this.isGeneratingTable) {
      return;
    }

    this.isGeneratingTable = true;

    try {
      const existingData: { [key: string]: any[] } = {};
      const existingFiles: { [key: string]: File | null } = {};

      const preservedFilePaths = new Map(this.filePaths);

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
                `${typeValue}_${param.m_rec_score_field_parameter_id}_${index}`
              ] = rowData[controlName];
            }
          });
        }
      });

      while (this.detailsArray.length > 0) {
        this.detailsArray.removeAt(0);
      }

      this.subHeadingDetails = {};
      this.subHeadings.forEach((sub) => {
        const key = sub.m_rec_score_field_id.toString();
        this.subHeadingDetails[key] = this.subHeadingDetails[key] || [];
      });

      this.filePaths = preservedFilePaths;

      this.subHeadings.forEach((subHeading) => {
        const groupName = subHeading.m_rec_score_field_id.toString();
        const subGroup = this.form.get(['subHeadings', groupName]) as FormGroup;
        const parametersForSubHeading =
          this.getParametersForSubHeading(groupName);

        if (!subGroup || parametersForSubHeading.length === 0) {
          if (isDevMode()) {
            console.log(
              `Skipping subHeading ${groupName}: No subGroup or parameters`
            );
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
              console.log(
                `No rows for item ${key} in subHeading ${groupName}: count=${count}`
              );
            }
            return;
          }

          const typeValue = item.m_rec_score_field_id.toString();

          const savedRowsForType = savedData.filter(
            (d) => d.m_rec_score_field_id.toString() === typeValue
          );

          savedRowsForType.sort(
            (a, b) => a.parameter_sequence_id - b.parameter_sequence_id
          );

          const parametersPerRow = parametersForSubHeading.length || 1;
          const logicalRows: any[][] = [];
          for (let i = 0; i < savedRowsForType.length; i += parametersPerRow) {
            logicalRows.push(savedRowsForType.slice(i, i + parametersPerRow));
          }

          if (isDevMode()) {
            console.log(
              `Logical rows for type ${typeValue}:`,
              JSON.stringify(logicalRows, null, 2)
            );
          }

          for (let i = 0; i < count; i++) {
            const detailGroup: DetailFormGroup = {
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

            const newGroup = this.fb.group(detailGroup);
            this.detailsArray.push(newGroup);

            if (!this.subHeadingDetails[groupName]) {
              this.subHeadingDetails[groupName] = [];
            }
            this.subHeadingDetails[groupName].push(newGroup);

            const savedRowGroup = logicalRows[i];
            if (savedRowGroup) {
              console.log(
                `👉 Patching savedRowGroup for type=${typeValue}, rowIndex=${i}`,
                JSON.stringify(savedRowGroup, null, 2)
              );
              savedRowGroup.forEach((savedRow) => {
                parametersForSubHeading.forEach((param: any) => {
                  if (
                    savedRow.m_rec_score_field_parameter_id ===
                    param.m_rec_score_field_parameter_id
                  ) {
                    const paramValue = savedRow.parameter_value;
                    const controlName = param.normalizedKey;
                    const key = `${typeValue}_${param.m_rec_score_field_parameter_id}_${i}`;
                    console.log(
                      `🔄 Setting control for paramId=${param.m_rec_score_field_parameter_id}, control=${controlName}, key=${key}, value=${paramValue}`
                    );

                    if (paramValue?.includes('.pdf')) {
                      this.filePaths.set(key, paramValue);
                      newGroup
                        .get(controlName)
                        ?.setValue(null, { emitEvent: false });
                    } else {
                      newGroup
                        .get(controlName)
                        ?.setValue(paramValue, { emitEvent: false });
                    }
                  }
                });
              });
            }

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
                const fileKey = `${typeValue}_${param.m_rec_score_field_parameter_id}_${i}`;
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
    } catch (error) {
      console.error('Error generating details table:', error);
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
          const paramKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_id}_${index}`;
          if (this.filePaths.has(paramKey)) {
            this.filePaths.delete(paramKey);
          }
        }
      }

      this.cdr.markForCheck();
    }
  }

  private generateFilePath(
    registrationNo: number,
    file: File,
    scoreFieldId: number,
    parameterId: number,
    displayOrder: number,
    rowIndex: number
  ): string {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const baseName = file.name.split('.').slice(0, -1).join('.');

    const fileName = `${timestamp}_scorecard_${scoreFieldId}_${parameterId}_${displayOrder}_${rowIndex}.${fileExtension}`;
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

    // Prepare quantity inputs for parent and child calculations
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
            weightage: item.score_field_field_weightage || subHeading.score_field_field_weightage || 0,
            scoreFieldMarks: item.score_field_field_marks || 0,
            a_rec_adv_post_detail_id: item.a_rec_adv_post_detail_id || subHeading.a_rec_adv_post_detail_id,
          });
        }
      });
    });

    console.log('Quantity Inputs for Parent:', JSON.stringify(quantityInputs, null, 2));

    // Parent record calculation
    let parentRecord: any = {};
    if (this.heading) {
      const headingId = this.heading.m_rec_score_field_id;
      const isParentAndChildSame = this.subHeadings.some(
        (sub) => sub.m_rec_score_field_id === headingId
      );

      if (!isParentAndChildSame) {
        const parentMaxMarks = this.heading.score_field_field_marks || 20; // Fallback to 20 if undefined
        console.log('Parent Max Marks:', parentMaxMarks);
        const scoreResult = this.utils.calculateScore(
          3,
          { quantityInputs },
          parentMaxMarks
        );
        console.log('Parent Score Result:', JSON.stringify(scoreResult, null, 2));
        parentRecord = {
          registration_no: registrationNo,
          a_rec_app_main_id: a_rec_adv_main_id,
          a_rec_adv_post_detail_id: this.heading.a_rec_adv_post_detail_id || 244,
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
              subHeading?.a_rec_adv_post_detail_id || 244,
            score_field_parent_id: subHeading?.m_rec_score_field_id,
            m_rec_score_field_id: scoreFieldId,
            m_rec_score_field_method_id: 3,
            score_field_value: 0, // Updated below
            score_field_actual_value: 0, // Updated below
            score_field_calculated_value: 0, // Updated below
            field_marks: item?.score_field_field_marks || 0,
            field_weightage: item?.score_field_field_weightage || subHeading?.score_field_field_weightage || 0,
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
        (item: any) => item.m_rec_score_field_id === entry.detail.m_rec_score_field_id
      );

      // Calculate score for this child record
      const scoreResult = this.utils.calculateQuantityBasedScore(
        [
          {
            scoreFieldId: entry.detail.m_rec_score_field_id,
            quantity: entry.count,
            weightage: item?.score_field_field_weightage || subHeading?.score_field_field_weightage || 0,
            scoreFieldMarks: item?.score_field_field_marks || 0,
          },
        ],
        item?.score_field_field_marks || 0
      );

      console.log(
        `Child Score Result for scoreFieldId ${entry.detail.m_rec_score_field_id}:`,
        JSON.stringify(scoreResult, null, 2)
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
        this.subHeadingParameters[
          entry.detail.score_field_parent_id.toString()
        ] || [];

      entry.rows.forEach(({ rowControl, rowIndex }) => {
        const scoreFieldId = entry.detail.m_rec_score_field_id.toString();
        const processedParams = new Set<number>();

        subHeadingParameters.forEach((param: any) => {
          if (processedParams.has(param.m_rec_score_field_parameter_id)) {
            return;
          }
          processedParams.add(param.m_rec_score_field_parameter_id);

          const paramValue = rowControl.getRawValue()[param.normalizedKey];
          const isFile = paramValue instanceof File;
          const displayOrder = param.parameter_display_order || 0;
          const paramKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_id}_${rowIndex}`;
          const existingParamId = this.existingParameterIds.get(paramKey);
          const existingFilePath = this.filePaths.get(paramKey);

          const parameter = {
            ...(existingParamId && {
              a_rec_app_score_field_parameter_detail_id: existingParamId,
            }),
            registration_no: registrationNo,
            score_field_parent_id: entry.detail.score_field_parent_id,
            m_rec_score_field_id: entry.detail.m_rec_score_field_id,
            m_rec_score_field_parameter_id:
              param.m_rec_score_field_parameter_id,
            parameter_value: isFile
              ? this.generateFilePath(
                  registrationNo,
                  paramValue,
                  entry.detail.m_rec_score_field_id,
                  param.m_rec_score_field_parameter_id,
                  displayOrder,
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
          };

          if (existingParamId) {
            existingParameters.push(parameter);
          } else {
            newParameters.push(parameter);
          }

          if (isFile) {
            const fileControlName = `file_${entry.detail.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}_${displayOrder}_${rowIndex}`;
            formData.append(fileControlName, paramValue, paramValue.name);
          } else if (existingFilePath && !paramValue) {
            const fileControlName = `file_${entry.detail.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}_${displayOrder}_${rowIndex}`;
            formData.append(fileControlName, existingFilePath);
          }
        });
      });
    });

    console.log(
      JSON.stringify(
        {
          event: 'saveToDatabase_prepared_data',
          newDetails,
          existingDetails,
          newParameters,
          existingParameters,
          formDataEntries: Array.from(formData.entries()).map(
            ([key, value]) => ({
              key,
              value: value instanceof File ? value.name : value,
            })
          ),
        },
        null,
        2
      )
    );

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
      console.log(
        JSON.stringify(
          { event: 'saveToDatabase_no_data', message: 'No data to save' },
          null,
          2
        )
      );
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
    saveFormData.append('parentScore', formData.get('parentScore') as string);

    Array.from(formData.entries()).forEach(([key, value]) => {
      if (key.startsWith('file_')) {
        saveFormData.append(key, value);
      }
    });

    console.log(
      JSON.stringify(
        {
          event: 'saveNewRecords',
          registrationNo,
          details,
          parameters,
          saveFormDataEntries: Array.from(saveFormData.entries()).map(
            ([key, value]) => ({
              key,
              value: value instanceof File ? value.name : value,
            })
          ),
        },
        null,
        2
      )
    );

    this.HTTP.postForm(
      '/candidate/postFile/saveCandidateScoreCard',
      saveFormData,
      'recruitement'
    ).subscribe({
      next: (res) => {
        console.log(
          JSON.stringify(
            { event: 'saveNewRecords_success', response: res.body?.data },
            null,
            2
          )
        );

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
              const paramKey = `${param.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}_${param.unique_parameter_display_no}`;
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
        console.log(
          JSON.stringify(
            { event: 'saveNewRecords_error', error: err.message },
            null,
            2
          )
        );
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
    updateFormData.append('parentScore', formData.get('parentScore') as string);

    Array.from(formData.entries()).forEach(([key, value]) => {
      if (key.startsWith('file_')) {
        updateFormData.append(key, value);
      }
    });

    console.log(
      JSON.stringify(
        {
          event: 'updateExistingRecords',
          registrationNo,
          details,
          parameters,
          updateFormDataEntries: Array.from(updateFormData.entries()).map(
            ([key, value]) => ({
              key,
              value: value instanceof File ? value.name : value,
            })
          ),
        },
        null,
        2
      )
    );

    this.HTTP.postForm(
      '/candidate/postFile/updateCandidateScoreCard',
      updateFormData,
      'recruitement'
    ).subscribe({
      next: (res) => {
        console.log(
          JSON.stringify(
            {
              event: 'updateExistingRecords_success',
              response: res.body?.data,
            },
            null,
            2
          )
        );
        alert('Data saved successfully!');
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.log(
          JSON.stringify(
            { event: 'updateExistingRecords_error', error: err.message },
            null,
            2
          )
        );
        alert('Error updating records: ' + err.message);
        this.cdr.markForCheck();
      },
    });
  }
}