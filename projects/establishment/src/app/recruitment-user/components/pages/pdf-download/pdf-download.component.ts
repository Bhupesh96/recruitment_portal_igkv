import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { SharedDataService } from '../shared-data.service'; // Adjust path
import { Subscription } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpService } from 'shared';
import {
  RecruitmentStateService,
  UserRecruitmentData,
} from '../recruitment-state.service';
interface Attachment {
  document: string | null;
  remark: string;
}

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
  constructor(
    private sharedDataService: SharedDataService,
    private sanitizer: DomSanitizer,
    private http: HttpService
  ) {}

  ngOnInit(): void {
    this.dataSubscription = this.sharedDataService.formData$.subscribe(
      (data) => {
        if (data && Object.keys(data).length > 0) {
          this.formData = data;
          this.isDataLoaded = true;
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  public printAsPdf(): void {
    if (!this.printContentRef?.nativeElement) {
      console.error('Print content could not be found.');
      return;
    }
    const printWindow = window.open(
      '',
      '_blank',
      'top=0,left=0,height=100%,width=auto'
    );
    if (!printWindow) {
      alert('Could not open print window. Please disable your pop-up blocker.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>Application Form - Print</title>
          <style>
            body { font-family: Arial, sans-serif; }
            @page {
              size: A4;
              margin: 6mm;
            }
            .a4-container {
              width: 595.28pt;
              padding: 17.01pt;
              box-sizing: border-box;
              background-color: white;
              margin: 0 auto;
            }
            .section {
              break-inside: avoid;
              margin-bottom: 11.34pt;
            }
            .section-heading-bar {
              background-color: #d1d5db !important;
              font-weight: 600;
              padding: 4px 8px;
              border-bottom: 1px solid black;
            }
            .sub-section-heading-bar {
              background-color: #f3f4f6 !important;
              font-weight: 600;
              padding: 4px 8px;
              border-bottom: 1px solid black;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body onload="window.print();window.close()">
          ${this.printContentRef.nativeElement.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  // --- Helper methods ---

  getFileUrl(filePath: string | null): string {
    if (!filePath || typeof filePath !== 'string') return '';
    return `http://192.168.1.57:3500/${filePath.replace(/\\/g, '/')}`;
  }

  formatValue(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    return String(value);
  }

  getQualificationSections(): {
    key: string;
    title: string;
    qualifications: any[];
  }[] {
    const step2Data = this.formData[2];
    if (!step2Data || !step2Data.subheadings) return [];

    return Object.keys(step2Data.subheadings)
      .map((key) => {
        const qualifications = step2Data[`qualifications${key}`] || [];
        if (qualifications.length > 0) {
          return {
            key: key,
            title:
              step2Data.subheadings[key]?.score_field_title_name ||
              'Qualification',
            qualifications: qualifications,
          };
        }
        return null;
      })
      .filter(
        (
          section
        ): section is { key: string; title: string; qualifications: any[] } =>
          section !== null
      );
  }

  getSubheadingsWithDetails(
    stepIndex: number
  ): { key: string; title: string; details: any[]; headers: string[] }[] {
    const stepData = this.formData[stepIndex];
    if (!stepData || !stepData.subheadings || !stepData.details) return [];

    return Object.keys(stepData.subheadings)
      .map((key) => {
        const subhead = stepData.subheadings[key];
        const subheadItemIds = (subhead.items || []).map((item: any) =>
          item.m_rec_score_field_id.toString()
        );
        const details = stepData.details.filter((detail: any) =>
          subheadItemIds.includes(detail.type.toString())
        );

        if (details.length > 0) {
          return {
            key: key,
            title: subhead.score_field_name_e || 'Details',
            details: details,
            headers: this.getDisplayableKeys(details[0]),
          };
        }
        return null;
      })
      .filter(
        (
          section
        ): section is {
          key: string;
          title: string;
          details: any[];
          headers: string[];
        } => section !== null
      );
  }

  getExperienceSections(): {
    key: string;
    title: string;
    experiences: any[];
    headers: string[];
  }[] {
    const step5Data = this.formData[5];
    if (!step5Data || !step5Data.subheadings) return [];

    return Object.keys(step5Data.subheadings)
      .map((key) => {
        const experiences = step5Data[key] || [];
        if (experiences.length > 0) {
          return {
            key: key,
            title:
              step5Data.subheadings[key]?.score_field_title_name ||
              'Experience',
            experiences: experiences,
            headers: this.getDisplayableKeys(experiences[0]),
          };
        }
        return null;
      })
      .filter(
        (
          section
        ): section is {
          key: string;
          title: string;
          experiences: any[];
          headers: string[];
        } => section !== null
      );
  }

  // ✨ FIXED THIS FUNCTION ✨
  getAttachmentsWithRemarks(): { type: string; remark: string }[] {
    const step7Data = this.formData[7];
    if (!step7Data || !Array.isArray(step7Data.attachments)) return [];

    const mappedAttachments = step7Data.attachments.map(
      (att: Attachment, index: number) => {
        if (att.remark && att.remark.trim() !== '') {
          const subheadKeys = Object.keys(step7Data.subheadings || {});
          const key = subheadKeys[index];
          if (key) {
            const type =
              step7Data.subheadings[key]?.score_field_title_name ||
              'Attachment';
            return { type, remark: att.remark };
          }
        }
        return null;
      }
    );

    // The type guard `item is { ... }` tells TypeScript that any nulls are filtered out.
    return mappedAttachments.filter(
      (item: any): item is { type: string; remark: string } => item !== null
    );
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
  getStepKeys(): number[] {
    if (!this.formData) return [];
    return Object.keys(this.formData)
      .map(Number)
      .filter((key) => key > 1) // We handle step 1 separately
      .sort((a, b) => a - b);
  }
  getFormDataKeys(dataObject: any): string[] {
    return dataObject ? Object.keys(dataObject) : [];
  }
  isQualificationStep(stepKey: number): boolean {
    const stepData = this.formData[stepKey];
    if (!stepData) return false;
    // Qualification data is unique because its keys start with "qualifications"
    return Object.keys(stepData).some((key) =>
      key.startsWith('qualifications')
    );
  }
   isExperienceStep(stepKey: number): boolean {
    const stepData = this.formData[stepKey];
    if (!stepData) return false;
    // Experience data is unique because it has keys matching the pattern 'NUM_NUM_NUM'
    return Object.keys(stepData).some(key => /^\d+_\d+_\d+$/.test(key));
  }
   isDetailsStep(stepKey: number): boolean {
    const stepData = this.formData[stepKey];
    // A "details" step has a `details` array and `subheadings` object.
    return stepData && Array.isArray(stepData.details) && stepData.subheadings;
  }
  getDisplayableKeys(obj: any): string[] {
    if (!obj) return [];
    return Object.keys(obj).filter(
      (key) =>
        !key.toLowerCase().includes('_id') &&
        !key.toLowerCase().includes('a_rec_app') &&
        !key.toLowerCase().includes('is_deleted') &&
        !key.startsWith('param_') &&
        key !== 'type' &&
        key !== 'calculated_experience'
    );
  }

  formatHeader(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
