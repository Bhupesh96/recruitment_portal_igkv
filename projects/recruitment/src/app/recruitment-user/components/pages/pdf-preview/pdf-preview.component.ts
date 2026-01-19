import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SharedDataService } from '../shared-data.service'; // Adjust path as needed
interface Attachment {
  document: string | null;
  remark: string;
}
@Component({
  selector: 'app-pdf-preview',
  templateUrl: './pdf-preview.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./pdf-preview.component.scss'],
})
export class PdfPreviewComponent implements OnInit {
  formData: { [key: number]: any } = {};
  today: Date = new Date();
  constructor(
    private router: Router,
    private sharedDataService: SharedDataService
  ) {}

  ngOnInit(): void {
    // this.formData = this.sharedDataService.getFormData();

    if (Object.keys(this.formData).length > 0) {
    } else {
    }
  }

  getFileUrl(filePath: string | null): string | null {
    if (!filePath) return null; // No fallback image, just return null
    const normalized = filePath
      .replace(/^recruitment[\\/]/, '')
      .replace(/\\/g, '/');

    return `http://192.168.1.57:3500/recruitment/${normalized}`;
  }
  hasAttachmentsWithRemarks(): boolean {
    if (!this.formData[7]?.attachments) return false;
    return (this.formData[7].attachments as Attachment[]).some(
      (attachment: Attachment) =>
        attachment.remark && attachment.remark.trim() !== ''
    );
  }

  getAttachmentType(index: number): string {
    const subHeadingKeys = Object.keys(this.formData[7]?.subheadings || {});
    if (index >= 0 && index < subHeadingKeys.length) {
      const key = subHeadingKeys[index];
      return (
        this.formData[7]?.subheadings?.[key]?.score_field_title_name ||
        'Attachment'
      );
    }
    return '';
  }

  getSerialNumber(originalIndex: number): number {
    if (!this.formData[7]?.attachments) return originalIndex + 1;

    const attachments = this.formData[7].attachments as Attachment[];
    let count = 0;
    for (let i = 0; i < originalIndex; i++) {
      if (
        attachments[i].remark &&
        attachments[i].remark.trim() !== '' &&
        this.getAttachmentType(i)
      ) {
        count++;
      }
    }
    return count + 1;
  }
  // Updated method to get qualification sections with keys
  getQualificationSections(): {
    key: string;
    title: string;
    isSelected: boolean;
    qualifications: any[];
  }[] {
    const step2Data = this.formData[2];
    if (!step2Data) return [];

    const sections = [
      {
        key: '2_72_0',
        title: '10+2 or Equivalent',
        isSelected: step2Data.is2_72_0Selected || false,
        qualifications: step2Data.qualifications2_72_0 || [],
      },
      {
        key: '3_72_1',
        title: 'Graduation',
        isSelected: step2Data.is3_72_1Selected || false,
        qualifications: step2Data.qualifications3_72_1 || [],
      },
      {
        key: '4_72_2',
        title: 'Post Graduation',
        isSelected: step2Data.is4_72_2Selected || false,
        qualifications: step2Data.qualifications4_72_2 || [],
      },
      {
        key: '6_72_3',
        title: 'Ph.D.',
        isSelected: step2Data.is6_72_3Selected || false,
        qualifications: step2Data.qualifications6_72_3 || [],
      },
      {
        key: '3080_72_4',
        title: 'Other Qualifications',
        isSelected: step2Data.is3080_72_4Selected || false,
        qualifications: step2Data.qualifications3080_72_4 || [],
      },
    ];

    return sections.filter(
      (section) => section.isSelected && section.qualifications.length > 0
    );
  }

  getSubHeadingKeys(subHeadings: { [key: string]: any }): string[] {
    return subHeadings ? Object.keys(subHeadings) : [];
  }

  formatSubHeadingTitle(key: string): string {
    // Fallback formatting for subheadings
    if (key === '3088') return 'Medals';
    if (key === '3092') return 'Fellowships';
    if (key === '35') return 'Certificates (Level 1)';
    if (key === '38') return 'Certificates (Level 2)';
    if (key === '41') return 'Inter-University/National Level';
    if (key === '3093') return 'Certificates (Level 3)';
    if (key === '3097') return 'Research Articles';
    if (key === '3098') return 'Conference Papers';
    if (key === '3109') return 'Other Publications';
    return this.formatKey(key);
  }

