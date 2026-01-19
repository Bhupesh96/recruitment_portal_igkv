import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { SharedDataService } from '../shared-data.service';
import { Subscription } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpService, LoaderService } from 'shared';
import {
  RecruitmentStateService,
  UserRecruitmentData,
} from '../recruitment-state.service';

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
  private userData: UserRecruitmentData | null = null;

  // Processed data for the template
  processedSteps: any[] = [];
  processedAttachments: { type: string; remark: string }[] = [];

  constructor(
    private sharedDataService: SharedDataService,
    private sanitizer: DomSanitizer,
    private httpService: HttpService,
    private recruitmentState: RecruitmentStateService,
    private loader: LoaderService
  ) {
    this.userData = this.recruitmentState.getCurrentUserData();
  }

  ngOnInit(): void {
    this.dataSubscription = this.sharedDataService.formData$.subscribe(
      (data) => {
        if (data && Object.keys(data).length > 0) {
          // Deep copy to avoid mutating shared state
          this.formData = JSON.parse(JSON.stringify(data));

          // ✅ FIX: Remove Duplicate Languages before processing
          if (
            this.formData[1]?.languages &&
            Array.isArray(this.formData[1].languages)
          ) {
            this.formData[1].languages = this.getUniqueLanguages(
              this.formData[1].languages
            );
          }

          this.processAllDataForView();
          this.isDataLoaded = true;
          this.loadDeclaration();
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  // ✅ Helper to deduplicate languages based on ID
  private getUniqueLanguages(languages: any[]): any[] {
    const seen = new Set();
    return languages.filter((lang) => {
      // Create a unique key based on language ID and Type ID
      const key = `${lang.m_rec_language_id}-${lang.m_rec_language_type_id}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // ✅ FIX: Robust check for File objects or strings to prevent [object Object]
  isFileValue(value: any): boolean {
    // Case 1: It's a JavaScript File object (newly selected by user)
    if (value instanceof File) {
      return true;
    }

    // Case 2: It's an object containing file-like properties (common in some form structures)
    if (
      typeof value === 'object' &&
      value !== null &&
      (value.name || value.size) &&
      !Array.isArray(value)
    ) {
      return true;
    }

    // Case 3: It's a string path from the database
    return (
      typeof value === 'string' &&
      (value.startsWith('recruitment/') || value === 'FILE_UPLOADED')
    );
  }

  formatValue(value: any): string {
    if (this.isFileValue(value)) {
      return '✓ File Uploaded';
    }

    if (value === null || value === undefined || value === '') {
      return '—';
    }

    // If it's an array, join it nicely
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    // ✅ FINAL SAFEGUARD: If it is still an object but NOT a file, return empty string
    // instead of [object Object].
    if (typeof value === 'object') {
      return '';
    }

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
    if (!this.printContentRef) {
      console.error('Content element not found!');
      return;
    }
    this.loader.showLoader();
    const styleNodes = document.querySelectorAll(
      'style, link[rel="stylesheet"]'
    );
    let stylesHtml = '';
    styleNodes.forEach((node) => {
      stylesHtml += node.outerHTML;
    });
    let contentHtml = this.printContentRef.nativeElement.outerHTML;
    const baseUrl = window.location.origin;
    contentHtml = contentHtml.replace(
      'src="assets/igkv_logo.png"',
      `src="${baseUrl}igkv_logo.png"`
    );

    const fullHtmlPayload = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Application Form</title>
        ${stylesHtml}
      </head>
      <body>
        ${contentHtml}
      </body>
    </html>
  `;
    const apiUrl = '/file/post/htmltoPdf';
    const payload = { html: fullHtmlPayload };
    this.httpService.postBlob(apiUrl, payload, null, 'common').subscribe({
      next: (res) => {
        const a = document.createElement('a');
        a.download = `Application_Form_${this.formData[1]?.registration_no}.pdf`;
        // Ensure body is not null before creating object URL
        if (res.body) {
          a.href = window.URL.createObjectURL(res.body);
          a.click();
        }
        this.loader.hideLoader();
      },
      error: (err) => {
        console.error('❌ PDF Generation Failed:', err);
        this.loader.hideLoader();
      },
    });
  }

  getFileUrl(filePath: string | null): string {
    if (!filePath || typeof filePath !== 'string') return '';
    return `http://192.168.1.57:3500/${filePath.replace(/\\/g, '/')}`;
  }

  formatHeader(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  loadDeclaration(): void {
    const a_rec_adv_main_id = this.userData?.a_rec_adv_main_id;
    if (!a_rec_adv_main_id) {
      this.declarationText =
        'Could not load declaration: Advertisement ID missing.';
      return;
    }
    const apiUrl = `/master/get/getLatestAdvertisement?a_rec_adv_main_id=${a_rec_adv_main_id}`;
    this.httpService.getData(apiUrl, 'recruitement').subscribe({
      next: (response: any) => {
        const data = response?.body?.data?.[0];
        if (data && data.advertisement_declaration) {
          this.declarationText = this.sanitizer.bypassSecurityTrustHtml(
            data.advertisement_declaration
          );
        }
      },
      error: () => {
        this.declarationText = this.sanitizer.bypassSecurityTrustHtml(
          'Failed to load declaration. Please try again later.'
        );
      },
    });
  }

  private getProcessedSteps(): any[] {
    return Object.keys(this.formData)
      .map(Number)
      .filter((key) => key > 1)
      .sort((a, b) => a - b)
      .map((key) => {
        const stepData = this.formData[key];

        // ❌ Skip language repeat (THIS FIXES YOUR ISSUE)
        if (stepData.languages && stepData.languages.length > 0) {
          return null;
        }

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
    return (
      stepData &&
      Object.keys(stepData).some((key) => key.startsWith('qualifications'))
    );
  }

  private isExperienceStep(stepData: any): boolean {
    return (
      stepData && Object.keys(stepData).some((key) => /^\d+_\d+_\d+$/.test(key))
    );
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
            title:
              stepData.subheadings[key]?.score_field_title_name ||
              'Qualification',
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
        if (!/^\d+_\d+_\d+$/.test(key)) return null; // Ensure it's an experience key
        const experiences = stepData[key] || [];
        if (experiences.length > 0) {
          return {
            title:
              stepData.subheadings[key]?.score_field_title_name || 'Experience',
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
