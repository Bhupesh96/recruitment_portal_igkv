import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { SharedDataService } from '../../shared-data.service';
import { AlertService, HttpService, LoaderService } from 'shared';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  RecruitmentStateService,
  UserRecruitmentData,
} from '../../recruitment-state.service';
@Component({
  selector: 'app-step-9',
  standalone: true,
  templateUrl: './step-9.component.html',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  styleUrls: ['./step-9.component.scss'],
})
export class Step9Component implements OnInit, OnDestroy {
  @Output() goToStep = new EventEmitter<number>();
  @Output() finalSubmitSuccess = new EventEmitter<void>();

  formData: { [key: number]: { [key: string]: any } } = {};
  steps: string[] = [
    'Personal Info',
    'Education',
    'Academics',
    'Publications',
    'Experience',
    'Performance',
    'Submission',
  ];

  personalInfoExcludeKeys = new Set([
    'a_rec_adv_main_id',
    'a_rec_app_main_id',
    'post_code',
    'session_id',
    'subject_id',
    'Salutation_E',
    'Salutation_H',
    'photo',
    'signature',
    '_isValid',
    'candidate_photo',
    'candidate_signature',
    'presentSame',
    'registration_no',
    'religion_code',
    'gender_id',
    'advertisment_name',
    'post_name',
    'Subject_Name_E', // Added these three
    'Salutation_E_Name',
    'Salutation_H_Name',
    'Applicant_First_Name_E',
    'Applicant_Middle_Name_E',
    'Applicant_Last_Name_E',
    'Applicant_First_Name_H',
    'Applicant_Middle_Name_H',
    'Applicant_Last_Name_H',
    'Applicant_Father_Name_E',
    'Applicant_Mother_Name_E',
    'DOB',
    'age',
    'Birth_Place',
    'Birth_Country_Id',
    'Birth_State_Id',
    'Birth_District_Id',
    'Birth_Country_Name',
    'Birth_State_Name',
    'Birth_District_Name',
    'Permanent_Address1',
    'Permanent_City',
    'Permanent_Pin_Code',
    'Permanent_Country_Id',
    'Permanent_State_Id',
    'Permanent_District_Id',
    'Permanent_Country_Name',
    'Permanent_State_Name',
    'Permanent_District_Name',
    'Current_Address1',
    'Current_City',
    'Current_Pin_Code',
    'Current_Country_Id',
    'Current_State_Id',
    'Current_District_Id',
    'Current_Country_Name',
    'Current_State_Name',
    'Current_District_Name',
  ]);

  private destroy$ = new Subject<void>();
  form: FormGroup;
  isSubmitted = false;
  declarationText: SafeHtml = '';
  private userData: UserRecruitmentData | null = null;
  constructor(
    private sharedDataService: SharedDataService,
    private alertService: AlertService,
    private fb: FormBuilder,
    private http: HttpService,
    private sanitizer: DomSanitizer,
    private loader: LoaderService,
    private recruitmentState: RecruitmentStateService
  ) {
    this.form = this.fb.group({
      declaration: [false, Validators.requiredTrue],
    });
    this.userData = this.recruitmentState.getCurrentUserData();
  }

