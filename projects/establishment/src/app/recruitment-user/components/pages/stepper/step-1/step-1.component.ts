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
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
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
import { consumerPollProducersForChange } from '@angular/core/primitives/signals';

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
  additionalQuestions: any[] = [];
  additionalFilePaths: Map<string, string> = new Map();
  advertisementDetails: any = null;
  private savedAdditionalInfo: any[] = [];
  // Mapping of form control names to user-friendly display names
  private fieldNameMap: { [key: string]: string } = {
    registration_no: 'Registration Number',
    a_rec_adv_main_id: 'Advertisement',
    post_code: 'Post',
    session_id: 'Session',
    Salutation_E: 'Salutation (English)',
    Salutation_H: 'Salutation (Hindi)',
    Applicant_First_Name_E: 'First Name',
    Applicant_First_Name_H: 'First Name (Hindi)',
    Applicant_Last_Name_E: 'Last Name',
    Applicant_Last_Name_H: 'Last Name (Hindi)',
    Applicant_Father_Name_E: "Father's Name",
    Applicant_Mother_Name_E: "Mother's Name",
    Gender_Id: 'Gender',
    DOB: 'Date of Birth',
    Mobile_No: 'Mobile Number',
    Email_Id: 'Email Address',
    Birth_Place: 'Place of Birth',
    Birth_District_Id: 'Birth District',
    Birth_State_Id: 'Birth State',
    Birth_Country_Id: 'Birth Country',
    Identification_Mark1: 'Identification Mark 1',
    Identification_Mark2: 'Identification Mark 2',
    religion_code: 'Religion',
    Permanent_Address1: 'Permanent Address',
    Permanent_City: 'Permanent City',
    Permanent_District_Id: 'Permanent District',
    Permanent_State_Id: 'Permanent State',
    Permanent_Country_Id: 'Permanent Country',
    Permanent_Pin_Code: 'Permanent Pin Code',
    Current_Address1: 'Current Address',
    Current_City: 'Current City',
    Current_District_Id: 'Current District',
    Current_State_Id: 'Current State',
    Current_Country_Id: 'Current Country',
    Current_Pin_Code: 'Current Pin Code',
    photo: 'Photo',
    signature: 'Signature',
  };

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
      a_rec_adv_main_id: ['115', Validators.required],
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
      photo: [null],
      signature: [null],
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

  get maxMarriageDate(): string {
    return new Date().toISOString().split('T')[0];
  }
  onConditionalFileSelected(
    event: Event,
    controlName: string,
    maxSizeKB: number | null
  ): void {
    const input = event.target as HTMLInputElement;
    const control = this.form.get(controlName);

    if (input.files?.length && control) {
      const file = input.files[0];

      // Validate file size if a max size is specified in the API response
      if (maxSizeKB) {
        const maxSizeInBytes = maxSizeKB * 1024;
        if (file.size > maxSizeInBytes) {
          this.alert.alert(
            true,
            `File size cannot exceed ${maxSizeKB}KB. Your file is ~${Math.round(
              file.size / 1024
            )}KB.`,
            5000
          );
          // Clear the invalid file from the input and form control
          input.value = '';
          control.setValue(null);
          control.markAsTouched();
          return;
        }
      }

      // If validation passes, update the form control with the file object
      control.setValue(file);
    } else if (control) {
      // If no file is selected, clear the control
      control.setValue(null);
    }
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
      60
    );

    console.log(
      '🟢 JSON Education Calculation:',
      JSON.stringify(eduCal.details, null, 2)
    );
    console.log(
      'Score_field_actual_value (Total actual value):',
      eduCal.total_actual_value
    );
    console.log(
      'Score_field_calculated_value (Total Calculated):',
      eduCal.score_field_calculated_value
    );

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
    );
    console.log(
      'Score_field_calculated_value (Total Calculated):',
      result.score_field_calculated_value
    );
  }

  ngOnInit(): void {
    this.loadAdvertisementDetails();
    this.loadAdditionalInfo();
    this.calculateExp();
    this.step1Service.getUserData().subscribe({
      next: (response: any) => {
        // console.log('User Data ', JSON.stringify(response.body, null, 2));
        if (response?.body?.error) {
          this.alert.alert(true, response.body.error, 5000);
          return;
        }
        const data = response?.body?.data?.[0];

        if (data.candidate_photo) {
          this.filePaths.set('photo', data.candidate_photo);
          this.photoPreview = this.getFileUrl(data.candidate_photo);
          this.form.get('photo')?.setValue(data.candidate_photo);
          this.form.get('photo')?.clearValidators();
          this.form.get('photo')?.updateValueAndValidity();
        } else {
          this.form.get('photo')?.setValidators([Validators.required]);
          this.form.get('photo')?.updateValueAndValidity();
        }
        if (data.candidate_signature) {
          this.filePaths.set('signature', data.candidate_signature);
          this.signaturePreview = this.getFileUrl(data.candidate_signature);
          this.form.get('signature')?.setValue(data.candidate_signature);
          this.form.get('signature')?.clearValidators();
          this.form.get('signature')?.updateValueAndValidity();
        } else {
          this.form.get('signature')?.setValidators([Validators.required]);
          this.form.get('signature')?.updateValueAndValidity();
        }
        this.form.patchValue({
          post_code: data.post_code,
          subject_id: data.subject_id,
          registration_no: data.registration_no,
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
            if (response?.body?.error) {
              this.alert.alert(true, response.body.error, 5000);
              return;
            }
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
            this.loadAndPatchAdditionalInfo(data.registration_no);
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
              if (response?.body?.error) {
                this.alert.alert(true, response.body.error, 5000);
                return;
              }
              this.postList = response?.body?.data;
            },
            error: (err) => {
              this.alert.alert(
                true,
                'Failed to load posts. Please try again.',
                5000
              );
            },
          });
        }
      });

    this.form.get('post_code')?.valueChanges.subscribe((postCode) => {
      if (postCode) {
        this.step1Service.getSubjectsByPostCode(postCode).subscribe({
          next: (response: any) => {
            if (response?.body?.error) {
              this.alert.alert(true, response.body.error, 5000);
              return;
            }
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

    this.step1Service.getLanguageSkills().subscribe({
      next: (response) => (this.languageSkills = response?.body?.data),
      error: (err) =>
        this.alert.alert(true, 'Error loading skills. Please try again.', 5000),
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
  private maxMarriageDateValidator(maxDateStr: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      // Don't validate if there's no input or no max date from the API
      if (!control.value || !maxDateStr) {
        return null;
      }

      const selectedDate = new Date(control.value);
      const maxDate = new Date(maxDateStr);

      // To compare dates accurately, ignore the time part
      selectedDate.setHours(0, 0, 0, 0);
      maxDate.setHours(0, 0, 0, 0);

      // 🔄 THE CORE LOGIC IS FLIPPED HERE
      if (selectedDate > maxDate) {
        // Return an error object if the selected date is AFTER the maximum allowed date
        return {
          invalidMarriageDateMax: {
            max: this.formatDateToYYYYMMDD(maxDate),
            actual: this.formatDateToYYYYMMDD(selectedDate),
          },
        };
      }

      // Return null if validation passes
      return null;
    };
  }
  private dobValidator(maxDateStr: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value || !maxDateStr) {
        return null;
      }

      const selectedDate = new Date(control.value);
      const maxDate = new Date(maxDateStr);
      selectedDate.setHours(0, 0, 0, 0);
      maxDate.setHours(0, 0, 0, 0);

      if (selectedDate > maxDate) {
        // Use a unique error key 'invalidDobMax'
        return {
          invalidDobMax: {
            max: this.formatDateToYYYYMMDD(maxDate),
            actual: this.formatDateToYYYYMMDD(selectedDate),
          },
        };
      }
      return null;
    };
  }

  // ... inside Step1Component class

  private loadAdvertisementDetails(): void {
    const advId = this.form.get('a_rec_adv_main_id')?.value;
    if (!advId) return;

    this.step1Service.getAdvertisementDetails(advId).subscribe({
      next: (res) => {
        if (res?.body?.data?.length > 0) {
          this.advertisementDetails = res.body.data[0];
          console.log(
            '✅ Advertisement Details Loaded:',
            this.advertisementDetails
          );

          // ✅ 2. APPLY VALIDATOR TO THE DOB CONTROL
          const dobControl = this.form.get('DOB');
          if (dobControl && this.advertisementDetails.age_calculation_date) {
            dobControl.setValidators([
              Validators.required,
              this.dobValidator(this.advertisementDetails.age_calculation_date),
            ]);
            // Re-check the control's validity immediately
            dobControl.updateValueAndValidity();
          }

          // This line is for the marriage date, it should remain
          this.form.get('condition_1')?.updateValueAndValidity();
        }
      },
      error: (err) => {
        this.alert.alert(true, 'Failed to load advertisement config.', 5000);
      },
    });
  }

  // ... rest of the component
  private loadAndPatchAdditionalInfo(registrationNo: number): void {
    this.step1Service.getSavedAdditionalInfo(registrationNo).subscribe({
      next: (res) => {
        const savedInfo = res?.body?.data;
        console.log(
          'Saved additional information: ',
          JSON.stringify(savedInfo,null,2)
        );
        if (!savedInfo || !Array.isArray(savedInfo)) return;

        // Store the complete data, including IDs, for later use during submission.
        this.savedAdditionalInfo = savedInfo;

        savedInfo.forEach((item: any) => {
          if (item.condition_id === null) {
            const controlName = `question_${item.question_id}`;
            const control = this.form.get(controlName);
            // Patch value and trigger change detection for conditional logic
            if (control) {
              control.setValue(item.input_field);
            }
          } else {
            const controlName = `condition_${item.condition_id}`;
            const control = this.form.get(controlName);
            if (control) {
              if (
                item.input_field &&
                typeof item.input_field === 'string' &&
                item.input_field.startsWith('recruitment/')
              ) {
                this.additionalFilePaths.set(controlName, item.input_field);
              } else {
                control.setValue(item.input_field);
              }
            }
          }
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.alert.alert(true, 'Failed to load saved additional info.', 3000);
      },
    });
  }

  private conditionalFileValidator(controlName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const hasNewFile = control.value instanceof File;
      const hasExistingFile = this.additionalFilePaths.has(controlName);

      const isValid = hasNewFile || hasExistingFile;
      return isValid ? null : { required: true };
    };
  }
  // ✅ ADD THESE HELPER METHODS FOR THE TEMPLATE
  getAdditionalFilePath(controlName: string): string | null {
    return this.additionalFilePaths.get(controlName) || null;
  }

  private loadAdditionalInfo(): void {
    this.step1Service.getAdditionalInfoQuestions().subscribe({
      next: (res) => {
        if (res?.body?.data?.questions) {
          this.additionalQuestions = res.body.data.questions;
          this.buildAdditionalInfoFormControls(this.additionalQuestions);
          this.setupConditionalValidators(this.additionalQuestions);
        }
      },
      error: (err) => {
        this.alert.alert(true, 'Failed to load additional questions.', 5000);
      },
    });
  }
  private buildAdditionalInfoFormControls(questions: any[]): void {
    questions.forEach((question) => {
      // Add control for the main question
      this.form.addControl(
        `question_${question.question_id}`,
        this.fb.control('', [Validators.required])
      );

      // Add controls for any potential conditional/dependent fields
      question.options.forEach((option: any) => {
        if (option.has_condition === 'Y') {
          option.conditions.forEach((condition: any) => {
            // Add control for the dependent field, initially without validators
            this.form.addControl(
              `condition_${condition.condition_id}`,
              this.fb.control('')
            );
          });
        }
      });
    });
  }
  onDobChange(event: Event): void {
    const control = this.form.get('DOB');
    if (control?.hasError('invalidDobMax')) {
      const error = control.errors?.['invalidDobMax'];
      this.alert.alertMessage(
        'Invalid Date of Birth',
        `The Date of Birth cannot be after <b>${error.max}</b>.<br>Please select a valid date.`,
        'error'
      );
    }
  }
  onMarriageDateChange(event: Event): void {
    const control = this.form.get('condition_1'); // Control for Marriage Date
    if (control?.hasError('invalidMarriageDateMax')) {
      const error = control.errors?.['invalidMarriageDateMax'];
      const maxDate = error.max;

      // ✅ USE this.alert.alertMessage to show an alert with an "OK" button
      this.alert.alertMessage(
        'Invalid Date Selected', // This is the title of the alert
        `The marriage date cannot be after <b>${maxDate}</b>.<br>Please choose a valid date.`, // This is the HTML message
        'error' // This sets the icon to an error symbol
      );
    }
  }
  // 👇 ADD THIS NEW METHOD TO HANDLE DYNAMIC VALIDATORS
  private setupConditionalValidators(questions: any[]): void {
    questions.forEach((question) => {
      const questionControl = this.form.get(`question_${question.question_id}`);
      if (!questionControl) return;

      questionControl.valueChanges.subscribe((selectedValue) => {
        question.options.forEach((option: any) => {
          const isSelected = option.option_value === selectedValue;
          if (option.has_condition === 'Y') {
            option.conditions.forEach((condition: any) => {
              const controlName = `condition_${condition.condition_id}`;
              const conditionControl = this.form.get(controlName);

              if (conditionControl) {
                if (isSelected && condition.condition_required === 'Y') {
                  // ✅ 5. MODIFICATION STARTS HERE
                  const validators: ValidatorFn[] = [];

                  if (condition.condition_data_type === 'file') {
                    validators.push(this.conditionalFileValidator(controlName));
                  } else {
                    validators.push(Validators.required);
                  }

                  // Specifically for the Marriage Date (condition_id: 1)
                  if (
                    condition.condition_id === 1 &&
                    this.advertisementDetails?.marriage_calculation_date
                  ) {
                    validators.push(
                      this.maxMarriageDateValidator(
                        this.advertisementDetails.marriage_calculation_date
                      )
                    );
                  }

                  conditionControl.setValidators(validators);
                  // ✅ MODIFICATION ENDS HERE
                } else {
                  conditionControl.clearValidators();
                  conditionControl.reset('', { emitEvent: false });
                }
                conditionControl.updateValueAndValidity({ emitEvent: false });
              }
            });
          }
        });
        this.cdr.markForCheck();
      });
    });
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['triggerValidation'] && this.triggerValidation) {
      this.markFormGroupTouched(this.form);
    }
  }
  public handleRadioChange(controlName: string, value: any): void {
    // Get the specific form control
    const control = this.form.get(controlName);

    if (control) {
      // Manually set the value for the control
      control.setValue(value);

      // Mark the control as 'touched' for correct validation behavior
      control.markAsTouched();

      // Force Angular to immediately update the view to reflect the changes
      this.cdr.detectChanges();
    }
  }
  public getSelectedOption(question: any): any | null {
    // Find the form control associated with the question
    const control = this.form.get(`question_${question.question_id}`);

    // If the control or its value doesn't exist, return null
    if (!control || !control.value) {
      return null;
    }

    // Find and return the specific option that matches the control's current value
    return question.options.find(
      (opt: any) => opt.option_value === control.value
    );
  }
  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      this.form.get('photo')?.setValue(file);
      this.form.get('photo')?.setValidators([Validators.required]);
      this.form.get('photo')?.updateValueAndValidity();
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
      this.form.get('signature')?.setValidators([Validators.required]);
      this.form.get('signature')?.updateValueAndValidity();
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
    this.form.get('photo')?.setValidators([Validators.required]);
    this.form.get('photo')?.updateValueAndValidity();
    this.photoPreview = null;
    this.filePaths.delete('photo');
    const input = document.getElementById('photoInput') as HTMLInputElement;
    if (input) input.value = '';
    this.cdr.markForCheck();
  }

  clearSignature(): void {
    this.form.get('signature')?.reset();
    this.form.get('signature')?.setValidators([Validators.required]);
    this.form.get('signature')?.updateValueAndValidity();
    this.signaturePreview = null;
    this.filePaths.delete('signature');
    const input = document.getElementById('signatureInput') as HTMLInputElement;
    if (input) input.value = '';
    this.cdr.markForCheck();
  }

  private handleApiResponse(response: any): any {
    if (response?.body?.error) {
      throw new Error(response.body.error);
    }
    return response?.body?.data;
  }

  logValidationErrors(group: FormGroup | FormArray): string[] {
    const errors: string[] = [];
    Object.keys(group.controls).forEach((key: string) => {
      const control = group.get(key);
      if (control instanceof FormGroup || control instanceof FormArray) {
        errors.push(...this.logValidationErrors(control));
      } else if (control?.invalid && control?.touched) {
        // ✅ IMPROVED LOGIC STARTS HERE
        let displayName = this.fieldNameMap[key] || key;

        // Find user-friendly names for additional questions
        if (key.startsWith('question_')) {
          const questionId = Number(key.split('_')[1]);
          const question = this.additionalQuestions.find(
            (q) => q.question_id === questionId
          );
          if (question) displayName = question.question_label;
        } else if (key.startsWith('condition_')) {
          const conditionId = Number(key.split('_')[1]);
          for (const q of this.additionalQuestions) {
            for (const o of q.options) {
              const condition = o.conditions?.find(
                (c: any) => c.condition_id === conditionId
              );
              if (condition) {
                displayName = `${condition.dependent_field_label} (for ${q.question_label})`;
                break;
              }
            }
            if (displayName !== key) break;
          }
        }

        if (control.errors?.['required']) {
          errors.push(`${displayName} is required.`);
        } else if (control.errors?.['email']) {
          errors.push(`${displayName} must be a valid email address.`);
        } else if (control.errors?.['underage']) {
          errors.push(`You must be at least 18 years old for ${displayName}.`);
        }
      }
    });
    return errors;
  }
  // Add this new method inside your Step1Component class
  async saveAdditionalInformation(): Promise<void> {
    const formData = new FormData();
    const registrationNo = this.form.get('registration_no')?.value;
    formData.append('registration_no', registrationNo);

    const additionalInfoPayload: any[] = [];

    // STEP 1: Loop through questions and build the payload array
    for (const question of this.additionalQuestions) {
      const questionControlName = `question_${question.question_id}`;
      const selectedOptionValue = this.form.get(questionControlName)?.value;

      if (selectedOptionValue) {
        const selectedOption = question.options.find(
          (opt: any) => opt.option_value === selectedOptionValue
        );

        if (selectedOption) {
          // Add the main answer (the radio button selection itself)
          additionalInfoPayload.push({
            question_id: question.question_id,
            option_id: selectedOption.option_id,
            condition_id: null,
            input_field: null,
          });

          // If the selected option has a condition, add its answer
          if (selectedOption.has_condition === 'Y') {
            for (const condition of selectedOption.conditions) {
              const conditionControlName = `condition_${condition.condition_id}`;
              const conditionControl = this.form.get(conditionControlName);
              const conditionValue = conditionControl?.value;

              let inputFieldValue = null;

              if (conditionValue instanceof File) {
                // If it's a file, append it to FormData for upload
                const fileControlName = `additional_${question.question_id}_${selectedOption.option_id}_${condition.condition_id}`;
                formData.append(
                  fileControlName,
                  conditionValue,
                  conditionValue.name
                );
              } else {
                // If it's a regular value (date, text), assign it
                inputFieldValue = conditionValue;
              }

              additionalInfoPayload.push({
                question_id: question.question_id,
                option_id: selectedOption.option_id,
                condition_id: condition.condition_id,
                input_field: inputFieldValue,
              });
            }
          }
        }
      }
    }

    // STEP 2: Log the payload and check if it's empty *after* the loop
    console.log(
      '🔼 Frontend payload being sent:',
      JSON.stringify(additionalInfoPayload, null, 2)
    );

    // If there's nothing to save, we can just resolve successfully.
    if (additionalInfoPayload.length === 0) {
      console.warn('No additional info data to save.');
      return Promise.resolve();
    }

    // STEP 3: Append the final JSON string and make the API call
    formData.append('additionalInfo', JSON.stringify(additionalInfoPayload));

    return new Promise((resolve, reject) => {
      this.step1Service.saveAdditionalInfo(formData).subscribe({
        next: (res) => {
          if (res?.body?.error) {
            this.alert.alert(true, res.body.error, 5000);
            reject(new Error(res.body.error));
          } else {
            console.log('✅ Additional info saved successfully.');
            resolve();
          }
        },
        error: (err) => {
          this.alert.alert(true, 'Failed to save additional info.', 5000);
          reject(err);
        },
      });
    });
  }

  async submitForm(): Promise<void> {
    this.emitFormData();
    this.markFormGroupTouched(this.form);

    if (this.form.invalid) {
      const validationErrors = this.logValidationErrors(this.form);
      const firstErrorMessage =
        validationErrors[0] || 'Please fill all mandatory fields.';
      this.alert.alert(true, firstErrorMessage, 5000);
      return Promise.reject(new Error('Form is invalid'));
    }

    const formData = new FormData();
    const formValue = this.form.getRawValue();

    const mainPayloadForJson = { ...formValue };
    delete mainPayloadForJson.photo;
    delete mainPayloadForJson.signature;

    // --- 1. Handle Photo and Signature ---
    const photoControlValue = formValue.photo;
    const signatureControlValue = formValue.signature;

    if (photoControlValue instanceof File) {
      formData.append('photo', photoControlValue, photoControlValue.name);
    } else {
      mainPayloadForJson.candidate_photo = photoControlValue;
    }

    if (signatureControlValue instanceof File) {
      formData.append(
        'signature',
        signatureControlValue,
        signatureControlValue.name
      );
    } else {
      mainPayloadForJson.candidate_signature = signatureControlValue;
    }

    // --- 2. Append Main Payload and Languages ---
    const languagePayload = this.languagesArray.controls.map((ctrl) => ({
      ...ctrl.value,
      registration_no: mainPayloadForJson.registration_no,
      a_rec_adv_main_id: mainPayloadForJson.a_rec_adv_main_id,
    }));

    formData.append('mainPayload', JSON.stringify(mainPayloadForJson));
    formData.append('languages', JSON.stringify(languagePayload));

    // --- 3. Prepare and Append Additional Information ---
    const additionalInfoPayload: any[] = [];
    for (const question of this.additionalQuestions) {
      const questionControlName = `question_${question.question_id}`;
      const selectedOptionValue = this.form.get(questionControlName)?.value;

      if (selectedOptionValue) {
        const selectedOption = question.options.find(
          (opt: any) => opt.option_value === selectedOptionValue
        );
        if (selectedOption) {
          // Find the original saved record for the main question's answer
          const existingMainRecord = this.savedAdditionalInfo.find(
            (info) =>
              info.question_id === question.question_id &&
              info.option_id === selectedOption.option_id &&
              info.condition_id === null
          );

          additionalInfoPayload.push({
            // ✅ FIX: Add the ID if it exists, otherwise send null
            a_rec_app_main_addtional_info_id:
              existingMainRecord?.a_rec_app_main_addtional_info_id || null,
            question_id: question.question_id,
            option_id: selectedOption.option_id,
            condition_id: null,
            input_field: null, // Backend will populate this
          });

          if (selectedOption.has_condition === 'Y') {
            for (const condition of selectedOption.conditions) {
              const conditionControlName = `condition_${condition.condition_id}`;
              const conditionValue = this.form.get(conditionControlName)?.value;
              let inputFieldValue = null;

              // Find the original saved record for the condition's answer
              const existingConditionRecord = this.savedAdditionalInfo.find(
                (info) =>
                  info.question_id === question.question_id &&
                  info.option_id === selectedOption.option_id &&
                  info.condition_id === condition.condition_id
              );

              // Handle file vs. regular input values
              if (condition.condition_data_type === 'file') {
                if (conditionValue instanceof File) {
                  const fileControlName = `additional_${question.question_id}_${selectedOption.option_id}_${condition.condition_id}`;
                  formData.append(
                    fileControlName,
                    conditionValue,
                    conditionValue.name
                  );
                } else {
                  inputFieldValue =
                    this.additionalFilePaths.get(conditionControlName) || null;
                }
              } else {
                inputFieldValue = conditionValue;
              }

              additionalInfoPayload.push({
                // ✅ FIX: Add the ID here as well
                a_rec_app_main_addtional_info_id:
                  existingConditionRecord?.a_rec_app_main_addtional_info_id ||
                  null,
                question_id: question.question_id,
                option_id: selectedOption.option_id,
                condition_id: condition.condition_id,
                input_field: inputFieldValue,
              });
            }
          }
        }
      }
    }

    if (additionalInfoPayload.length > 0) {
      formData.append('additionalInfo', JSON.stringify(additionalInfoPayload));
      formData.append(
        'additionalInfoQuestions',
        JSON.stringify(this.additionalQuestions)
      );
    }

    // --- 4. Make the SINGLE API call ---
    return new Promise((resolve, reject) => {
      this.HTTP.postForm(
        '/candidate/postFile/saveOrUpdateFullCandidateProfile',
        formData,
        'recruitement'
      ).subscribe({
        next: (res) => {
          if (res?.body?.error) {
            this.alert.alert(
              true,
              res.body.error.message || 'An error occurred.',
              5000
            );
            reject(new Error(res.body.error.message));
            return;
          }

          this.alert.alert(
            false,
            'All candidate details saved successfully!',
            5000
          );

          if (res.body?.data?.photo_path) {
            this.photoPreview = this.getFileUrl(res.body.data.photo_path);
            this.form
              .get('photo')
              ?.setValue(res.body.data.photo_path, { emitEvent: false });
          }
          if (res.body?.data?.signature_path) {
            this.signaturePreview = this.getFileUrl(
              res.body.data.signature_path
            );
            this.form
              .get('signature')
              ?.setValue(res.body.data.signature_path, { emitEvent: false });
          }

          this.emitFormData();
          this.cdr.markForCheck();
          resolve();
        },
        error: (err) => {
          const errorDetails = err.error?.details;
          const errorMessage =
            errorDetails?.message ||
            err.error?.message ||
            'Failed to save details. Please try again.';
          this.alert.alert(true, errorMessage, 5000);
          reject(err);
        },
      });
    });
  }
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

  const emitData: { [key: string]: any } = {
    ...formValue,
    _isValid: this.form.valid,
    Salutation_E_Name: this.salutations.find(s => s.salutation_id === Number(formValue.Salutation_E))?.salutation_name_e || '',
    Salutation_H_Name: this.salutations.find(s => s.salutation_id === Number(formValue.Salutation_H))?.salutation_name_h || '',
    post_name: this.postList.find(p => p.post_code === Number(formValue.post_code))?.post_name || '',
    advertisment_name: this.advertisementList.find(a => a.a_rec_adv_main_id === Number(formValue.a_rec_adv_main_id))?.advertisment_name || '',
    Subject_Name_E: this.subjectList.find(s => s.subject_id === Number(formValue.subject_id))?.Subject_Name_E || '',
    religion_name: this.religionList.find(r => r.religion_code === formValue.religion_code)?.religion_name || '',
    Permanent_Country_Name: this.countryList.find(c => c.country_id === Number(formValue.Permanent_Country_Id))?.country_name || '',
    Permanent_State_Name: this.stateList.find(s => s.state_id === Number(formValue.Permanent_State_Id))?.name || '',
    Permanent_District_Name: this.districtList.find(d => d.district_id === Number(formValue.Permanent_District_Id))?.district_name || '',
    Current_Country_Name: this.countryList.find(c => c.country_id === Number(formValue.Current_Country_Id))?.country_name || '',
    Current_State_Name: this.stateList.find(s => s.state_id === Number(formValue.Current_State_Id))?.name || '',
    Current_District_Name: this.districtList.find(d => d.district_id === Number(formValue.Current_District_Id))?.district_name || '',
    Birth_Country_Name: this.countryList.find(c => c.country_id === Number(formValue.Birth_Country_Id))?.country_name || '',
    Birth_State_Name: this.stateList.find(s => s.state_id === Number(formValue.Birth_State_Id))?.name || '',
    Birth_District_Name: this.districtList.find(d => d.district_id === Number(formValue.Birth_District_Id))?.district_name || '',
    languages: formValue.languages.map((lang: any) => ({
      ...lang,
      language_name: this.languages.find(l => l.id === Number(lang.m_rec_language_id))?.language_name || '',
      language_type: this.languageTypes.find(t => t.m_rec_language_type_id === Number(lang.m_rec_language_type_id))?.language_type || '',
      language_skill: this.languageSkills.find(s => s.m_rec_language_skill_id === Number(lang.m_rec_language_skill_id))?.language_skill || '',
    })),
    candidate_photo: this.filePaths.get('photo') || formValue.photo || null,
    candidate_signature: this.filePaths.get('signature') || formValue.signature || null,
  };

  const additionalInfoDetails: { question: string; answer: any }[] = [];
  if (this.additionalQuestions && this.additionalQuestions.length > 0) {
    
    this.additionalQuestions.forEach(question => {
      const questionControlName = `question_${question.question_id}`;
      const selectedOptionValue = formValue[questionControlName];

      if (selectedOptionValue) {
        const selectedOption = question.options.find(
          (opt: any) => opt.option_value === selectedOptionValue
        );

        if (selectedOption) {
          additionalInfoDetails.push({
            question: question.question_label,
            answer: selectedOption.option_label,
          });

          if (selectedOption.has_condition === 'Y') {
            selectedOption.conditions.forEach((condition: any) => {
              const conditionControlName = `condition_${condition.condition_id}`;
              const conditionValue = formValue[conditionControlName];
              const existingFilePath = this.additionalFilePaths.get(conditionControlName);

              // ✅ FIX 1: Check for an existing file path in addition to a new file value.
              if (conditionValue || existingFilePath) {
                let answerValue = conditionValue; 
                
                // ✅ FIX 2: If the condition is a file, set the answer text to "File Uploaded".
                if (condition.condition_data_type === 'file') {
                   answerValue = 'File Uploaded';
                }
                
                additionalInfoDetails.push({
                  question: condition.dependent_field_label,
                  answer: answerValue,
                });
              }
            });
          }
        }
      }
    });
  }
  
  emitData['additionalInfoDetails'] = additionalInfoDetails;

  this.formData.emit(emitData);
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
