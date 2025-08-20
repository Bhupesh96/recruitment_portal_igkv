import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ChangeDetectorRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  filter,
  of,
  catchError,
  map,
  Observable,
} from 'rxjs';
import { Step1Service } from './step-1.service';
import { HttpService, SharedModule } from 'shared';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { UtilsService } from './utils.service';
import { AlertService } from 'shared';

@Component({
  selector: 'app-step-1',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, SharedModule],
  templateUrl: './step-1.component.html',
  styleUrls: ['./step-1.component.scss'],
})
export class Step1Component implements OnChanges, OnInit {
  @Output() formData = new EventEmitter<{ [key: string]: any }>();
  @Input() triggerValidation = false;

  form: FormGroup;
  salutations: {
    salutation_id: number;
    salutation_name_e: string;
    salutation_name_h: string;
  }[] = [];
  subjectList: { subject_id: number; Subject_Name_E: string }[] = [];
  religionList: { religion_code: string; religion_name: string }[] = [];
  countryList: { country_id: number; country_name: string }[] = [];
  stateList: { state_id: number; name: string }[] = [];
  districtList: { district_id: number; district_name: string }[] = [];
  languageTypes: any[] = [];
  languages: any[] = [];
  languageSkills: any[] = [];
  postList: { post_code: number; post_name: string }[] = [];
  advertisementList: {
    a_rec_adv_main_id: number;
    advertisment_name: string;
  }[] = [];
  photoPreview: string | null = null;
  signaturePreview: string | null = null;
  filePaths: Map<string, string> = new Map();

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private HTTP: HttpService,
    private step1Service: Step1Service,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private alert: AlertService,
    private utils: UtilsService
  ) {
    this.form = this.fb.group({
      registration_no: ['24000001', Validators.required],
      a_rec_adv_main_id: ['1', Validators.required],
      post_name: [''],
      post_code: ['', Validators.required],
      session_id: ['2', Validators.required],
      subject_id: [''],
      Salutation_E: ['', Validators.required],
      Salutation_H: ['', Validators.required],
      Applicant_First_Name_E: ['', Validators.required],
      Applicant_Middle_Name_E: [''],
      Applicant_Last_Name_E: ['', Validators.required],
      Applicant_First_Name_H: ['', Validators.required],
      Applicant_Middle_Name_H: [''],
      Applicant_Last_Name_H: ['', Validators.required],
      Applicant_Father_Name_E: ['', Validators.required],
      Applicant_Mother_Name_E: ['', Validators.required],
      candidate_category_id: ['', Validators.required],
      Gender_Id: ['', Validators.required],
      DOB: ['', Validators.required],
      age: [{ value: '', disabled: true }],
      Mobile_No: ['', Validators.required],
      Email_Id: ['', [Validators.required, Validators.email]],
      Birth_Place: ['', Validators.required],
      Birth_District_Id: ['', Validators.required],
      Birth_State_Id: ['', Validators.required],
      Birth_Country_Id: ['', Validators.required],
      Identification_Mark1: ['', Validators.required],
      Identification_Mark2: ['', Validators.required],
      religion_code: ['', Validators.required],
      Is_CG_Domocile: ['Y'],
      Is_Local_Lang_Knowledge: ['Y'],
      Is_Disability: ['N'],
      Is_Married_YN: ['N', Validators.required],
      In_Service_YN: ['N', Validators.required],
      Permanent_Address1: ['', Validators.required],
      Permanent_City: ['', Validators.required],
      Permanent_District_Id: ['', Validators.required],
      Permanent_State_Id: ['', Validators.required],
      Permanent_Country_Id: ['', Validators.required],
      Permanent_Pin_Code: ['', Validators.required],
      Current_Address1: ['', Validators.required],
      Current_City: ['', Validators.required],
      Current_District_Id: ['', Validators.required],
      Current_State_Id: ['', Validators.required],
      Current_Country_Id: ['', Validators.required],
      Current_Pin_Code: ['', Validators.required],
      presentSame: [false],
      languages: this.fb.array([this.createLanguageGroup()]),
      photo: [null, Validators.required],
      signature: [null, Validators.required],
    });

    this.setupLiveHindiTranslation();
    this.emitFormData();
  }

  getFileUrl(fileName: string): string {
    const normalized = fileName
      .replace(/^services[\\/]/, '')
      .replace(/\\/g, '/');
    return `http://192.168.1.57:3500/${normalized}`;
  }

  calculateExp() {
    const experiences = [
      {
        from: new Date('2018-06-01'),
        to: new Date('2024-06-11'),
        weight: 1.0,
        toMaxvalue: 3.0,
      },
      {
        from: new Date('2024-06-12'),
        to: new Date('2025-07-22'),
        weight: 1.0,
        toMaxvalue: 4.0,
      },
    ];

    const parentWeightage = 4.0;

    const expCal = this.utils.calculateTotalExperience(
      experiences,
      parentWeightage
    );

    console.log(
      '🟢 JSON Each Experience Details:',
      JSON.stringify(expCal.details, null, 2)
    );
    console.log('Score_field_value (Total Days):', expCal.totalDays);
    console.log(
      'Score_field_actual_value (Decimal Years):',
      expCal.totalDecimalYears
    );
    console.log(
      'Score_field_calculated_value:',
      expCal.score_field_calculated_value
    );

    //education
    const eduCal = this.utils.calculateEducationScore(
      [
        { scoreFieldId: 2, weight: 0.5, inputValue: 97, maxValue: 5.0 }, // 10th
        { scoreFieldId: 3, weight: 1.5, inputValue: 84.5, maxValue: 15.0 }, // UG
        { scoreFieldId: 4, weight: 1.5, inputValue: 86.1, maxValue: 15.0 }, // PG
        { scoreFieldId: 6, weight: 1.5, inputValue: 77.0, maxValue: 15.0 }, // Optional if NET Ok (Phd)
        {
          scoreFieldId: 3080,
          weight: 0.0,
          inputValue: 0.0,
          maxValue: 15.0,
        }, // Optional if Phd Ok (NET)
      ],
      60 // Parent field marks
    );

    console.log(
      '🟢 JSON Education Calculation:',
      JSON.stringify(eduCal.details, null, 2)
    );
    console.log(
      'Score_field_actual_value (Total actual value):',
      eduCal.total_actual_value
    ); // Parent actual field marks
    console.log(
      'Score_field_calculated_value (Total Calculated):',
      eduCal.score_field_calculated_value
    ); // Parent calcalated field marks

    const quantityScoreInput = [
      { scoreFieldId: 3088, quantity: 1, weightage: 2.0, scoreFieldMarks: 6.0 },
      { scoreFieldId: 3092, quantity: 2, weightage: 2.0, scoreFieldMarks: 2.0 },
    ];

    const parentMarks = 8.0;

    const result = this.utils.calculateQuantityBasedScore(
      quantityScoreInput,
      parentMarks
    );

    console.log(
      '🟢 Quantity Score Details:',
      JSON.stringify(result.details, null, 2)
    );
    console.log(
      'Score_field_actual_value (Total actual value):',
      result.total_actual_value
    ); // should be 5.00
    console.log(
      'Score_field_calculated_value (Total Calculated):',
      result.score_field_calculated_value
    ); // should be 5.00
  }
  ngOnInit(): void {
    this.calculateExp();
    this.step1Service.getUserData().subscribe({
      next: (response: any) => {
        console.log('User Data ', JSON.stringify(response.body, null, 2));
        const data = response?.body?.data?.[0];

        if (data.candidate_photo) {
          this.filePaths.set('photo', data.candidate_photo);
          this.photoPreview = this.getFileUrl(data.candidate_photo);
        }
        if (data.candidate_signature) {
          this.filePaths.set('signature', data.candidate_signature);
          this.signaturePreview = this.getFileUrl(data.candidate_signature);
        }

        this.form.patchValue({
          post_code: data.post_code,
          subject_id: data.subject_id,
          registration_no: data.reg_registration_no,
          a_rec_adv_main_id: data.a_rec_adv_main_id,
          session_id: data.academic_session_id,
          advertisementNo: data.advertisment_no,
          Salutation_E: data.Salutation_E,
          Salutation_H: data.Salutation_E,
          Applicant_First_Name_E: data.Applicant_First_Name_E,
          Applicant_Middle_Name_E: data.Applicant_Middle_Name_E,
          Applicant_Last_Name_E: data.Applicant_Last_Name_E,
          Applicant_First_Name_H: data.Applicant_First_Name_H,
          Applicant_Middle_Name_H: data.Applicant_Middle_Name_H,
          Applicant_Last_Name_H: data.Applicant_Last_Name_H,
          Applicant_Father_Name_E: data.Applicant_Father_Name_E,
          Applicant_Mother_Name_E: data.Applicant_Mother_Name_E,
          candidate_category_id: data.candidate_category_id,
          Gender_Id: data.Gender_Id,
          DOB: this.formatDateToYYYYMMDD(data.DOB),
          Mobile_No: data.app_mobile_no,
          Email_Id: data.app_email_id,
          Birth_Place: data.Birth_Place,
          Birth_District_Id: data.Birth_District_Id,
          Birth_State_Id: data.Birth_State_Id,
          Birth_Country_Id: data.Birth_Country_Id,
          Identification_Mark1: data.Identification_Mark1,
          Identification_Mark2: data.Identification_Mark2,
          religion_code: data.religion_code,
          Is_CG_Domocile: data.Is_CG_Domocile,
          Is_Local_Lang_Knowledge: data.Is_Local_Lang_Knowledge,
          Is_Disability: data.Is_Disability,
          Is_Married_YN: data.Is_Married_YN,
          In_Service_YN: data.In_Service_YN,
          Permanent_Address1: data.Permanent_Address1,
          Permanent_City: data.Permanent_City,
          Permanent_District_Id: data.Permanent_District_Id,
          Permanent_State_Id: data.Permanent_State_Id,
          Permanent_Country_Id: data.Permanent_Country_Id,
          Permanent_Pin_Code: data.Permanent_Pin_Code,
          Current_Address1: data.Current_Address1,
          Current_City: data.Current_City,
          Current_District_Id: data.Current_District_Id,
          Current_State_Id: data.Current_State_Id,
          Current_Country_Id: data.Current_Country_Id,
          Current_Pin_Code: data.Current_Pin_Code,
        });

        const sameAddress =
          data.Permanent_Address1 === data.Current_Address1 &&
          data.Permanent_City === data.Current_City &&
          data.Permanent_District_Id === data.Current_District_Id &&
          data.Permanent_State_Id === data.Current_State_Id &&
          data.Permanent_Country_Id === data.Current_Country_Id &&
          data.Permanent_Pin_Code === data.Current_Pin_Code;

        this.form.patchValue({
          presentSame: sameAddress,
        });

        if (sameAddress) {
          this.copyPermanentToCurrentAddress();
          this.disableCurrentAddressFields();
        }

        this.step1Service.getSavedLanguages().subscribe({
          next: (response: any) => {
            const langData = response?.body?.data || [];
            const langFormArray = this.form.get('languages') as FormArray;
            langFormArray.clear();

            langData.forEach((lang: any) => {
              langFormArray.push(
                this.fb.group({
                  a_rec_app_language_detail_id: [
                    lang.a_rec_app_language_detail_id || null,
                  ],
                  m_rec_language_type_id: [
                    lang.m_rec_language_type_id,
                    Validators.required,
                  ],
                  m_rec_language_id: [
                    lang.m_rec_language_id,
                    Validators.required,
                  ],
                  m_rec_language_skill_id: [
                    lang.m_rec_language_skill_id,
                    Validators.required,
                  ],
                })
              );
            });
          },
          error: (err) =>
            this.alert.alert(
              true,
              'Failed to load saved language data. Please try again.',
              5000
            ),
        });

        this.postList = [
          {
            post_code: data.post_code,
            post_name: data.post_name,
          },
        ];

        this.advertisementList = [
          {
            a_rec_adv_main_id: data.a_rec_adv_main_id,
            advertisment_name: data.advertisment_name,
          },
        ];

        this.cdr.markForCheck();
      },
      error: (err) => {
        this.alert.alert(
          true,
          'Error loading user data from session. Please try again.',
          5000
        );
        this.cdr.markForCheck();
      },
    });

    this.form.get('DOB')?.valueChanges.subscribe((dobValue) => {
      if (dobValue) {
        const dob = new Date(dobValue);
        const today = new Date();

        let years = today.getFullYear() - dob.getFullYear();
        let months = today.getMonth() - dob.getMonth();
        let days = today.getDate() - dob.getDate();

        if (days < 0) {
          months--;
          const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
          days += prevMonth.getDate();
        }

        if (months < 0) {
          years--;
          months += 12;
        }

        const ageString = `${years} year${
          years !== 1 ? 's' : ''
        }, ${months} month${months !== 1 ? 's' : ''}, ${days} day${
          days !== 1 ? 's' : ''
        }`;
        this.form.get('age')?.setValue(ageString, { emitEvent: false });

        if (years < 18) {
          this.form.get('age')?.setErrors({ underage: true });
        } else {
          this.form.get('age')?.setErrors(null);
        }
      } else {
        this.form.get('age')?.setValue('', { emitEvent: false });
        this.form.get('age')?.setErrors(null);
      }
    });

    this.getSalutation();
    this.form
      .get('a_rec_adv_main_id')
      ?.valueChanges.subscribe((advertisementId) => {
        if (advertisementId) {
          this.step1Service.getPostByAdvertisement(advertisementId).subscribe({
            next: (response: any) => {
              this.postList = response?.body?.data;
            },
          });
        }
      });

    this.form.get('post_code')?.valueChanges.subscribe((postCode) => {
      if (postCode) {
        this.step1Service.getSubjectsByPostCode(postCode).subscribe({
          next: (response: any) => {
            this.subjectList = response?.body?.data;
          },
          error: (err) => {
            this.alert.alert(
              true,
              'Failed to load subjects for this post. Please try again.',
              5000
            );
            this.subjectList = [];
            this.form.get('subject_id')?.setValue('');
          },
        });
      }
    });

    this.step1Service.getReligions().subscribe({
      next: (response) => {
        this.religionList = response?.body?.data || [];
      },
      error: (err) => {
        this.alert.alert(
          true,
          'Error loading religions. Please try again.',
          5000
        );
      },
    });

    this.step1Service.getCountries().subscribe({
      next: (response) => {
        this.countryList = response?.body?.data || [];
      },
      error: (err) => {
        this.alert.alert(
          true,
          'Error loading countries. Please try again.',
          5000
        );
      },
    });

    this.step1Service.getStates().subscribe({
      next: (response) => {
        this.stateList = response?.body?.data;
      },
      error: (err) => {
        this.alert.alert(true, 'Error loading states. Please try again.', 5000);
      },
    });

    let lastPermanentStateId: number | null = null;
    this.form.get('Permanent_State_Id')?.valueChanges.subscribe((stateId) => {
      if (stateId && stateId !== lastPermanentStateId) {
        lastPermanentStateId = stateId;
        this.step1Service.getDistrictsByState(stateId).subscribe({
          next: (response: any) => {
            this.districtList = response?.body?.data || [];

            const existingDistrictId = this.form.get(
              'Permanent_District_Id'
            )?.value;
            const found = this.districtList.some(
              (d) => d.district_id === existingDistrictId
            );
            if (!found) {
              this.form.get('Permanent_District_Id')?.setValue('');
            }
          },
          error: (err) => {
            this.alert.alert(
              true,
              'Error loading districts. Please try again.',
              5000
            );
            this.districtList = [];
            this.form.get('Permanent_District_Id')?.setValue('');
          },
        });
      } else if (!stateId) {
        this.districtList = [];
        this.form.get('Permanent_District_Id')?.setValue('');
      }
    });

    this.step1Service.getLanguageTypes().subscribe({
      next: (response) => (this.languageTypes = response?.body?.data),
      error: (err) =>
        this.alert.alert(
          true,
          'Error loading language types. Please try again.',
          5000
        ),
    });

    this.step1Service.getLanguages().subscribe({
      next: (response) => {
        this.languages = response?.body?.data;
      },
      error: (err) =>
        this.alert.alert(
          true,
          'Error loading languages. Please try again.',
          5000
        ),
    });

    this.step1Service.getAdvertisement().subscribe({
      next: (response) => {
        this.advertisementList = response?.body?.data;
      },
    });

    this.step1Service.getLanguageSkills().subscribe({
      next: (response) => (this.languageSkills = response?.body?.data),
      error: (err) =>
        this.alert.alert(
          true,
          'Error loading skills. Please try again.',
          5000
        ),
    });

    this.form.get('presentSame')?.valueChanges.subscribe((isSame: boolean) => {
      if (isSame) {
        this.copyPermanentToCurrentAddress();
        this.disableCurrentAddressFields();
      } else {
        this.clearCurrentAddress();
        this.enableCurrentAddressFields();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['triggerValidation'] && this.triggerValidation) {
      this.markFormGroupTouched(this.form);
    }
  }

  // File Selection Handlers
  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      this.form.get('photo')?.setValue(file);
      this.filePaths.delete('photo');
      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreview = reader.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }
  }

  onSignatureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      this.form.get('signature')?.setValue(file);
      this.filePaths.delete('signature');
      const reader = new FileReader();
      reader.onload = () => {
        this.signaturePreview = reader.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }
  }

  getFilePath(key: string): string | null {
    const filePath = this.filePaths.get(key);

    return filePath || null;
  }

  sanitizeFileUrl(filePath: string): SafeUrl {
    const fileName = filePath.split('\\').pop() || filePath;
    const url = `http://192.168.1.57:3500/${fileName}`;

    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  getFileName(filePath: string): string {
    const fileName = filePath.split('\\').pop() || 'Unknown File';

    return fileName;
  }

  clearPhoto(): void {
    this.form.get('photo')?.reset();
    this.photoPreview = null;
    this.filePaths.delete('photo');
    const input = document.getElementById('photoInput') as HTMLInputElement;
    if (input) input.value = '';
    this.cdr.markForCheck();
  }

  clearSignature(): void {
    this.form.get('signature')?.reset();
    this.signaturePreview = null;
    this.filePaths.delete('signature');
    const input = document.getElementById('signatureInput') as HTMLInputElement;
    if (input) input.value = '';
    this.cdr.markForCheck();
  }

  // Form Submission
  submitForm(): void {
    // Note: The original code has the form validation check commented out.
    // If you uncomment it, you can replace the native alert with your service.
    // if (!this.form.valid) {
    //   this.markFormGroupTouched(this.form);
    //   console.log('❌ Form is invalid:', this.form.errors);
    //   this.alert.alert(true, 'Please fill all required fields.', 5000);
    //   return;
    // }

    const mainPayload = this.form.getRawValue();
    mainPayload.registration_no = '24000001';

    const numericFields = [
      'subject_id',
      'post_code',
      'session_id',
      'a_rec_adv_main_id',
      'Salutation_E',
      'Salutation_H',
      'Birth_District_Id',
      'Birth_State_Id',
      'Birth_Country_Id',
      'Permanent_District_Id',
      'Permanent_State_Id',
      'Permanent_Country_Id',
      'Current_District_Id',
      'Current_State_Id',
      'Current_Country_Id',
      'candidate_category_id',
    ];

    numericFields.forEach((field) => {
      if (mainPayload[field] === '') {
        delete mainPayload[field];
      } else {
        mainPayload[field] = Number(mainPayload[field]);
      }
    });

    const languagePayload = this.languagesArray.controls.map((ctrl) => ({
      a_rec_app_language_detail_id:
        ctrl.get('a_rec_app_language_detail_id')?.value || null,
      registration_no: mainPayload.registration_no,
      a_rec_adv_main_id: mainPayload.a_rec_adv_main_id,
      m_rec_language_type_id: Number(ctrl.get('m_rec_language_type_id')!.value),
      m_rec_language_id: Number(ctrl.get('m_rec_language_id')!.value),
      m_rec_language_skill_id: Number(
        ctrl.get('m_rec_language_skill_id')!.value
      ),
    }));

    const formData = new FormData();
    formData.append('registration_no', mainPayload.registration_no);
    formData.append('table_name', 'a_rec_app_main');
    formData.append('database_name', 'igkv_Recruitment');
    formData.append('mainPayload', JSON.stringify(mainPayload));
    formData.append('languages', JSON.stringify(languagePayload));

    const photoFile = this.form.get('photo')?.value as File;
    const signatureFile = this.form.get('signature')?.value as File;

    const allowedImageTypes = ['image/jpeg', 'image/png'];
    if (photoFile && !allowedImageTypes.includes(photoFile.type)) {
      this.alert.alert(true, 'Photo must be a JPEG or PNG file.', 5000);
      return;
    }
    if (signatureFile && !allowedImageTypes.includes(signatureFile.type)) {
      this.alert.alert(true, 'Signature must be a JPEG or PNG file.', 5000);
      return;
    }

    if (photoFile) {
      const photoFileName = `photo_${
        mainPayload.registration_no
      }_${Date.now()}${photoFile.name.endsWith('.png') ? '.png' : '.jpg'}`;
      formData.append('photo', photoFile, photoFileName);
      mainPayload.candidate_photo = `recruitment/${mainPayload.registration_no}/${photoFileName}`;
    } else if (this.filePaths.get('photo')) {
      mainPayload.candidate_photo = this.filePaths.get('photo');
    }

    if (signatureFile) {
      const signatureFileName = `signature_${
        mainPayload.registration_no
      }_${Date.now()}${signatureFile.name.endsWith('.png') ? '.png' : '.jpg'}`;
      formData.append('signature', signatureFile, signatureFileName);
      mainPayload.candidate_signature = `recruitment/${mainPayload.registration_no}/${signatureFileName}`;
    } else if (this.filePaths.get('signature')) {
      mainPayload.candidate_signature = this.filePaths.get('signature');
    }

    this.HTTP.postForm(
      '/candidate/postFile/updateCandidateDetail',
      formData,
      'recruitement'
    ).subscribe({
      next: (res) => {
        if (res.body?.data?.photo_path) {
          this.filePaths.set('photo', res.body.data.photo_path);
        }
        if (res.body?.data?.signature_path) {
          this.filePaths.set('signature', res.body.data.signature_path);
        }
        this.alert.alert(false, 'Form submitted and saved successfully.', 5000);
        this.emitFormData();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.alert.alert(
          true,
          'Failed to save form. Please try again.',
          5000
        );
        this.cdr.markForCheck();
      },
    });
  }
  // Helper Methods (unchanged from original unless noted)
  formatDateToYYYYMMDD(dateInput: string | Date): string {
    const date = new Date(dateInput);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  copyPermanentToCurrentAddress(): void {
    this.form.patchValue({
      Current_Address1: this.form.get('Permanent_Address1')?.value,
      Current_City: this.form.get('Permanent_City')?.value,
      Current_District_Id: this.form.get('Permanent_District_Id')?.value,
      Current_State_Id: this.form.get('Permanent_State_Id')?.value,
      Current_Country_Id: this.form.get('Permanent_Country_Id')?.value,
      Current_Pin_Code: this.form.get('Permanent_Pin_Code')?.value,
    });
  }

  clearCurrentAddress(): void {
    this.form.patchValue({
      Current_Address1: '',
      Current_City: '',
      Current_District_Id: '',
      Current_State_Id: '',
      Current_Country_Id: '',
      Current_Pin_Code: '',
    });
  }

  disableCurrentAddressFields(): void {
    this.form.get('Current_Address1')?.disable();
    this.form.get('Current_City')?.disable();
    this.form.get('Current_District_Id')?.disable();
    this.form.get('Current_State_Id')?.disable();
    this.form.get('Current_Country_Id')?.disable();
    this.form.get('Current_Pin_Code')?.disable();
  }

  enableCurrentAddressFields(): void {
    this.form.get('Current_Address1')?.enable();
    this.form.get('Current_City')?.enable();
    this.form.get('Current_District_Id')?.enable();
    this.form.get('Current_State_Id')?.enable();
    this.form.get('Current_Country_Id')?.enable();
    this.form.get('Current_Pin_Code')?.enable();
  }

  getSalutation(): void {
    this.HTTP.getParam(
      '/master/get/getSalutation/',
      {},
      'recruitement'
    ).subscribe((result: any): void => {
      this.salutations = result.body.data;
      this.form.get('Salutation_E')?.valueChanges.subscribe((selectedId) => {
        const selected = this.salutations.find(
          (s) => s.salutation_id == selectedId
        );
        if (selected) {
          this.form.get('Salutation_H')?.setValue(selected.salutation_id);
        }
      });
    });
  }

  markFormGroupTouched(group: FormGroup | FormArray): void {
    Object.values(group.controls).forEach((control) => {
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      } else {
        control.markAsTouched();
        control.updateValueAndValidity();
      }
    });
  }

  emitFormData(): void {
    const formValue = this.form.getRawValue();
    this.formData.emit({
      ...formValue,
      _isValid: this.form.valid,
      Salutation_E_Name:
        this.salutations.find(
          (s) => s.salutation_id === Number(formValue.Salutation_E)
        )?.salutation_name_e || '',
      Salutation_H_Name:
        this.salutations.find(
          (s) => s.salutation_id === Number(formValue.Salutation_H)
        )?.salutation_name_h || '',
      post_name:
        this.postList.find((p) => p.post_code === Number(formValue.post_code))
          ?.post_name || '',
      advertisment_name:
        this.advertisementList.find(
          (a) => a.a_rec_adv_main_id === Number(formValue.a_rec_adv_main_id)
        )?.advertisment_name || '',
      Subject_Name_E:
        this.subjectList.find(
          (s) => s.subject_id === Number(formValue.subject_id)
        )?.Subject_Name_E || '',
      religion_name:
        this.religionList.find(
          (r) => r.religion_code === formValue.religion_code
        )?.religion_name || '',
      Permanent_Country_Name:
        this.countryList.find(
          (c) => c.country_id === Number(formValue.Permanent_Country_Id)
        )?.country_name || '',
      Permanent_State_Name:
        this.stateList.find(
          (s) => s.state_id === Number(formValue.Permanent_State_Id)
        )?.name || '',
      Permanent_District_Name:
        this.districtList.find(
          (d) => d.district_id === Number(formValue.Permanent_District_Id)
        )?.district_name || '',
      Current_Country_Name:
        this.countryList.find(
          (c) => c.country_id === Number(formValue.Current_Country_Id)
        )?.country_name || '',
      Current_State_Name:
        this.stateList.find(
          (s) => s.state_id === Number(formValue.Current_State_Id)
        )?.name || '',
      Current_District_Name:
        this.districtList.find(
          (d) => d.district_id === Number(formValue.Current_District_Id)
        )?.district_name || '',
      Birth_Country_Name:
        this.countryList.find(
          (c) => c.country_id === Number(formValue.Birth_Country_Id)
        )?.country_name || '',
      Birth_State_Name:
        this.stateList.find(
          (s) => s.state_id === Number(formValue.Birth_State_Id)
        )?.name || '',
      Birth_District_Name:
        this.districtList.find(
          (d) => d.district_id === Number(formValue.Birth_District_Id)
        )?.district_name || '',
      languages: formValue.languages.map((lang: any) => ({
        ...lang,
        language_name:
          this.languages.find((l) => l.id === Number(lang.m_rec_language_id))
            ?.language_name || '',
        language_type:
          this.languageTypes.find(
            (t) =>
              t.m_rec_language_type_id === Number(lang.m_rec_language_type_id)
          )?.language_type || '',
        language_skill:
          this.languageSkills.find(
            (s) =>
              s.m_rec_language_skill_id === Number(lang.m_rec_language_skill_id)
          )?.language_skill || '',
      })),
      candidate_photo: this.filePaths.get('photo') || formValue.photo || null,
      candidate_signature:
        this.filePaths.get('signature') || formValue.signature || null,
    });
  }

  createLanguageGroup(): FormGroup {
    return this.fb.group({
      m_rec_language_type_id: ['', Validators.required],
      m_rec_language_id: ['', Validators.required],
      m_rec_language_skill_id: ['', Validators.required],
    });
  }

  get languagesArray(): FormArray {
    return this.form.get('languages') as FormArray;
  }

  addLanguage(): void {
    this.languagesArray.push(this.createLanguageGroup());
  }

  removeLanguage(index: number): void {
    if (this.languagesArray.length > 1) {
      this.languagesArray.removeAt(index);
    }
  }

  setupLiveHindiTranslation(): void {
    const mapping = [
      { eng: 'Applicant_First_Name_E', hin: 'Applicant_First_Name_H' },
      { eng: 'Applicant_Middle_Name_E', hin: 'Applicant_Middle_Name_H' },
      { eng: 'Applicant_Last_Name_E', hin: 'Applicant_Last_Name_H' },
    ];

    mapping.forEach(({ eng, hin }) => {
      const engControl = this.form.get(eng);
      const hinControl = this.form.get(hin);

      if (engControl && hinControl) {
        engControl.valueChanges
          .pipe(
            debounceTime(200),
            distinctUntilChanged(),
            switchMap((value) => {
              const trimmed = (value || '').trim();
              if (trimmed === '') {
                hinControl.setValue('');
                return of(null);
              }
              return this.translateToHindi(trimmed).pipe(
                catchError(() => of(null))
              );
            })
          )
          .subscribe((result) => {
            if (result !== null) {
              hinControl.setValue(result);
            }
          });
      }
    });
  }

  translateToHindi(text: string): Observable<string> {
    return this.HTTP.getParam(
      '/master/get/getTransliterationHindi',
      { text },
      'recruitement'
    ).pipe(
      map((response: any) => {
        const body = response?.body?.data;
        return body?.transliteration || '';
      }),
      catchError((err) => {
        this.alert.alert(
          true,
          'Transliteration API error. Please try again.',
          5000
        );
        return of('');
      })
    );
  }
}