  hasAchievementsOrDetails(subHeadingKey: string): boolean {
    const achievements = this.getAchievements(subHeadingKey);
    const details = this.getAchievementDetails(subHeadingKey);
    return achievements.length > 0 || details.length > 0;
  }

  getAchievements(subHeadingKey: string): any[] {
    const subHeading = this.formData[3]?.subHeadings?.[subHeadingKey];
    if (!subHeading) return [];
    return Object.entries(subHeading)
      .filter(([_, value]: [string, any]) => value.count > 0)
      .map(([key, value]) => ({ key, value }));
  }

  getAchievementDetails(subHeadingKey: string): any[] {
    const step3Data = this.formData[3];
    if (!step3Data || !step3Data.details) return [];
    return step3Data.details.filter((detail: any) =>
      detail.type.startsWith(subHeadingKey)
    );
  }

  hasActivitiesOrDetails(subHeadingKey: string): boolean {
    const activities = this.getActivities(subHeadingKey);
    const details = this.getActivityDetails(subHeadingKey);
    return activities.length > 0 || details.length > 0;
  }

  getActivities(subHeadingKey: string): any[] {
    const subHeading = this.formData[6]?.subHeadings?.[subHeadingKey];
    if (!subHeading) return [];
    return Object.entries(subHeading)
      .filter(([_, value]: [string, any]) => value.count > 0)
      .map(([key, value]) => ({ key, value }));
  }

  getActivityDetails(subHeadingKey: string): any[] {
    const step6Data = this.formData[6];
    if (!step6Data || !step6Data.details) return [];
    return step6Data.details.filter((detail: any) =>
      detail.type.startsWith(subHeadingKey)
    );
  }

  getActivityDescription(subHeadingKey: string, activityKey: string): string {
    const step6Data = this.formData[6];
    if (!step6Data || !step6Data.details) return '-';
    const typeMap: { [key: string]: string } = {
      '35': '36',
      '38': '39',
    };
    const expectedType = typeMap[subHeadingKey];
    if (!expectedType) return '-';
    const detail = step6Data.details.find((d: any) => d.type === expectedType);
    return detail ? this.formatValue(detail.description) : '-';
  }

  hasPublicationsOrDetails(subHeadingKey: string): boolean {
    const publications = this.getPublications(subHeadingKey);
    const details = this.getPublicationDetails(subHeadingKey);
    return publications.length > 0 || details.length > 0;
  }

  getPublications(subHeadingKey: string): any[] {
    const subHeading = this.formData[4]?.subHeadings?.[subHeadingKey];
    if (!subHeading) return [];
    return Object.entries(subHeading)
      .filter(([_, value]: [string, any]) => value.count > 0)
      .map(([key, value]) => ({ key, value }));
  }

  getPublicationDetails(subHeadingKey: string): any[] {
    const step4Data = this.formData[4];
    if (!step4Data || !step4Data.details) return [];
    return step4Data.details.filter((detail: any) =>
      detail.type.startsWith(subHeadingKey)
    );
  }

  getPublicationDetail(
    subHeadingKey: string,
    publicationKey: string,
    field: string
  ): string {
    const step4Data = this.formData[4];
    if (!step4Data || !step4Data.details) return '-';
    const typeMap: { [key: string]: string } = {
      '3097': '3099',
    };
    const expectedType = typeMap[subHeadingKey];
    if (!expectedType) return '-';
    const detail = step4Data.details.find((d: any) => d.type === expectedType);
    return detail ? this.formatValue(detail[field]) : '-';
  }

  formatValue(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2).replace(/["{}]/g, '').trim();
    }
    return String(value);
  }

  formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .replace('B Certificate', 'B-Certificate')
      .replace('C Certificate', 'C-Certificate')
      .replace(
        'Inter University National Level',
        'Inter-University/National Level'
      )
      .replace('First Author', 'First Author')
      .replace('Co Author', 'Co-Author');
  }
}
