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
  existingDetailIds: Map<string, number> = new Map(); // Stores detail IDs for updates
  existingParameterIds: Map<string, number> = new Map(); // Stores parameter IDs for updates

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
  }

  normalizeControlName(name: any): string {
    return typeof name === 'string'
      ? name.toLowerCase().replace(/[^a-z0-9_]/gi, '_')
      : '';
  }

  hasParameter(parameterName: string): boolean {
    return this.parameters.some(
      (p) => p.score_field_parameter_name === parameterName
    );
  }

  hasSubHeadingRows(subHeadingId: number): boolean {
    const key = subHeadingId.toString();
    return !!this.subHeadingRows[key]?.length;
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
    const subHeading = this.subHeadings.find(
      (sub) => sub.m_rec_score_field_id === subHeadingId
    );
    return (
      subHeading?.items.some(
        (item: any) => item.m_rec_score_field_id.toString() === typeValue
      ) || false
    );
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
    const a_rec_adv_main_id = 41;
    const score_field_parent_id = 3096;

    this.HTTP.getData(
      `/candidate/get/getParameterValues?registration_no=${registrationNo}&a_rec_app_main_id=${a_rec_adv_main_id}&score_field_parent_id=${score_field_parent_id}`,
      'recruitement'
    ).subscribe({
      next: (res: any) => {
        const savedData = res.body?.data || res.data || [];
        const paramIdToNameMap: Record<number, string> = {};

        this.parameters.forEach((p) => {
          paramIdToNameMap[p.m_rec_score_field_parameter_id] = p.normalizedKey;
        });

        if (savedData.length > 0) {
          // Group saved data by score_field_id and parameter_id
          const savedDataMap: Record<string, any> = {};
          savedData.forEach((item: any) => {
            const key = `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_id}`;
            if (!savedDataMap[key]) {
              savedDataMap[key] = [];
            }
            savedDataMap[key].push(item);
          });

          // Store IDs for updates
          savedData.forEach((item: any) => {
            const detailKey = `${item.m_rec_score_field_id}`;
            this.existingDetailIds.set(
              detailKey,
              item.a_rec_app_score_field_detail_id
            );

            const paramKey = `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_id}`;
            this.existingParameterIds.set(
              paramKey,
              item.a_rec_app_score_field_parameter_detail_id
            );
          });
        }

        // Initialize form with counts based on saved data
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
                ? Math.ceil(savedRows.length / this.parameters.length)
                : 0;

            subGroup
              .get(`${key}.count`)
              ?.setValue(count.toString(), { emitEvent: false });
          });
        });

        this.generateDetailsTable();

        // Patch values from saved data
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
                this.filePaths.set(
                  `${scoreFieldId}_${item.m_rec_score_field_parameter_id}`,
                  item.parameter_value
                );
                row.get(paramName)?.setValue(null);
              } else {
                row.get(paramName)?.setValue(item.parameter_value);
              }
            }
          });
        }

        this.cdr.markForCheck();
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
    const a_rec_adv_main_id = 41;
    const m_rec_score_field_id = 8;

    this.HTTP.getData(
      `/master/get/getHeadingByScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&m_rec_score_field_id=${m_rec_score_field_id}`,
      'recruitement'
    ).subscribe({
      next: (headingResponse: any) => {
        const data = headingResponse.body?.data || headingResponse.data || [];
        this.score_field_title_name =
          data[0]?.score_field_title_name || 'Academic Excellence';
        const a_rec_adv_post_detail_id =
          data[0]?.a_rec_adv_post_detail_id || 201;

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
              this.subHeadingRows[sub.m_rec_score_field_id.toString()] = [];
            });

            const requests = this.subHeadings.map((sub) =>
              this.HTTP.getData(
                `/master/get/getSubHeadingByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&score_field_parent_id=${sub.m_rec_score_field_id}&a_rec_adv_post_detail_id=${a_rec_adv_post_detail_id}`,
                'recruitement'
              )
            );

            forkJoin(requests).subscribe({
              next: (responses) => {
                responses.forEach((res, index) => {
                  const itemData = res.body?.data || [];
                  this.subHeadings[index].items = itemData.map((item: any) => ({
                    ...item,
                    normalizedKey: this.normalizeControlName(
                      item.score_field_name_e
                    ),
                  }));
                  this.setupSubHeadingForm(this.subHeadings[index]);
                });

                const firstItem = this.subHeadings[0]?.items[0];
                const paramScoreFieldId =
                  firstItem?.score_field_parent_code ||
                  this.subHeadings[0]?.m_rec_score_field_id ||
                  13;

                this.HTTP.getData(
                  `/master/get/getSubHeadingParameterByParentScoreField?a_rec_adv_main_id=${a_rec_adv_main_id}&m_rec_score_field_id=${paramScoreFieldId}&a_rec_adv_post_detail_id=${a_rec_adv_post_detail_id}`,
                  'recruitement'
                ).subscribe({
                  next: (paramResponse: any) => {
                    this.parameters =
                      paramResponse.body?.data
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
                    this.generateDetailsTable();
                    this.getParameterValuesAndPatch();
                  },
                  error: () => {
                    this.parameters = [];
                    this.generateDetailsTable();
                    this.getParameterValuesAndPatch();
                  },
                });
              },
              error: () => {
                this.generateDetailsTable();
                this.getParameterValuesAndPatch();
              },
            });
          },
          error: () => {
            this.subHeadings = [];
            this.generateDetailsTable();
            this.getParameterValuesAndPatch();
          },
        });
      },
      error: () => {
        this.score_field_title_name = 'Academic Excellence';
        this.generateDetailsTable();
        this.getParameterValuesAndPatch();
      },
    });
  }

  setupSubHeadingForm(subHeading: any) {
    const groupName = subHeading.m_rec_score_field_id.toString();
    const subGroup: any = {};

    subHeading.items.forEach((item: any) => {
      subGroup[item.normalizedKey] = this.fb.group({
        count: [{ value: '', disabled: !this.isEditing }, []],
      });
    });

    (this.form.get('subHeadings') as FormGroup).setControl(
      groupName,
      this.fb.group(subGroup)
    );
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    this.subHeadings.forEach((subHeading) => {
      const groupName = subHeading.m_rec_score_field_id.toString();
      const subGroup = this.form.get(`subHeadings.${groupName}`) as FormGroup;
      subHeading.items.forEach((item: any) => {
        const countControl = subGroup.get(`${item.normalizedKey}.count`);
        if (this.isEditing) {
          countControl?.enable();
        } else {
          countControl?.disable();
        }
      });
    });
    if (!this.isEditing) {
      this.generateDetailsTable();
    }
    this.cdr.markForCheck();
  }

  generateDetailsTable() {
    // Store existing form data before clearing
    const existingData: { type: string; values: { [key: string]: any } }[] = [];
    this.detailsArray.controls.forEach((control) => {
      const rawValue = control.getRawValue();
      if (rawValue.type !== null) {
        existingData.push({
          type: rawValue.type,
          values: { ...rawValue },
        });
      }
    });

    // Clear existing data
    this.subHeadingRows = {};
    while (this.detailsArray.length > 0) {
      this.detailsArray.removeAt(0);
    }

    // Rebuild the form
    this.subHeadings.forEach((subHeading) => {
      const groupName = subHeading.m_rec_score_field_id.toString();
      const subGroupRaw =
        (
          this.form.get(['subHeadings', groupName]) as FormGroup
        )?.getRawValue() || {};

      this.subHeadingRows[groupName] = [];

      subHeading.items.forEach((item: any) => {
        const key = item.normalizedKey;
        const control = subGroupRaw[key];
        const count = parseInt(control?.count, 10);

        if (!isNaN(count) && count > 0) {
          this.subHeadingRows[groupName].push({
            type: item.m_rec_score_field_id.toString(),
            count,
          });
        }
      });

      this.subHeadingRows[groupName].forEach((row: any) => {
        for (let i = 0; i < row.count; i++) {
          const detailGroup: DetailFormGroup = {
            type: this.fb.control({ value: row.type, disabled: true }, [
              Validators.required,
            ]),
          };

          this.parameters.forEach((param: any) => {
            const controlName = param.normalizedKey;
            detailGroup[controlName] = this.fb.control('');
          });

          const newGroup = this.fb.group(detailGroup);
          this.detailsArray.push(newGroup);
        }
      });
    });

    // Restore existing data to matching rows
    this.detailsArray.controls.forEach((control, index) => {
      const typeValue = control.get('type')?.value;
      if (typeValue !== null) {
        const matchingExisting = existingData.find(
          (data) => data.type === typeValue
        );
        if (matchingExisting && index < existingData.length) {
          Object.keys(matchingExisting.values).forEach((key) => {
            if (key !== 'type' && control.get(key)) {
              control
                .get(key)
                ?.setValue(matchingExisting.values[key], { emitEvent: false });
            }
          });
        }
      }
    });

    this.cdr.markForCheck();
  }

  onFileChange(event: Event, index: number, controlName: string) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.detailsArray.at(index).patchValue({ [controlName]: file });

      const param = this.parameters.find(
        (p) => p.normalizedKey === controlName
      );
      if (param) {
        const scoreFieldId = this.detailsArray.at(index).get('type')?.value;
        if (scoreFieldId) {
          this.filePaths.delete(
            `${scoreFieldId}_${param.m_rec_score_field_parameter_id}`
          );
        }
      }

      this.cdr.markForCheck();
    }
  }

  submit() {
    const isDev = isDevMode();
    const anySelected = this.detailsArray.length > 0;

    this.formData.emit({
      ...this.form.getRawValue(),
      _isValid: isDev || this.form.valid,
    });

    if (isDev || anySelected) {
      this.saveToDatabase();
    } else {
      alert('Please select at least one count for an item.');
    }
  }

  saveToDatabase() {
    const registrationNo = 24000001;
    const a_rec_adv_main_id = 41;
    const formData = new FormData();

    // Separate arrays for new records and updates
    const newScoreFieldDetailList: any[] = [];
    const updatedScoreFieldDetailList: any[] = [];
    const newScoreFieldParameterList: any[] = [];
    const updatedScoreFieldParameterList: any[] = [];

    // Track if we have any data to save
    let hasDataToSave = false;

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
          const matchingRows = this.detailsArray.controls.filter(
            (control) =>
              control.get('type')?.value ===
              item.m_rec_score_field_id.toString()
          );

          matchingRows.forEach((row) => {
            const formValues = row.getRawValue();
            const scoreFieldId = item.m_rec_score_field_id.toString();

            // Check if this is an existing record
            const existingDetailId = this.existingDetailIds.get(scoreFieldId);

            const detail = {
              ...(existingDetailId && {
                a_rec_app_score_field_detail_id: existingDetailId,
              }),
              registration_no: registrationNo,
              a_rec_app_main_id: a_rec_adv_main_id,
              a_rec_adv_post_detail_id:
                subHeading.a_rec_adv_post_detail_id || 201,
              score_field_parent_id: subHeading.score_field_parent_id || 8,
              m_rec_score_field_id:
                item.m_rec_score_field_id || subHeading.m_rec_score_field_id,
              m_rec_score_field_method_id:
                subHeading.m_rec_score_field_method_id || 0,
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

            // Add to appropriate array
            if (existingDetailId) {
              updatedScoreFieldDetailList.push(detail);
            } else {
              newScoreFieldDetailList.push(detail);
            }

            this.parameters.forEach((param) => {
              const paramValue = formValues[param.normalizedKey];
              const isFile = paramValue instanceof File;
              const displayOrder = param.parameter_display_order || 0;

              const paramKey = `${scoreFieldId}_${param.m_rec_score_field_parameter_id}`;
              const existingParamId = this.existingParameterIds.get(paramKey);

              // Handle empty values
              let finalParamValue = paramValue;
              if (
                (finalParamValue === '' || finalParamValue === null) &&
                existingParamId
              ) {
                const filePath = this.filePaths.get(paramKey);
                finalParamValue = filePath
                  ? this.getFileName(filePath)
                  : 'Not Provided';
              } else if (finalParamValue === '' || finalParamValue === null) {
                finalParamValue = 'Not Provided';
              }

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
                  : String(finalParamValue ?? 'Not Provided'),
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

              // Add to appropriate array
              if (existingParamId) {
                updatedScoreFieldParameterList.push(parameter);
              } else {
                newScoreFieldParameterList.push(parameter);
              }

              if (isFile) {
                const fileControlName = `file_${detail.m_rec_score_field_id}_${param.m_rec_score_field_parameter_id}_${displayOrder}`;
                formData.append(fileControlName, paramValue, paramValue.name);
              }
            });
          });
        }
      });
    });

    // Check if we have any data to save
    hasDataToSave =
      newScoreFieldDetailList.length > 0 ||
      updatedScoreFieldDetailList.length > 0;

    if (!hasDataToSave) {
      alert('No data to save. Please add at least one record.');
      return;
    }

    // First handle new records
    if (newScoreFieldDetailList.length > 0) {
      const saveFormData = new FormData();
      saveFormData.append('registration_no', registrationNo.toString());
      saveFormData.append(
        'scoreFieldDetailList',
        JSON.stringify(newScoreFieldDetailList)
      );
      saveFormData.append(
        'scoreFieldParameterList',
        JSON.stringify(newScoreFieldParameterList)
      );

      // Copy files for new records
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
          console.log('New records saved successfully');
          // Now handle updates if any
          this.handleUpdates(
            registrationNo,
            updatedScoreFieldDetailList,
            updatedScoreFieldParameterList,
            formData
          );
        },
        error: (err) => {
          console.error('Error saving new records:', err);
          alert('Error saving new records: ' + err.message);
        },
      });
    } else {
      // Only updates to handle
      this.handleUpdates(
        registrationNo,
        updatedScoreFieldDetailList,
        updatedScoreFieldParameterList,
        formData
      );
    }
  }

  private handleUpdates(
    registrationNo: number,
    updatedScoreFieldDetailList: any[],
    updatedScoreFieldParameterList: any[],
    formData: FormData
  ) {
    if (updatedScoreFieldDetailList.length === 0) {
      alert('Data saved successfully!');
      return;
    }

    const updateFormData = new FormData();
    updateFormData.append('registration_no', registrationNo.toString());
    updateFormData.append(
      'scoreFieldDetailList',
      JSON.stringify(updatedScoreFieldDetailList)
    );
    updateFormData.append(
      'scoreFieldParameterList',
      JSON.stringify(updatedScoreFieldParameterList)
    );

    // Copy files for updates
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
        console.log('Updates applied successfully');
        alert('Data saved successfully!');

        // Update our ID maps with any new IDs from the response
        if (res.body?.data) {
          res.body.data.forEach((item: any) => {
            if (item.a_rec_app_score_field_detail_id) {
              this.existingDetailIds.set(
                item.m_rec_score_field_id.toString(),
                item.a_rec_app_score_field_detail_id
              );
            }
            if (item.a_rec_app_score_field_parameter_detail_id) {
              const paramKey = `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_id}`;
              this.existingParameterIds.set(
                paramKey,
                item.a_rec_app_score_field_parameter_detail_id
              );
            }
          });
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error updating records:', err);
        alert('Error updating records: ' + err.message);
        this.cdr.markForCheck();
      },
    });
  }
}