  ngOnInit(): void {
    this.sharedDataService.formData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: { [key: number]: any }) => {
        if (data && Object.keys(data).length > 0) {
          this.formData = data;
          this.loadDeclaration();
        }
      });
  }
  loadDeclaration(): void {
    const a_rec_adv_main_id = this.userData?.a_rec_adv_main_id;
    if (!a_rec_adv_main_id) {
      this.declarationText =
        'Could not load declaration: Advertisement ID missing.';
      return;
    }
    const apiUrl = `/master/get/getLatestAdvertisement?a_rec_adv_main_id=${a_rec_adv_main_id}`;
    this.http.getData(apiUrl, 'recruitement').subscribe({
      next: (response: any) => {
        const data = response?.body?.data?.[0];
        if (data && data.advertisement_declaration) {
          this.declarationText = this.sanitizer.bypassSecurityTrustHtml(
            data.advertisement_declaration
          );
        }
      },
      error: (err) => {
        this.declarationText = this.sanitizer.bypassSecurityTrustHtml(
          'Failed to load declaration. Please try again later.'
        );
      },
    });
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private formatDateDDMMYYYY(dateString: string): string {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return '—';
    }
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }

  // ✨✨✨ MODIFIED SECTION: Added logic to format Gender ✨✨✨
  getProcessedPersonalInfo(): { key: string; value: string }[] {
    const info = this.formData[1];
    if (!info) return [];

    const processedData: { key: string; value: string }[] = [];

    // 1. Combine Name Fields
    const fullNameE = [
      info['Salutation_E_Name'],
      info['Applicant_First_Name_E'],
      info['Applicant_Middle_Name_E'],
      info['Applicant_Last_Name_E'],
    ]
      .filter(Boolean)
      .join(' ');
    processedData.push({
      key: 'Applicant Full Name (English)',
      value: fullNameE,
    });

    const fullNameH = [
      info['Salutation_H_Name'],
      info['Applicant_First_Name_H'],
      info['Applicant_Middle_Name_H'],
      info['Applicant_Last_Name_H'],
    ]
      .filter(Boolean)
      .join(' ');
    processedData.push({
      key: 'Applicant Full Name (Hindi)',
      value: fullNameH,
    });

    // 2. Add other important fields in a logical order
    processedData.push({
      key: "Father's Name",
      value: this.formatValue(info['Applicant_Father_Name_E']),
    });
    processedData.push({
      key: "Mother's Name",
      value: this.formatValue(info['Applicant_Mother_Name_E']),
    });

    // Handle Gender translation
    let genderDisplay = '—';
    switch (info['gender_id']) {
      case 'M':
        genderDisplay = 'Male';
        break;
      case 'F':
        genderDisplay = 'Female';
        break;
      case 'T':
        genderDisplay = 'Third Gender';
        break;
    }
    processedData.push({ key: 'Gender', value: genderDisplay });

    processedData.push({
      key: 'Date of Birth',
      value: this.formatDateDDMMYYYY(info['DOB']),
    });
    processedData.push({
      key: `Age as on ${new Date().toLocaleDateString('en-IN')}`,
      value: this.formatValue(info['age']),
    });

    // 3. Combine Birth Place
    const birthPlace = [
      info['Birth_Place'],
      info['Birth_District_Name'],
      info['Birth_State_Name'],
      info['Birth_Country_Name'],
    ]
      .filter(Boolean)
      .join(', ');
    processedData.push({ key: 'Birth Place', value: birthPlace });

    // 4. Combine Permanent Address
    const permanentAddress =
      [
        info['Permanent_Address1'],
        info['Permanent_City'],
        info['Permanent_District_Name'],
        info['Permanent_State_Name'],
        info['Permanent_Country_Name'],
      ]
        .filter(Boolean)
        .join(', ') +
      (info['Permanent_Pin_Code'] ? ` - ${info['Permanent_Pin_Code']}` : '');
    processedData.push({ key: 'Permanent Address', value: permanentAddress });

    // ✨✨✨ MODIFIED SECTION: Now shows the full address ✨✨✨
    // 5. Combine Current Address
    if (info['presentSame']) {
      // If same, use the permanent address value we already built
      processedData.push({ key: 'Current Address', value: permanentAddress });
    } else {
      // If different, build the current address string
      const currentAddress =
        [
          info['Current_Address1'],
          info['Current_City'],
          info['Current_District_Name'],
          info['Current_State_Name'],
          info['Current_Country_Name'],
        ]
          .filter(Boolean)
          .join(', ') +
        (info['Current_Pin_Code'] ? ` - ${info['Current_Pin_Code']}` : '');
      processedData.push({ key: 'Current Address', value: currentAddress });
    }

    // 6. Iterate over remaining keys that are not in the exclusion list
    for (const key of this.getFormDataKeys(info)) {
      if (
        !this.personalInfoExcludeKeys.has(key) &&
        info[key] &&
        key !== 'languages' &&
        !key.startsWith('question_') &&
        !key.startsWith('condition_') &&
        key !== 'additionalInfoDetails'
      ) {
        processedData.push({
          key: this.formatKey(key),
          value: this.formatValue(info[key]),
        });
      }
    }

    return processedData;
  }
  isExperienceKey(key: string): boolean {
    if (!key) return false;
    return /^\d+_\d+_\d+$/.test(key);
  }

  detailBelongsToSubheading(detail: any, items: any[]): boolean {
    if (!detail || !Array.isArray(items)) {
      return false;
    }
    return items.some(
      (item) => item.m_rec_score_field_id.toString() === detail.type.toString()
    );
  }

  getFormDataKeys(dataObject: any): string[] {
    return dataObject ? Object.keys(dataObject) : [];
  }

  formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  isFileValue(value: any): boolean {
    // Check if it's a JavaScript File object (newly uploaded)
    if (value instanceof File) {
      return true;
    }

    // Check if it is an object that is not null (for the {} case in your JSON if it's not strictly a File instance yet)
    // We only assume it's a file if it's an object and NOT an array, usually associated with specific keys
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // If it's an empty object in the JSON dump under an attachment key, treat it as valid
      return true;
    }

    // Existing string check
    return (
      typeof value === 'string' &&
      (value.startsWith('recruitment/') || value === 'FILE_UPLOADED')
    );
  }

  // 2. Update this function to check the Data Array, not just filePaths map
  checkFilesForSubheading(sectionData: any, subheadKey: string): boolean {
    if (!sectionData) {
      return false;
    }

    // 1. Check the old way (filePaths map) - useful for data coming from DB
    const cleanSubheadKey = subheadKey.replace('qualifications', '');
    if (
      sectionData['filePaths'] &&
      Object.keys(sectionData['filePaths']).some((filePathKey) =>
        filePathKey.startsWith(cleanSubheadKey)
      )
    ) {
      return true;
    }

    // 2. NEW: Check the actual data array for 'Attachment' key (useful for new uploads)
    const dataArray = sectionData[cleanSubheadKey];
    if (Array.isArray(dataArray) && dataArray.length > 0) {
      // Check if any item in the array has an "Attachment" property with a value
      return dataArray.some(
        (item) =>
          (item['Attachment'] && this.isFileValue(item['Attachment'])) ||
          (item['attachment'] && this.isFileValue(item['attachment']))
      );
    }

    return false;
  }
  formatValue(value: any): string {
    if (this.isFileValue(value)) {
      return 'File Uploaded';
    }
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === 'object' ? Object.values(item).join(', ') : item
        )
        .join('; ');
    }
    if (typeof value === 'object' && !(value instanceof File)) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  getFileUrl(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') return '';
    return `http://192.168.1.57:3500/${filePath.replace(/\\/g, '/')}`;
  }

  getDetailItemName(step: number, detailType: string): string {
    const stepData = this.formData[step];
    if (!stepData || !stepData['subheadings']) return 'Detail';

    for (const subheadKey of Object.keys(stepData['subheadings'])) {
      const subhead = stepData['subheadings'][subheadKey];
      if (subhead && Array.isArray(subhead.items)) {
        const foundItem = subhead.items.find(
          (item: any) =>
            item.m_rec_score_field_id.toString() === detailType.toString()
        );
        if (foundItem) {
          return foundItem.score_field_name_e;
        }
      }
    }
    return 'Detail';
  }
  getDisplayableKeys(obj: any): string[] {
    if (!obj) return [];
    return Object.keys(obj).filter(
      (key) =>
        !key.toLowerCase().includes('_id') &&
        !key.toLowerCase().includes('a_rec_app') &&
        !key.toLowerCase().includes('is_deleted') &&
        !key.startsWith('param_') &&
        key !== 'calculated_experience'
    );
  }
  getHeadersForSubheading(stepIndex: number, subheadKey: string): string[] {
    const stepData = this.formData[stepIndex];
    if (!stepData || !stepData['details'] || !stepData['subheadings']) {
      return [];
    }

    const subhead = stepData['subheadings'][subheadKey];
    if (!subhead || !subhead.items) {
      return [];
    }

    const firstRelevantDetail = stepData['details'].find((detail: any) =>
      this.detailBelongsToSubheading(detail, subhead.items)
    );

    if (firstRelevantDetail) {
      return this.getDisplayableKeys(firstRelevantDetail);
    }

    return [];
  }
  hasDetailsForSubheading(stepIndex: number, subheadKey: string): boolean {
    const stepData = this.formData[stepIndex];
    if (!stepData || !stepData['details'] || !stepData['subheadings']) {
      return false;
    }
    const subhead = stepData['subheadings'][subheadKey];
    if (!subhead || !subhead.items) {
      return false;
    }
    return stepData['details'].some((detail: any) =>
      this.detailBelongsToSubheading(detail, subhead.items)
    );
  }

  submit(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.form.invalid) {
        this.alertService.alert(
          true,
          'You must accept the declaration to proceed.'
        );
        return reject(new Error('Declaration not accepted.'));
      }

      const registrationNo = this.formData[1]?.['registration_no'];
      const a_rec_app_main_id = this.formData[1]?.['a_rec_app_main_id'];
      if (!registrationNo) {
        this.alertService.alert(
          true,
          'Cannot submit. Registration number is missing.'
        );
        return reject(new Error('Registration number missing.'));
      }

      this.loader.show();
      this.isSubmitted = true;
      this.form.disable();

      const payload = {
        registration_no: registrationNo,
        a_rec_app_main_id: a_rec_app_main_id,
      };

      this.http
        .postForm(
          '/candidate/postFile/updateFinalDeclaration',
          payload,
          'recruitement'
        )
        .subscribe({
          next: async (res: any) => {
            this.loader.hide();
            if (res?.body?.error) {
              this.alertService.alert(
                true,
                res.body.error.message || 'An unknown error occurred.'
              );
              this.isSubmitted = false;
              this.form.enable();
              reject(new Error(res.body.error.message));
            } else {
              await this.alertService.alert(
                false,
                'Application Submitted Successfully!'
              );
              this.finalSubmitSuccess.emit();
              resolve();
            }
          },
          error: (err) => {
            this.loader.hide();
            this.alertService.alert(
              true,
              'A server error occurred. Please try again.'
            );
            this.isSubmitted = false;
            this.form.enable();
            reject(err);
          },
        });
    });
  }
}
