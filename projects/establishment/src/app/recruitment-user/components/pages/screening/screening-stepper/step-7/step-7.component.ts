import {
  Component,
  OnInit,
  Output,
  EventEmitter,
  ChangeDetectorRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpService } from 'shared';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { AlertService } from 'shared';
interface AttachmentMeta {
  score_field_name_e: string;
  display_order_no: number;
  score_field_parent_code: number;
  m_rec_score_field_id: number;
  a_rec_adv_post_detail_id?: number;
  m_rec_score_field_parameter_id?: number;
}

interface SavedParameter {
  a_rec_app_score_field_detail_id?: number;
  a_rec_app_score_field_parameter_detail_id?: number;
  m_rec_score_field_id: number;
  m_rec_score_field_parameter_id: number;
  parameter_value: string;
  remark: string;
}

@Component({
  selector: 'app-step-7',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './step-7.component.html',
  styleUrls: ['./step-7.component.scss'],
})
export class Step7Component implements OnInit {
  @Output() formData = new EventEmitter<{ [key: string]: any }>();
  form: FormGroup;
  attachmentMeta: AttachmentMeta[] = [];
  filePaths: Map<string, string> = new Map();
  registrationNo = 24000001;
  a_rec_adv_main_id = 115;
  score_field_parent_id = 3147;
  a_rec_adv_post_detail_id = 72;
  m_rec_score_field_method_id = 1;
  m_rec_score_field_parameter_id = 11;

  existingDetailIds: Map<number, number> = new Map();
  existingParameterIds: Map<string, number> = new Map();
  isSubmitting = false;
  formValid = false;

  constructor(
    private fb: FormBuilder,
    private HTTP: HttpService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private alertService: AlertService
  ) {
    this.form = this.fb.group({
      attachments: this.fb.array([]),
    });
  }

  get attachmentsArray(): FormArray {
    return this.form.get('attachments') as FormArray;
  }

  ngOnInit(): void {
    this.loadAttachmentFields();
    this.form.valueChanges.subscribe(() => {
      this.checkFormValidity();
    });
  }

  private checkFormValidity(): void {
    let isValid = true;

    this.attachmentsArray.controls.forEach((control, index) => {
      const meta = this.attachmentMeta[index];
      // if (meta && this.isMandatory(meta)) {
      //   const controlDoc = control.get('document');
      //   const hasDocument = controlDoc?.value;
      //   const hasExistingFile = this.filePaths.has(`${meta.m_rec_score_field_id}_${this.m_rec_score_field_parameter_id}`);
      //   if (!hasDocument && !hasExistingFile) {
      //     isValid = false;
      //   }
      // }
    });

    this.formValid = isValid;
    this.formData.emit({ ...this.form.value, _isValid: this.formValid });
    this.cdr.detectChanges();
  }

  loadAttachmentFields(): void {
    const parentCode = 3147;
    this.HTTP.getData(
      `/master/get/getOtherAttachment?score_field_parent_code=${parentCode}`,
      'recruitement'
    ).subscribe({
      next: (res: any) => {
        if (res?.body?.data?.length > 0) {
          this.attachmentMeta = (res.body.data as AttachmentMeta[]).sort(
            (a: AttachmentMeta, b: AttachmentMeta) =>
              a.display_order_no - b.display_order_no
          );
          this.initializeForm();
          this.loadSavedParameterValues();
        } else {
          this.initializeForm();
        }
      },
      error: (err: any) => {
        this.initializeForm();
      },
    });
  }

  private initializeForm(): void {
    while (this.attachmentsArray.length > 0) {
      this.attachmentsArray.removeAt(0);
    }

    this.attachmentMeta.forEach((field) => {
      const isMandatory = this.isMandatory(field);
      this.attachmentsArray.push(
        this.createAttachmentGroup(field.score_field_name_e, isMandatory)
      );
    });
    this.checkFormValidity();
  }

