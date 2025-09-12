import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedDataService } from '../shared-data.service'; // Adjust path as needed
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-pdf-download',
  standalone: true, // Make sure standalone is correct for your project setup
  templateUrl: './pdf-download.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./pdf-download.component.scss'],
})
export class PdfDownloadComponent implements OnInit, OnDestroy {
  formData: { [key: number]: any } = {};
  today: Date = new Date();
  private destroy$ = new Subject<void>();

  // Exclude keys from the generic personal info grid
  personalInfoExcludeKeys = new Set([
    'a_rec_adv_main_id', 'post_code', 'session_id', 'subject_id', 'Salutation_E', 'Salutation_H',
    'photo', 'signature', '_isValid', 'candidate_photo', 'candidate_signature', 'presentSame',
    'Applicant_First_Name_E', 'Applicant_Middle_Name_E', 'Applicant_Last_Name_E', 'Applicant_First_Name_H',
    'Applicant_Middle_Name_H', 'Applicant_Last_Name_H', 'registration_no', 'religion_code',
    'Salutation_E_Name', 'Salutation_H_Name', 'advertisment_name', 'registration_date', 'post_name',
    'Subject_Name_E', 'payment_ref', 'payment_date', 'payment_amount', 'bank_ref', 'languages',
    'additionalInfoDetails', 'Permanent_Address1', 'Permanent_City', 'Permanent_Pin_Code',
    'Permanent_Country_Id', 'Permanent_State_Id', 'Permanent_District_Id', 'Permanent_Country_Name',
    'Permanent_State_Name', 'Permanent_District_Name', 'Current_Address1', 'Current_City',
    'Current_Pin_Code', 'Current_Country_Id', 'Current_State_Id', 'Current_District_Id',
    'Current_Country_Name', 'Current_State_Name', 'Current_District_Name', 'Birth_Place',
    'Birth_Country_Id', 'Birth_State_Id', 'Birth_District_Id', 'Birth_Country_Name',
    'Birth_State_Name', 'Birth_District_Name',
  ]);

  constructor(private sharedDataService: SharedDataService) {}

  ngOnInit(): void {
    this.sharedDataService.formData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: { [key: number]: any }) => {
        if (data && Object.keys(data).length > 0) {
          this.formData = data;
          console.log('✅ PDF Data Received:', this.formData);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Helper Functions Ported from Preview Component ---

  getFormDataKeys(dataObject: any): string[] {
    return dataObject ? Object.keys(dataObject) : [];
  }

  formatKey(key: string): string {
    if (!key) return '';
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  formatValue(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (typeof value === 'string' && value.startsWith('recruitment/')) {
        return 'File Uploaded';
    }
    if (Array.isArray(value)) {
      return value.map(item => typeof item === 'object' ? Object.values(item).join(', ') : item).join('; ');
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
  }

  getFileUrl(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') return '';
    // Using your existing URL structure
    return `http://192.168.1.57:3500/${filePath.replace(/\\/g, '/')}`;
  }

  getDisplayableKeys(obj: any): string[] {
    if (!obj) return [];
    return Object.keys(obj).filter(key =>
      !key.toLowerCase().includes('_id') &&
      !key.toLowerCase().includes('a_rec_app') &&
      !key.toLowerCase().includes('is_deleted') &&
      !key.startsWith('param_') &&
      key !== 'calculated_experience'
    );
  }
  
  isExperienceKey(key: string): boolean {
    if (!key) return false;
    return /^\d+_\d+_\d+$/.test(key);
  }

  detailBelongsToSubheading(detail: any, items: any[]): boolean {
    if (!detail || !items || !Array.isArray(items)) {
      return false;
    }
    return items.some(item => item.m_rec_score_field_id.toString() === detail.type.toString());
  }

  getDetailItemName(step: number, detailType: string): string {
    const stepData = this.formData[step];
    if (!stepData || !stepData.subheadings) return 'Detail';

    for (const subheadKey of Object.keys(stepData.subheadings)) {
      const subhead = stepData.subheadings[subheadKey];
      if (subhead && Array.isArray(subhead.items)) {
        const foundItem = subhead.items.find((item: any) => item.m_rec_score_field_id.toString() === detailType.toString());
        if (foundItem) {
          return foundItem.score_field_name_e;
        }
      }
    }
    return 'Detail';
  }
}