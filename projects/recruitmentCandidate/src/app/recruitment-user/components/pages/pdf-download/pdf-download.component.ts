import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';
import { SharedDataService } from '../shared-data.service';
import { Subscription, take } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpService, LoaderService } from 'shared';
import {
  RecruitmentStateService,
  UserRecruitmentData,
} from '../recruitment-state.service';
import { environment } from 'environment';

@Component({
  selector: 'app-pdf-download',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pdf-download.component.html',
  styleUrls: ['./pdf-download.component.scss'],
})
export class PdfDownloadComponent implements OnInit, OnDestroy {
  @ViewChild('printSection') printContentRef!: ElementRef<HTMLDivElement>;

  formData: { [key: number]: any } = {};
  isDataLoaded = false;
  private dataSubscription: Subscription | undefined;
  declarationText: SafeHtml = '';

  public userData: UserRecruitmentData | null = null;
  feeStatus: any = null;

  payScale: string = '';
  payLevel: string = '';
  advertisementNo: string = '—';
  ageCalculationDate: string = '';
  processedPersonalInfo: { key: string; value: string }[] = [];

  processedSteps: any[] = [];
  processedAttachments: { type: string; remark: string }[] = [];

  personalInfoExcludeKeys = new Set([
    'a_rec_adv_main_id', 'a_rec_app_main_id', 'post_code', 'session_id', 'subject_id',
    'Salutation_E', 'Salutation_H', 'photo', 'signature', '_isValid',
    'candidate_photo', 'candidate_signature', 'presentSame', 'registration_no',
    'religion_code', 'gender_id', 'advertisment_name', 'post_name',
    'Subject_Name_E', 'Salutation_E_Name', 'Salutation_H_Name',
    'Applicant_First_Name_E', 'Applicant_Middle_Name_E', 'Applicant_Last_Name_E',
    'Applicant_First_Name_H', 'Applicant_Middle_Name_H', 'Applicant_Last_Name_H',
    'Applicant_Father_Name_E', 'Applicant_Mother_Name_E', 'DOB', 'age',
    'Birth_Place', 'Birth_Country_Id', 'Birth_State_Id', 'Birth_District_Id',
    'Birth_Country_Name', 'Birth_State_Name', 'Birth_District_Name',
    'Permanent_Address1', 'Permanent_City', 'Permanent_Pin_Code', 'Permanent_Country_Id',
    'Permanent_State_Id', 'Permanent_District_Id', 'Permanent_Country_Name',
    'Permanent_State_Name', 'Permanent_District_Name', 'Current_Address1',
    'Current_City', 'Current_Pin_Code', 'Current_Country_Id', 'Current_State_Id',
    'Current_District_Id', 'Current_Country_Name', 'Current_State_Name',
    'Current_District_Name',
    'candidate_category_id',
    'advertisment_no'
  ]);

  constructor(
    private sharedDataService: SharedDataService,
    private sanitizer: DomSanitizer,
    private httpService: HttpService,
    private recruitmentState: RecruitmentStateService,
    private loader: LoaderService,
    private cdr: ChangeDetectorRef
  ) {
    this.userData = this.recruitmentState.getCurrentUserData();
  }

  ngOnInit(): void {
    this.dataSubscription = this.sharedDataService.formData$.subscribe(
      (data) => {
        if (data && Object.keys(data).length > 0) {
          this.formData = JSON.parse(JSON.stringify(data));

          if (
            this.formData[1]?.languages &&
            Array.isArray(this.formData[1].languages)
          ) {
            this.formData[1].languages = this.getUniqueLanguages(
              this.formData[1].languages
            );
          }

          this.processedPersonalInfo = this.getProcessedPersonalInfo();
          this.processAllDataForView();
          this.isDataLoaded = true;
          this.loadDeclaration();
          this.getFeeStatus();
        }
      }
    );
  }