  loadSavedParameterValues(): void {
    const { registrationNo, a_rec_adv_main_id, score_field_parent_id } = this;
    this.HTTP.getData(
      `/candidate/get/getParameterValues?registration_no=${registrationNo}&a_rec_app_main_id=${a_rec_adv_main_id}&score_field_parent_id=${score_field_parent_id}`,
      'recruitement'
    ).subscribe({
      next: (res: any) => {
        const savedData = this.normalizeApiResponse(res);

        if (savedData.length > 0) {
          savedData.forEach((item: SavedParameter) => {
            const index = this.attachmentMeta.findIndex(
              (m) => m.m_rec_score_field_id === item.m_rec_score_field_id
            );

            if (index !== -1) {
              if (item.a_rec_app_score_field_detail_id) {
                this.existingDetailIds.set(
                  item.m_rec_score_field_id,
                  item.a_rec_app_score_field_detail_id
                );
              }

              const paramKey = `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_id}`;
              if (item.a_rec_app_score_field_parameter_detail_id) {
                this.existingParameterIds.set(
                  paramKey,
                  item.a_rec_app_score_field_parameter_detail_id
                );
              }

              const formGroup = this.attachmentsArray.at(index);
              formGroup.patchValue({
                remark: item.remark || '',
                document: null,
              });

              if (
                item.parameter_value &&
                item.parameter_value.includes('.pdf')
              ) {
                this.filePaths.set(paramKey, item.parameter_value);
              }
            }
          });
          this.checkFormValidity();
        }
      },
      error: (err: any) => {},
    });
  }

  private normalizeApiResponse(res: any): SavedParameter[] {
    let data = res?.body?.data || res?.data || [];

    if (Array.isArray(data)) {
      return data;
    } else if (typeof data === 'object' && data !== null) {
      return [data];
    }

    return [];
  }

  isMandatory(field: AttachmentMeta): boolean {
    const mandatoryKeywords = ['Domicile', 'Caste', 'Non Creamy', '10th'];
    return mandatoryKeywords.some((key) =>
      field.score_field_name_e.toLowerCase().includes(key.toLowerCase())
    );
  }

  createAttachmentGroup(name: string, isMandatory: boolean): FormGroup {
    return this.fb.group({
      name: [{ value: name, disabled: true }],
      document: [null, isMandatory ? [Validators.required] : []],
      remark: [''],
    });
  }

