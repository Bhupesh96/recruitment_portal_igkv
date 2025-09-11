import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedDataService } from '../../shared-data.service';
import html2pdf from 'html2pdf.js';
import { AlertService } from 'shared';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-step-9',
  standalone: true,
  templateUrl: './step-9.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./step-9.component.scss'],
})
export class Step9Component implements OnInit, OnDestroy {
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
  // Existing keys
  'a_rec_adv_main_id', 'post_code', 'session_id', 'subject_id', 'Salutation_E', 'Salutation_H',
  'photo', 'signature', '_isValid', 'candidate_photo', 'candidate_signature', 'presentSame',
  'Applicant_First_Name_E', 'Applicant_Middle_Name_E', 'Applicant_Last_Name_E',
  'registration_no', 'religion_code',

  // Add all Birth Place keys
  'Birth_Place', 'Birth_Country_Id', 'Birth_State_Id', 'Birth_District_Id',
  'Birth_Country_Name', 'Birth_State_Name', 'Birth_District_Name',

  // Add all Permanent Address keys
  'Permanent_Address1', 'Permanent_City', 'Permanent_Pin_Code',
  'Permanent_Country_Id', 'Permanent_State_Id', 'Permanent_District_Id',
  'Permanent_Country_Name', 'Permanent_State_Name', 'Permanent_District_Name',

  // Add all Current Address keys
  'Current_Address1', 'Current_City', 'Current_Pin_Code',
  'Current_Country_Id', 'Current_State_Id', 'Current_District_Id',
  'Current_Country_Name', 'Current_State_Name', 'Current_District_Name',
]);

  private destroy$ = new Subject<void>();

  constructor(
    private sharedDataService: SharedDataService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.sharedDataService.formData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: { [key: number]: any }) => {
        if (data && Object.keys(data).length > 0) {
          this.formData = data;
          console.log('✅ PDF Preview Data Received:', this.formData);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isExperienceKey(key: string): boolean {
    if (!key) return false;
    return /^\d+_\d+_\d+$/.test(key);
  }

  detailBelongsToSubheading(detail: any, items: any[]): boolean {
    if (!detail || !Array.isArray(items)) {
      return false;
    }
    return items.some(item => item.m_rec_score_field_id.toString() === detail.type.toString());
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
    return typeof value === 'string' && (value.startsWith('recruitment/') || value === 'FILE_UPLOADED');
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
        .map((item) => (typeof item === 'object' ? Object.values(item).join(', ') : item))
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

  // New helper function to get the name of a detail item from its type ID
  getDetailItemName(step: number, detailType: string): string {
    const stepData = this.formData[step];
    if (!stepData || !stepData['subheadings']) return 'Detail';

    for (const subheadKey of Object.keys(stepData['subheadings'])) {
      const subhead = stepData['subheadings'][subheadKey];
      if (subhead && Array.isArray(subhead.items)) {
        const foundItem = subhead.items.find((item: any) => item.m_rec_score_field_id.toString() === detailType.toString());
        if (foundItem) {
          return foundItem.score_field_name_e;
        }
      }
    }
    return 'Detail';
  }
getDisplayableKeys(obj: any): string[] {
  if (!obj) return [];
  // Filters out keys we don't want to show as columns in the tables
  return Object.keys(obj).filter(key => 
    !key.toLowerCase().includes('_id') &&
    !key.toLowerCase().includes('a_rec_app') &&
    !key.toLowerCase().includes('is_deleted') &&
    !key.startsWith('param_') &&
    key !== 'calculated_experience' // <-- ADD THIS LINE
  );
}
checkFilesForSubheading(sectionData: any, subheadKey: string): boolean {
  if (!sectionData || !sectionData.filePaths) {
    return false;
  }
  // Cleans the key (e.g., from "qualifications2_252_0" to "2_252_0")
  const cleanSubheadKey = subheadKey.replace('qualifications', '');
  
  // Checks if any key in filePaths starts with the cleaned subheading key
  return Object.keys(sectionData.filePaths).some(filePathKey => filePathKey.startsWith(cleanSubheadKey));
}
  
}