  getFeeStatus() {
    if (!this.formData[1]) return;
    const params = {
      recruitment: true, // ✅ RESTORED: This is critical for the backend to fetch the correct data
      payee_id: this.formData[1]["registration_no"],
      advertisement_id: this.formData[1]["a_rec_adv_main_id"]
    };
    this.httpService.getParam('/fee/get/getFeeStatus/', params, 'academic').subscribe({
      next: (result: any) => {
        this.feeStatus = !result.body?.error ? result.body?.data[0] : null;
        this.cdr.detectChanges(); // Ensure UI catches the payment date
      },
      error: (err) => console.error('Failed to load fee status for PDF', err)
    });
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  private getUniqueLanguages(languages: any[]): any[] {
    const seen = new Set();
    return languages.filter((lang) => {
      const key = `${lang.m_rec_language_id}-${lang.m_rec_language_type_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  isFileValue(value: any): boolean {
    if (value instanceof File) return true;
    if (
      typeof value === 'object' &&
      value !== null &&
      (value.name || value.size) &&
      !Array.isArray(value)
    ) return true;

    return (
      typeof value === 'string' &&
      (value.startsWith('recruitment/') || value === 'FILE_UPLOADED')
    );
  }

  formatValue(value: any, question?: string): string {
    if (question?.toLowerCase().includes('category')) {
      const categoryMap: any = {
        UR: 'Unreserved (UR)', OBC: 'Other Backward Class (OBC)', SC: 'Scheduled Caste (SC)', ST: 'Scheduled Tribe (ST)', EWS: 'Economically Weaker Section (EWS)',
        1: 'Unreserved (UR)', 2: 'Other Backward Class (OBC)', 3: 'Scheduled Caste (SC)', 4: 'Scheduled Tribe (ST)', 5: 'Economically Weaker Section (EWS)',
      };
      return categoryMap[value] || value;
    }

    if (this.isFileValue(value)) return '✓ File Uploaded';
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return '';

    return String(value);
  }

  private processAllDataForView(): void {
    if (!this.formData) {
      this.processedSteps = [];
      this.processedAttachments = [];
      return;
    }
    this.processedSteps = this.getProcessedSteps();
    this.processedAttachments = this.getProcessedAttachments();
  }

  public downloadAsPdf(): void {
    this.loader.showLoader();

    // ✅ ALWAYS fetch the latest fee status directly from the DB right before printing!
    if (this.formData[1]) {
      const params = {
        recruitment: true,
        payee_id: this.formData[1]["registration_no"],
        advertisement_id: this.formData[1]["a_rec_adv_main_id"]
      };

      this.httpService.getParam('/fee/get/getFeeStatus/', params, 'academic').subscribe({
        next: (result: any) => {
          this.feeStatus = !result.body?.error ? result.body?.data[0] : null;
          this.cdr.detectChanges(); // Force the HTML to update with the new payment data
          this.generatePdfDocument(); // Proceed to print
        },
        error: (err) => {
          console.error('Failed to load fee status for PDF', err);
          this.generatePdfDocument(); // Print anyway if it fails
        }
      });
    } else {
      this.generatePdfDocument();
    }
  }

  // ✅ Moved the actual PDF generation logic into its own helper method
  private generatePdfDocument(): void {
    if (!this.printContentRef) {
      console.error('Content element not found!');
      this.loader.hideLoader();
      return;
    }

    const styleNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
    let stylesHtml = '';
    styleNodes.forEach((node) => {
      stylesHtml += node.outerHTML;
    });

    let contentHtml = this.printContentRef.nativeElement.outerHTML;
    const baseUrl = window.location.origin;
    contentHtml = contentHtml.replace(
      'src="igkv_logo.png"',
      `src="${baseUrl}igkv_logo.png"`
    );

    const fullHtmlPayload = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Application Form</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 13px; color: #000; margin: 0; padding: 0; background: #fff; }
          .a4-container { width: 100%; max-width: 800px; margin: 0 auto; }
          .header-section { text-align: center; margin-bottom: 20px; }
          .form-title { font-size: 18px; font-weight: bold; text-decoration: underline; text-transform: uppercase; }
          .bordered-section { border: 1px solid #000; margin-bottom: 15px; page-break-inside: avoid; }
          .section-heading-bar { background-color: #e0e0e0; padding: 6px 10px; font-weight: bold; font-size: 14px; border-bottom: 1px solid #000; text-transform: uppercase; }
          .sub-section-heading-bar { background-color: #f5f5f5; padding: 6px 10px; font-weight: bold; border-bottom: 1px solid #000; border-top: 1px solid #000; }
          table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: middle; font-size: 13px; }
          th { background-color: #f0f0f0; font-weight: bold; }
          .label { font-weight: bold; }
          .declaration-content { padding: 15px; text-align: justify; line-height: 1.5; }
          .page-break-before { page-break-before: always; }
        </style>
        ${stylesHtml}
      </head>
      <body>
        ${contentHtml}
      </body>
    </html>
  `;

    const apiUrl = '/file/post/htmltoPdf';
    const payload = { html: fullHtmlPayload, old_header: true, office_name: false, border: false, university_id : 2 };
    let fileName = `Application_Form_${this.formData[1]?.registration_no}.pdf`;

    this.httpService.postBlob(apiUrl, payload, fileName, "common").pipe(take(1)).subscribe(() => {
      console.log("PDF Generated");
      this.loader.hideLoader();
    });
  }

  getFileUrl(filePath: string | null): string {
    if (!filePath || typeof filePath !== 'string') return '';
    return `${environment.recruitmentFileBaseUrl}/${filePath.replace(/\\/g, '/')}`;
  }

  formatHeader(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  loadDeclaration(): void {
    const a_rec_adv_main_id = this.userData?.a_rec_adv_main_id || this.formData[1]?.a_rec_adv_main_id;
    if (!a_rec_adv_main_id) {
      this.declarationText = 'Could not load declaration: Advertisement ID missing.';
      return;
    }
    const apiUrl = `/master/get/getLatestAdvertisement?adv_main_id=${a_rec_adv_main_id}`;
    this.httpService.getData(apiUrl, 'recruitement').subscribe({
      next: (response: any) => {
        const data = response?.body?.data?.[0];
        if (data) {
          this.ageCalculationDate = data.age_calculation_date || '';
          this.payScale = data.band_pay_scale || data.fixed_salary || '';
          this.advertisementNo = data.advertisment_no || data.uk_advertisment_no || '—';
          this.payLevel = data.pay_level || '';

          if (data.advertisement_declaration) {
            this.declarationText = this.sanitizer.bypassSecurityTrustHtml(data.advertisement_declaration);
          }

          this.processedPersonalInfo = this.getProcessedPersonalInfo();
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.declarationText = this.sanitizer.bypassSecurityTrustHtml('Failed to load declaration.');
      },
    });
  }

  private formatDateDDMMYYYY(dateString: string): string {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return '—';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
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

  getProcessedPersonalInfo(): { key: string; value: string }[] {
    const info = this.formData[1];
    if (!info) return [];

    const processedData: { key: string; value: string }[] = [];
    const personalInfoExcludeKeys = new Set([
      'a_rec_adv_main_id', 'a_rec_app_main_id', 'post_code', 'session_id', 'subject_id',
      'Salutation_E', 'Salutation_H', 'photo', 'signature', '_isValid',
      'candidate_photo', 'candidate_signature', 'presentSame', 'registration_no',
      'religion_code', 'gender_id', 'advertisment_name', 'post_name',
      'Subject_Name_E', 'Salutation_E_Name', 'Salutation_H_Name',
      'Applicant_First_Name_E', 'Applicant_Middle_Name_E', 'Applicant_Last_Name_E',
      'Applicant_First_Name_H', 'Applicant_Middle_Name_H', 'Applicant_Last_Name_H',
      'Applicant_Father_Name_E', 'Applicant_Mother_Name_E', 'DOB', 'age',
      'Birth_Place', 'Birth_Country_Id', 'Birth_State_Id', 'Birth_District_Id',
      'Birth_Country_Name', 'Birth_State_Name', 'Birth_District_Name',
      'Permanent_Address1', 'Permanent_City', 'Permanent_Pin_Code', 'Permanent_Country_Id',
      'Permanent_State_Id', 'Permanent_District_Id', 'Permanent_Country_Name',
      'Permanent_State_Name', 'Permanent_District_Name', 'Current_Address1',
      'Current_City', 'Current_Pin_Code', 'Current_Country_Id', 'Current_State_Id',
      'Current_District_Id', 'Current_Country_Name', 'Current_State_Name',
      'Current_District_Name', 'candidate_category_id', 'advertisment_no',
      'uk_advertisementNo', 'advertisementNo'
    ]);

    const fullNameE = [
      info['Salutation_E_Name'], info['Applicant_First_Name_E'],
      info['Applicant_Middle_Name_E'], info['Applicant_Last_Name_E'],
    ].filter(Boolean).join(' ');
    processedData.push({ key: 'Applicant Full Name (English)', value: fullNameE });

    const fullNameH = [
      info['Salutation_H_Name'], info['Applicant_First_Name_H'],
      info['Applicant_Middle_Name_H'], info['Applicant_Last_Name_H'],
    ].filter(Boolean).join(' ');
    processedData.push({ key: 'Applicant Full Name (Hindi)', value: fullNameH });

    processedData.push({ key: 'Advertisement No', value: this.advertisementNo });
    processedData.push({ key: "Father's Name", value: this.formatValue(info['Applicant_Father_Name_E']) });
    processedData.push({ key: "Mother's Name", value: this.formatValue(info['Applicant_Mother_Name_E']) });

    let genderDisplay = '—';
    switch (info['gender_id']) {
      case 'M': genderDisplay = 'Male'; break;
      case 'F': genderDisplay = 'Female'; break;
      case 'T': genderDisplay = 'Third Gender'; break;
    }
    processedData.push({ key: 'Gender', value: genderDisplay });
    processedData.push({ key: 'Date of Birth', value: this.formatDateDDMMYYYY(info['DOB']) });

    let ageLabel = 'Age';
    let calculatedAge = this.formatValue(info['age']);

    if (info['DOB']) {
      const targetDateStr = this.ageCalculationDate
        ? this.ageCalculationDate.split('T')[0]
        : new Date().toISOString().split('T')[0];

      const dobStr = info['DOB'].split('T')[0];

      const [tYear, tMonth, tDay] = targetDateStr.split('-').map(Number);
      const [dYear, dMonth, dDay] = dobStr.split('-').map(Number);

      let years = tYear - dYear;
      let months = tMonth - dMonth;
      let days = tDay - dDay;

      if (days < 0) {
        months--;
        const prevMonthDays = new Date(tYear, tMonth - 1, 0).getDate();
        days += prevMonthDays;
      }
      if (months < 0) {
        years--;
        months += 12;
      }

      calculatedAge = `${years} Years, ${months} Months, ${days} Days`;
    }

    if (this.ageCalculationDate) {
      const datePart = this.ageCalculationDate.split('T')[0];
      const [year, month, day] = datePart.split('-');
      ageLabel = `Age as on ${day}-${month}-${year}`;
    }

    processedData.push({ key: ageLabel, value: calculatedAge });

    const birthPlace = [
      info['Birth_Place'], info['Birth_District_Name'],
      info['Birth_State_Name'], info['Birth_Country_Name'],
    ].filter(Boolean).join(', ');
    processedData.push({ key: 'Birth Place', value: birthPlace });

    const permanentAddress = [
      info['Permanent_Address1'], info['Permanent_City'],
      info['Permanent_District_Name'], info['Permanent_State_Name'],
      info['Permanent_Country_Name'],
    ].filter(Boolean).join(', ') + (info['Permanent_Pin_Code'] ? ` - ${info['Permanent_Pin_Code']}` : '');
    processedData.push({ key: 'Permanent Address', value: permanentAddress });

    if (info['presentSame']) {
      processedData.push({ key: 'Current Address', value: permanentAddress });
    } else {
      const currentAddress = [
        info['Current_Address1'], info['Current_City'],
        info['Current_District_Name'], info['Current_State_Name'],
        info['Current_Country_Name'],
      ].filter(Boolean).join(', ') + (info['Current_Pin_Code'] ? ` - ${info['Current_Pin_Code']}` : '');
      processedData.push({ key: 'Current Address', value: currentAddress });
    }

    for (const key of this.getFormDataKeys(info)) {
      if (
        !personalInfoExcludeKeys.has(key) &&
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

  private getProcessedSteps(): any[] {
    return Object.keys(this.formData)
      .map(Number)
      .filter((key) => key > 1)
      .sort((a, b) => a - b)
      .map((key) => {
        const stepData = this.formData[key];

        if (stepData.languages && stepData.languages.length > 0) return null;

        let stepType = '';
        let sections: any[] = [];

        if (this.isQualificationStep(stepData)) {
          stepType = 'qualification';
          sections = this.getQualificationSections(stepData);
        } else if (this.isExperienceStep(stepData)) {
          stepType = 'experience';
          sections = this.getExperienceSections(stepData);
        } else if (this.isDetailsStep(stepData)) {
          stepType = 'details';
          sections = this.getSubheadingsWithDetails(stepData);
        }

        if (sections.length === 0 && !stepData.attachments) return null;

        return {
          key,
          heading: stepData?.heading?.score_field_title_name || 'Details',
          type: stepType,
          sections,
        };
      })
      .filter((step) => step !== null);
  }

  private getDisplayableKeys(obj: any): string[] {
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

  private isQualificationStep(stepData: any): boolean {
    return stepData && Object.keys(stepData).some((key) => key.startsWith('qualifications'));
  }

  private isExperienceStep(stepData: any): boolean {
    return stepData && Object.keys(stepData).some((key) => /^\d+_\d+_\d+$/.test(key));
  }

  private isDetailsStep(stepData: any): boolean {
    return stepData && Array.isArray(stepData.details) && stepData.subheadings;
  }

  private getQualificationSections(stepData: any): any[] {
    if (!stepData || !stepData.subheadings) return [];
    return Object.keys(stepData.subheadings)
      .map((key) => {
        const qualifications = stepData[`qualifications${key}`] || [];
        if (qualifications.length > 0) {
          return {
            title: stepData.subheadings[key]?.score_field_title_name || 'Qualification',
            headers: this.getDisplayableKeys(qualifications[0]),
            qualifications: qualifications,
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  private getSubheadingsWithDetails(stepData: any): any[] {
    if (!stepData || !stepData.subheadings || !stepData.details) return [];
    return Object.keys(stepData.subheadings)
      .map((key) => {
        const subhead = stepData.subheadings[key];
        const subheadItemIds = (subhead.items || []).map((item: any) =>
          item.m_rec_score_field_id.toString()
        );
        const details = stepData.details
          .filter((detail: any) =>
            subheadItemIds.includes(detail.type.toString())
          )
          .map((detail: any) => ({
            ...detail,
            type: this.getDetailItemName(stepData, detail.type),
          }));

        if (details.length > 0) {
          return {
            title: subhead.score_field_name_e || 'Details',
            details: details,
            headers: this.getDisplayableKeys(details[0]),
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  private getExperienceSections(stepData: any): any[] {
    if (!stepData || !stepData.subheadings) return [];
    return Object.keys(stepData.subheadings)
      .map((key) => {
        if (!/^\d+_\d+_\d+$/.test(key)) return null;
        const experiences = stepData[key] || [];
        if (experiences.length > 0) {
          return {
            title: stepData.subheadings[key]?.score_field_title_name || 'Experience',
            experiences: experiences,
            headers: this.getDisplayableKeys(experiences[0]),
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  private getProcessedAttachments(): { type: string; remark: string }[] {
    const attachmentStepKey = Object.keys(this.formData).find(
      (key) => this.formData[Number(key)]?.attachments
    );

    if (!attachmentStepKey) return [];

    const stepData = this.formData[Number(attachmentStepKey)];
    if (!stepData || !Array.isArray(stepData.attachments)) return [];

    const subheadKeys = Object.keys(stepData.subheadings || {});
    return stepData.attachments
      .map((att: any, index: number) => {
        if (att.remark && att.remark.trim() !== '') {
          const key = subheadKeys[index];
          if (key) {
            const type =
              stepData.subheadings[key]?.score_field_title_name ||
              `Attachment ${index + 1}`;
            return { type, remark: att.remark };
          }
        }
        return null;
      })
      .filter(
        (item: any): item is { type: string; remark: string } => item !== null
      );
  }

  private getDetailItemName(stepData: any, detailType: string): string {
    if (!stepData || !stepData.subheadings) return 'Detail';

    for (const subheadKey of Object.keys(stepData.subheadings)) {
      const subhead = stepData.subheadings[subheadKey];
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
    return detailType;
  }
}