  onFileChange(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.attachmentsArray.at(index).patchValue({ document: file });

      const meta = this.attachmentMeta[index];
      if (meta) {
        const paramKey = `${meta.m_rec_score_field_id}_${this.m_rec_score_field_parameter_id}`;
        this.filePaths.delete(paramKey);
      }
      this.checkFormValidity();
    }
  }

  getFilePath(scoreFieldId: number, paramId: number): string | null {
    const filePath = this.filePaths.get(`${scoreFieldId}_${paramId}`);
    return filePath || null;
  }

  sanitizeFileUrl(filePath: string): SafeUrl {
    let fileName = filePath.split('\\').pop() || '';
    fileName = fileName.replace(/\.pdf\.pdf$/, '.pdf');
    const url = `http://192.168.1.57:3500/${fileName}`;
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  viewDocument(index: number): void {
    const control = this.attachmentsArray.at(index);
    const file = control.get('document')?.value;
    const meta = this.attachmentMeta[index];
    if (!meta) return;

    if (file instanceof File) {
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
    } else {
      const filePath = this.getFilePath(
        meta.m_rec_score_field_id,
        this.m_rec_score_field_parameter_id
      );
      if (filePath) {
        const safeUrl = this.sanitizeFileUrl(filePath);
        window.open(safeUrl as string, '_blank');
      }
    }
  }

  async submit(): Promise<void> {
    this.isSubmitting = true;

    try {
      if (!this.formValid) {
        const missingFields = this.getMissingFields();
        this.alertService.alert(
          false,
          `Please fill all required fields:\n${missingFields.join('\n')}`
        );
        return;
      }

      const { formData, hasDataToSave } = this.prepareSubmissionData();
      if (!hasDataToSave) {
        this.alertService.alert(false, 'No changes to save.');
        return;
      }

      const result = await this.HTTP.postForm(
        this.existingDetailIds.size > 0
          ? '/candidate/postFile/updateCandidateScoreCard'
          : '/candidate/postFile/saveCandidateScoreCard',
        formData,
        'recruitement'
      ).toPromise();

      this.updateIdsFromResponse(result);
      this.alertService.alert(false, 'Data saved successfully!');

      // Construct subheadings data for emission
      const subheadingsData = this.attachmentMeta.reduce((acc, meta, index) => {
        const key = `${meta.m_rec_score_field_id}_${
          meta.a_rec_adv_post_detail_id || this.a_rec_adv_post_detail_id
        }_${index}`;
        acc[key] = {
          m_rec_score_field_id: meta.m_rec_score_field_id,
          score_field_title_name: meta.score_field_name_e,
          a_rec_adv_post_detail_id:
            meta.a_rec_adv_post_detail_id || this.a_rec_adv_post_detail_id,
        };
        return acc;
      }, {} as { [key: string]: any });

      const emitData = {
        ...this.form.value,
        _isValid: true,
        heading: {
          score_field_title_name: 'Other Attachments', // Adjust based on actual heading from API or requirement
          m_rec_score_field_id: this.score_field_parent_id,
          a_rec_adv_post_detail_id: this.a_rec_adv_post_detail_id,
        },
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
        '📤 Step7 form emitting data:',
        JSON.stringify(emitData, null, 2)
      );
      this.formData.emit(emitData);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.alertService.alert(false, 'Failed to save data: ' + errorMessage);

      // Construct subheadings data for emission in error case
      const subheadingsData = this.attachmentMeta.reduce((acc, meta, index) => {
        const key = `${meta.m_rec_score_field_id}_${
          meta.a_rec_adv_post_detail_id || this.a_rec_adv_post_detail_id
        }_${index}`;
        acc[key] = {
          m_rec_score_field_id: meta.m_rec_score_field_id,
          score_field_title_name: meta.score_field_name_e,
          a_rec_adv_post_detail_id:
            meta.a_rec_adv_post_detail_id || this.a_rec_adv_post_detail_id,
        };
        return acc;
      }, {} as { [key: string]: any });

      const emitData = {
        ...this.form.value,
        _isValid: false,
        heading: {
          score_field_title_name: 'Other Attachments', // Adjust based on actual heading from API or requirement
          m_rec_score_field_id: this.score_field_parent_id,
          a_rec_adv_post_detail_id: this.a_rec_adv_post_detail_id,
        },
        subheadings: subheadingsData,
        filePaths: Array.from(this.filePaths.entries()).reduce(
          (obj, [key, value]) => {
            obj[key] = value;
            return obj;
          },
          {} as { [key: string]: string }
        ),
      };

      this.formData.emit(emitData);
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  private getMissingFields(): string[] {
    const missingFields: string[] = [];

    this.attachmentsArray.controls.forEach((control, index) => {
      const meta = this.attachmentMeta[index];
      if (meta && this.isMandatory(meta)) {
        const controlDoc = control.get('document');
        const hasDocument = controlDoc?.value;
        const hasExistingFile = this.filePaths.has(
          `${meta.m_rec_score_field_id}_${this.m_rec_score_field_parameter_id}`
        );
        if (!hasDocument && !hasExistingFile) {
          missingFields.push(`- ${meta.score_field_name_e}`);
        }
      }
    });

    return missingFields;
  }

  private prepareSubmissionData(): {
    formData: FormData;
    hasDataToSave: boolean;
  } {
    const formData = new FormData();
    let hasDataToSave = false;
    const scoreFieldDetailList: any[] = [];
    const scoreFieldParameterList: any[] = [];

    this.attachmentsArray.controls.forEach((control, index) => {
      const group = control as FormGroup;
      const formValues = group.getRawValue();
      const meta = this.attachmentMeta[index];

      if (!meta) return;

      if (
        !formValues.document &&
        !this.isMandatory(meta) &&
        !formValues.remark
      ) {
        return;
      }

      hasDataToSave = true;
      const existingDetailId = this.existingDetailIds.get(
        meta.m_rec_score_field_id
      );
      const paramKey = `${meta.m_rec_score_field_id}_${this.m_rec_score_field_parameter_id}`;
      const existingParamId = this.existingParameterIds.get(paramKey);

      const detail = {
        ...(existingDetailId && {
          a_rec_app_score_field_detail_id: existingDetailId,
        }),
        registration_no: this.registrationNo,
        a_rec_app_main_id: this.a_rec_adv_main_id,
        a_rec_adv_post_detail_id: this.a_rec_adv_post_detail_id,
        score_field_parent_id: this.score_field_parent_id,
        m_rec_score_field_id: meta.m_rec_score_field_id,
        m_rec_score_field_method_id: this.m_rec_score_field_method_id,
        score_field_value: 0,
        score_field_actual_value: 0,
        score_field_calculated_value: 0,
        field_marks: 0,
        field_weightage: 0,
        remark: formValues.remark,
        unique_parameter_display_no: String(meta.display_order_no),
        verify_remark: 'Not Verified',
        active_status: 'Y',
        action_type: existingDetailId ? 'U' : 'C',
        action_ip_address: '127.0.0.1',
        action_remark: existingDetailId
          ? 'Data updated from Step 7 form'
          : 'Data inserted from Step 7 form',
        action_by: 1,
        delete_flag: 'N',
        action_date: new Date().toISOString(),
      };
      scoreFieldDetailList.push(detail);

      const parameter = {
        ...(existingParamId && {
          a_rec_app_score_field_parameter_detail_id: existingParamId,
        }),
        registration_no: this.registrationNo,
        score_field_parent_id: this.score_field_parent_id,
        m_rec_score_field_id: meta.m_rec_score_field_id,
        m_rec_score_field_parameter_id: this.m_rec_score_field_parameter_id,
        parameter_value: this.getParameterValue(
          meta.m_rec_score_field_id,
          formValues.document
        ),
        is_active: 'Y',
        parameter_display_no: meta.display_order_no,
        obt_marks: 0,
        unique_parameter_display_no: String(meta.display_order_no),
        verify_remark: 'Not Verified',
        active_status: 'Y',
        action_type: existingParamId ? 'U' : 'C',
        action_date: new Date().toISOString(),
        action_ip_address: '127.0.0.1',
        action_remark: existingParamId
          ? 'Parameter updated from Step 7 form'
          : 'Parameter inserted from Step 7 form',
        action_by: 1,
        delete_flag: 'N',
      };
      scoreFieldParameterList.push(parameter);

      if (formValues.document instanceof File) {
        const fileControlName = `file_${meta.m_rec_score_field_id}_${this.m_rec_score_field_parameter_id}_${meta.display_order_no}`;
        formData.append(
          fileControlName,
          formValues.document,
          formValues.document.name
        );
      }
    });

    formData.append('registration_no', this.registrationNo.toString());
    formData.append(
      'scoreFieldDetailList',
      JSON.stringify(scoreFieldDetailList)
    );
    formData.append(
      'scoreFieldParameterList',
      JSON.stringify(scoreFieldParameterList)
    );

    return { formData, hasDataToSave };
  }

  private getParameterValue(scoreFieldId: number, document: any): string {
    if (document instanceof File) {
      return document.name;
    }

    const filePath = this.filePaths.get(
      `${scoreFieldId}_${this.m_rec_score_field_parameter_id}`
    );
    return filePath ? this.getFileName(filePath) : 'Not Provided';
  }

  private getFileName(filePath: string): string {
    return filePath.split('\\').pop() || 'Unknown File';
  }

  private updateIdsFromResponse(res: any): void {
    const data = this.normalizeApiResponse(res);

    data.forEach((item: any) => {
      if (item.a_rec_app_score_field_detail_id && item.m_rec_score_field_id) {
        this.existingDetailIds.set(
          item.m_rec_score_field_id,
          item.a_rec_app_score_field_detail_id
        );
      }

      if (
        item.a_rec_app_score_field_parameter_detail_id &&
        item.m_rec_score_field_id &&
        item.m_rec_score_field_parameter_id
      ) {
        const paramKey = `${item.m_rec_score_field_id}_${item.m_rec_score_field_parameter_id}`;
        this.existingParameterIds.set(
          paramKey,
          item.a_rec_app_score_field_parameter_detail_id
        );
      }
    });
  }
}
