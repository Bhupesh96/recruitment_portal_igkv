import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output, Input } from '@angular/core';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { SharedDataService } from '../../shared-data.service';
import { AlertService, HttpService, LoaderService } from 'shared';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RecruitmentStateService, UserRecruitmentData } from '../../recruitment-state.service';
import { environment } from 'environment';

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
  @Output() downloadPdf = new EventEmitter<void>();
  @Input() activeSteps: any[] = [];
  formData: { [key: number]: { [key: string]: any } } = {};

  // ✅ Fallback dictionary mapping Component IDs to titles
  stepNames: { [key: number]: string } = {
    1: 'Personal Info',
    2: 'Education',
    3: 'Academics',
    4: 'Publications',
    5: 'Experience',
    6: 'Performance'
  };

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
  ]);

  private destroy$ = new Subject<void>();
  form: FormGroup;
  isSubmitted = false;
  declarationText: SafeHtml = '';
  paymentData: any = {};
  feeStatus: any = {};
  receipt_student_data_source_id!: number;
  isFinalDeclared: boolean = false;
  userData: any = null;

  constructor(
    private sharedDataService: SharedDataService,
    private alertService: AlertService,
    private fb: FormBuilder,
    private http: HttpService,
    private sanitizer: DomSanitizer,
    private loader: LoaderService,
    private recruitmentState: RecruitmentStateService,
  ) {
    this.form = this.fb.group({
      declaration: [false, Validators.requiredTrue],
    });
  }

  ngOnInit(): void {
    this.recruitmentState.userData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user: any) => {
        if (user) {
          this.userData = user; // ✅ Assign the user data here

          if (user['Is_Final_Decl_YN'] === 'Y' || user['is_final_decl_yn'] === 'Y') {
            this.isFinalDeclared = true;
            this.form.get('declaration')?.setValue(true, { emitEvent: false });
            this.form.get('declaration')?.disable({ emitEvent: false });
          }
        }
      });

    this.sharedDataService.formData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: { [key: number]: any }) => {
        if (data && Object.keys(data).length > 0) {
          this.formData = data;
          this.loadDeclaration();
          this.getTransactionAmountDetails();
        }
      });
  }

  get activeSectionIds(): number[] {
    // 1. If the parent Stepper passed the allowed steps, strictly enforce them!
    if (this.activeSteps && this.activeSteps.length > 0) {
      return this.activeSteps
        .map(step => step.compId)
        .filter(id => id >= 2 && id <= 6 && this.formData[id]); // Only keep valid middle steps
    }

    // 2. Fallback (Checks if the step actually has keys, not just an empty object)
    return [2, 3, 4, 5, 6].filter(id => {
      const data = this.formData[id];
      if (!data) return false;

      // Ensure it has actual form fields filled out
      const keys = Object.keys(data).filter(k => k !== '_isValid');
      return keys.length > 0;
    });
  }

  //  Safely resolves the section title based on API heading or fallback
  getStepName(compId: number): string {
    if (this.formData[compId]?.['heading']?.['score_field_title_name']) {
      return this.formData[compId]['heading']['score_field_title_name'];
    }
    return this.stepNames[compId] || 'Section Details';
  }

  loadDeclaration(): void {
    const a_rec_adv_main_id = this.formData[1]?.['a_rec_adv_main_id'] || this.userData?.a_rec_adv_main_id;
    if (!a_rec_adv_main_id) {
      this.declarationText = 'Could not load declaration: Advertisement ID missing.';
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

  getProcessedPersonalInfo(): { key: string; value: string }[] {
    const info = this.formData[1];
    if (!info) return [];

    const processedData: { key: string; value: string }[] = [];

    const fullNameE = [
      info['Salutation_E_Name'],
      info['Applicant_First_Name_E'],
      info['Applicant_Middle_Name_E'],
      info['Applicant_Last_Name_E'],
    ].filter(Boolean).join(' ');

    processedData.push({ key: 'Applicant Full Name (English)', value: fullNameE });

    const fullNameH = [
      info['Salutation_H_Name'],
      info['Applicant_First_Name_H'],
      info['Applicant_Middle_Name_H'],
      info['Applicant_Last_Name_H'],
    ].filter(Boolean).join(' ');

    processedData.push({ key: 'Applicant Full Name (Hindi)', value: fullNameH });

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
    processedData.push({ key: `Age as on ${new Date().toLocaleDateString('en-IN')}`, value: this.formatValue(info['age']) });

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

  onDownloadClicked() {
    this.downloadPdf.emit();
  }

  detailBelongsToSubheading(detail: any, items: any[]): boolean {
    if (!detail || !Array.isArray(items)) return false;
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
    if (value instanceof File) return true;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return true;
    return typeof value === 'string' && (value.startsWith('recruitment/') || value === 'FILE_UPLOADED');
  }

  checkFilesForSubheading(sectionData: any, subheadKey: string): boolean {
    if (!sectionData) return false;

    const cleanSubheadKey = subheadKey.replace('qualifications', '');
    if (
      sectionData['filePaths'] &&
      Object.keys(sectionData['filePaths']).some((filePathKey) =>
        filePathKey.startsWith(cleanSubheadKey)
      )
    ) {
      return true;
    }

    const dataArray = sectionData[cleanSubheadKey];
    if (Array.isArray(dataArray) && dataArray.length > 0) {
      return dataArray.some(
        (item) =>
          (item['Attachment'] && this.isFileValue(item['Attachment'])) ||
          (item['attachment'] && this.isFileValue(item['attachment']))
      );
    }
    return false;
  }

  formatValue(value: any): string {
    if (this.isFileValue(value)) return 'File Uploaded';
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) {
      return value.map((item) => typeof item === 'object' ? Object.values(item).join(', ') : item).join('; ');
    }
    if (typeof value === 'object' && !(value instanceof File)) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  getFileUrl(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') return '';
    return `${environment.recruitmentFileBaseUrl}/${filePath.replace(/\\/g, '/')}`;
  }

  getDetailItemName(step: number, detailType: string): string {
    const stepData = this.formData[step];
    if (!stepData || !stepData['subheadings']) return 'Detail';

    for (const subheadKey of Object.keys(stepData['subheadings'])) {
      const subhead = stepData['subheadings'][subheadKey];
      if (subhead && Array.isArray(subhead.items)) {
        const foundItem = subhead.items.find(
          (item: any) => item.m_rec_score_field_id.toString() === detailType.toString()
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
    if (!stepData || !stepData['details'] || !stepData['subheadings']) return [];

    const subhead = stepData['subheadings'][subheadKey];
    if (!subhead || !subhead.items) return [];

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
    if (!stepData || !stepData['details'] || !stepData['subheadings']) return false;

    const subhead = stepData['subheadings'][subheadKey];
    if (!subhead || !subhead.items) return false;

    return stepData['details'].some((detail: any) =>
      this.detailBelongsToSubheading(detail, subhead.items)
    );
  }

  submit(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.form.invalid) {
        this.alertService.alert(true, 'You must accept the declaration to proceed.');
        return reject(new Error('Declaration not accepted.'));
      }

      const registrationNo = this.formData[1]?.['registration_no'];
      const a_rec_app_main_id = this.formData[1]?.['a_rec_app_main_id'];

      if (!registrationNo) {
        this.alertService.alert(true, 'Cannot submit. Registration number is missing.');
        return reject(new Error('Registration number missing.'));
      }

      this.loader.show();
      this.isSubmitted = true;
      this.form.disable();

      const payload = {
        registration_no: registrationNo,
        a_rec_app_main_id: a_rec_app_main_id,
      };

      this.http.postForm('/candidate/postFile/updateFinalDeclaration', payload, 'recruitement').subscribe({
        next: async (res: any) => {
          this.loader.hide();
          if (res?.body?.error) {
            this.alertService.alert(true, res.body.error.message || 'An unknown error occurred.');
            this.isSubmitted = false;
            this.form.enable();
            reject(new Error(res.body.error.message));
          } else {
            this.recruitmentState.updateUserData({ Is_Final_Decl_YN: 'Y' });
            this.isFinalDeclared = true;
            await this.alertService.alert(false, 'Application Submitted Successfully!');
            this.finalSubmitSuccess.emit();
            resolve();
            if (this.feeStatus?.transaction_status !== 'S') {
              this.onPayClicked();
            }
          }
        },
        error: (err) => {
          this.loader.hide();
          this.alertService.alert(true, 'A server error occurred. Please try again.');
          this.isSubmitted = false;
          this.form.enable();
          reject(err);
        },
      });
    });
  }

  getTransactionAmountDetails() {
    if (!this.formData[1]) return;
    const params = {
      purpose_id: 19,
      advertisement_id: this.formData[1]["a_rec_adv_main_id"],
      category_code: this.formData[1]["candidate_category_id"]
    };

    this.http.getParam('/fee/get/getTransactionAmountDetails/', params, 'academic').subscribe((result: any) => {
      this.paymentData = !result.body.error ? result.body.data[0] : [];
      this.getFeeStatus();
    });
  }

  async onPayClicked() {
    const result = await this.alertService.confirmAlert_custom(
      'Proceed to Payment?',
      'Do you want to continue with the payment?',
      'question',
      { confirmText: 'Yes, Pay Now', cancelText: 'No, Cancel' }
    );

    if (result.isConfirmed) {
      try {
        this.makePayment();
      } catch (error) {
        this.alertService.alert(true, 'Transfer failed');
      }
    }
  }

  private payloadForPay() {
    const info = this.formData[1] || {};
    const payData = this.paymentData || {};

    const payee_detail = {
      advertisement_id: info["a_rec_adv_main_id"],
      purpose_id: 19,
      fee_purpose_name: 'Recruitment Application Fee',
      payee_id: info["registration_no"],
      payee_name: info["Applicant_First_Name_E"],
      category: info["candidate_category_id"],
      email: info["Email_Id"],
      mobile: info["Mobile_No"],
      paymentgatewayid: 5,
      receipt_student_data_source_id: payData?.receipt_student_data_source_id,
      applied_session: info["session_id"],
      fee_id: payData?.fee_id,
      fee_type_id: payData?.fee_type_id,
      amount: payData?.fee_amount,
      fee_status: payData?.fee_status,
      total: payData?.fee_amount,
      no_of_subject: 1
    };

    return { payee_detail };
  }

  makePayment() {
    const payload = this.payloadForPay();

    if (!payload.payee_detail.amount || !payload.payee_detail.receipt_student_data_source_id) {
      this.alertService.alert(true, 'Payment amount could not be loaded. Please refresh the page and try again.');
      return;
    }

    this.receipt_student_data_source_id = payload.payee_detail.receipt_student_data_source_id;
    this.alertService.showLoading('Processing Payment', 'Please wait...');

    this.http.postData('/fee/post/saveTransactionPayeeDetail', payload, 'academic').subscribe({
      next: (res: any) => {
        this.alertService.closeAlert();
        const data = res?.body?.data?.payment;

        if (data?.order_id && data?.key && data?.amount) {
          this.openRazorpayCheckout(data);
        } else {
          this.alertService.alert(true, 'Payment gateway could not be initiated.');
        }
      },
      error: (err) => {
        this.alertService.closeAlert();
        this.alertService.alert(true, 'Server not reachable or failed.');
      },
    });
  }

  private openRazorpayCheckout(data: any) {
    const options: any = {
      key: data?.key,
      amount: data?.amount,
      currency: 'INR',
      name: 'Mahatma Gandhi Udyanikee Evam Vanikee Vishwavidyalaya',
      description: data?.fee_purpose_name,
      image: 'projects/shared/assets/other/logo.png',
      order_id: data.order_id,
      handler: (response: any) => {
        this.verifyPayment(response, data);
      },
      prefill: {
        name: data?.name,
        email: data?.email,
        contact: data?.contact,
      },
      notes: {
        purpose: data?.purpose,
        refNo: data?.receipt,
      },
      theme: {
        color: '#198754',
      },
    };

    const rzp = new (window as any).Razorpay(options);

    rzp.on('payment.failed', (response: any) => {
      this.alertService.alert(true, response.error.description || 'Transaction failed.');

      const failurePayload = {
        order_id: response.error?.metadata?.order_id,
        payment_id: response.error?.metadata?.payment_id,
        reason: response.error?.reason,
        description: response.error?.description,
        code: response.error?.code,
        step: response.error?.step,
        source: response.error?.source,
        refNo: data?.receipt,
      };

      this.http.postData('/fee/post/razorpayPaymentFailed', failurePayload, 'academic').subscribe({
        next: (res: any) => console.log('📝 Payment failure logged:', res),
        error: (err) => console.error('⚠️ Failed to log payment failure:', err),
      });
    });

    rzp.open();
  }

  private verifyPayment(paymentResponse: any, data: any) {
    const payload = {
      razorpay_order_id: paymentResponse?.razorpay_order_id,
      razorpay_payment_id: paymentResponse?.razorpay_payment_id,
      razorpay_signature: paymentResponse?.razorpay_signature,
      refNo: data?.receipt,
      receipt_student_data_source_id: this.receipt_student_data_source_id
    };

    this.loader.showLoader();

    this.http.postData('/fee/post/razorPayPaymentVerification', payload, 'academic').subscribe({
      next: (res: any) => {
        this.loader.hideLoader();
        const responseData = res?.body?.data || res?.data || res;

        if (responseData?.success) {
          this.alertService.alert(false, responseData.message || 'Payment Verified Successfully!');
          this.getFeeStatus();
        } else {
          this.alertService.alert(true, responseData?.message || 'Could not verify payment.');
        }
      },
      error: (err) => {
        this.loader.hideLoader();
        this.alertService.alert(true, 'Server not reachable for verification.');
      },
    });
  }

  getFeeStatus() {
    if (!this.formData[1]) return;

    const params = {
      payee_id: this.formData[1]["registration_no"],
      advertisement_id: this.formData[1]["a_rec_adv_main_id"]
    };

    this.http.getParam('/fee/get/getFeeStatus/', params, 'academic').subscribe((result: any) => {
      this.feeStatus = !result.body.error ? result.body.data[0] : [];
    });
  }
}
