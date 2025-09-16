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
import { HttpClientModule } from '@angular/common/http';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  catchError,
  map,
  Observable,
  forkJoin,
} from 'rxjs';
import { HttpService, SharedModule } from 'shared';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { UtilsService } from './utils.service';
import { AlertService } from 'shared';
import { LoaderService } from 'shared';

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
  postList: {
    post_code: number;
    post_name: string;
    post_status_name: string;
  }[] = [];
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
  categoryQuestion: any = null; // To hold the 'Applied Category' question object
  filteredCategoryOptions: any[] = []; // To hold the dynamically filtered options
  disabilityTypes: {
    Recruitment_Disability_Type_Id: number;
    Disability_Type: string;
  }[] = []; // <-- ADD THIS LINE
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
    private HTTP: HttpService, // Use HttpService directly
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private alert: AlertService,
    private loader: LoaderService
  ) {
    this.form = this.fb.group({
      registration_no: ['24000001'],
      a_rec_adv_main_id: ['115', Validators.required],
      post_name: [''],
      post_code: ['', Validators.required],
      session_id: ['2', Validators.required],
      subject_id: [''],
      Salutation_E: ['', Validators.required],
      Salutation_H: ['', Validators.required],
      Applicant_First_Name_E: ['', Validators.required],
      Applicant_Middle_Name_E: [''],
      Applicant_Last_Name_E: [''],
      Applicant_First_Name_H: ['', Validators.required],
      Applicant_Middle_Name_H: [''],
      Applicant_Last_Name_H: [''],
      Applicant_Father_Name_E: ['', Validators.required],
      Applicant_Mother_Name_E: ['', Validators.required],
      Gender_Id: ['', Validators.required],
      DOB: ['', Validators.required],
      age: [{ value: '', disabled: true }],
      Mobile_No: [
        '',
        [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)],
      ],
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
      Permanent_Pin_Code: [
        '',
        [Validators.required, Validators.pattern(/^\d{6}$/)],
      ],
      Current_Address1: ['', Validators.required],
      Current_City: ['', Validators.required],
      Current_District_Id: ['', Validators.required],
      Current_State_Id: ['', Validators.required],
      Current_Country_Id: ['', Validators.required],
      Current_Pin_Code: [
        '',
        [Validators.required, Validators.pattern(/^\d{6}$/)],
      ],
      presentSame: [false],
      languages: this.fb.array([this.createLanguageGroup()]),
      photo: [null],
      signature: [null],
    });
    this.emitFormData();
  }

  ngOnInit(): void {
    this.initializeFormListeners();
    this.initializeFormWithData();
  }

  private initializeFormWithData(): void {
    this.loader.show();

    // 1. Define all API calls to be run in parallel
    const dataSources$ = [
      this.HTTP.getParam('/master/get/getSalutation/', {}, 'recruitement'),
      this.getReligions(),
      this.getCountries(),
      this.getStates(),
      this.getLanguageTypes(),
      this.getLanguages(),
      this.getLanguageSkills(),
      this.getAdditionalInfoQuestions(),
      this.getUserData(),
      this.getSavedLanguages(),
    ];

    // 2. Execute all API calls
    forkJoin(dataSources$).subscribe({
      next: ([
        salutationsRes,
        religionsRes,
        countriesRes,
        statesRes,
        langTypesRes,
        languagesRes,
        langSkillsRes,
        additionalQuestionsRes,
        userDataRes,
        savedLanguagesRes,
      ]) => {
        // 3. Assign all master data lists from the API responses
        this.salutations = salutationsRes?.body?.data || [];
        this.religionList = religionsRes?.body?.data || [];
        this.countryList = countriesRes?.body?.data || [];
        this.stateList = statesRes?.body?.data || [];
        this.languageTypes = langTypesRes?.body?.data || [];
        this.languages = languagesRes?.body?.data || [];
        this.languageSkills = langSkillsRes?.body?.data || [];

        // 4. Clean the flawed JSON from the 'additionalQuestions' response
        let questions = additionalQuestionsRes?.body?.data?.questions || [];
        questions.forEach((question: any) => {
          question.options.forEach((option: any) => {
            if (option.conditions && option.conditions.length > 0) {
              // Filter conditions to only include those that match the parent option
              option.conditions = option.conditions.filter(
                (condition: any) => condition.option_id === option.option_id
              );
            }
          });
        });
        this.additionalQuestions = questions;
        this.categoryQuestion = this.additionalQuestions.find(
          (q) => q.question_id === 2
        );

        // 5. Build the dynamic form controls based on the cleaned questions
        if (this.additionalQuestions.length > 0) {
          this.buildAdditionalInfoFormControls(this.additionalQuestions);
          this.setupConditionalValidators(this.additionalQuestions);
        }

        // 6. Process the main user data
        const userData = userDataRes?.body?.data?.[0];
        if (userData) {
          // Populate lists that depend on user data
          this.postList = [
            {
              post_code: userData.post_code,
              post_name: userData.post_name,
              post_status_name: userData.post_status_name,
            },
          ];
          this.advertisementList = [
            {
              a_rec_adv_main_id: userData.a_rec_adv_main_id,
              advertisment_name: userData.advertisment_name,
            },
          ];

          // Patch the main form and languages array
          this.patchUserData(userData);
          const savedLanguages = savedLanguagesRes?.body?.data || [];
          if (savedLanguages.length > 0) {
            this.patchUserLanguages(savedLanguages);
          }

          // 7. CRITICAL STEP: Chain the final setup steps
          // This ensures saved values are loaded BEFORE the custom listeners are attached.
          this.loadAndPatchAdditionalInfo(userData.registration_no).subscribe(
            () => {
              this.setupCustomLogicListeners(); // Now set up the Bonafide -> Category logic
              this.loadAdvertisementDetails();
              this.loader.hide(); // Hide loader only after everything is complete
            }
          );
        } else {
          // If there's no user data, we can hide the loader now
          this.loader.hide();
        }
      },
      error: (err: any) => {
        console.error('Error during initial data load:', err);
        this.alert.alert(
          true,
          'Failed to load essential application data. Please refresh the page.'
        );
        this.loader.hide(); // ALWAYS hide loader on error
      },
    });
  }

  /**
   * Sets up all reactive form `valueChanges` subscriptions to handle dynamic UI and data fetching.
   */
  private getDropdownDataByQuery(queryId: number): Observable<any> {
    return this.HTTP.getParam(
      '/master/get/getDataByQueryId',
      { query_id: queryId },
      'recruitement'
    );
  }
  private setupCustomLogicListeners(): void {
    const residentControl = this.form.get('question_3');
    const categoryControl = this.form.get('question_2');

    // Exit if controls aren't available (defensive check)
    if (!residentControl || !categoryControl || !this.categoryQuestion) {
      console.error('Required controls for custom logic were not found.');
      return;
    }

    // This is the core logic that filters the options
    const updateCategoryOptions = (isResident: string | null) => {
      console.log(`Resident status changed to: ${isResident}`); // For debugging

      if (isResident === 'N') {
        // NOT a resident
        this.filteredCategoryOptions = this.categoryQuestion.options.filter(
          (opt: any) => opt.option_value === 'UR'
        );
        // If the current selection is not 'UR', change it to 'UR'
        if (categoryControl.value !== 'UR') {
          categoryControl.setValue('UR');
        }
      } else {
        // IS a resident (or value is null/undefined initially)
        // Show all available options
        this.filteredCategoryOptions = this.categoryQuestion.options;
      }
      // Tell Angular to update the view
      this.cdr.markForCheck();
    };

    // 1. Subscribe to any future changes the user makes
    residentControl.valueChanges.subscribe(updateCategoryOptions);

    // 2. Call the logic immediately to set the correct initial state
    updateCategoryOptions(residentControl.value);
  }
  private initializeFormListeners(): void {
    this.setupLiveHindiTranslation();

    this.form.get('DOB')?.valueChanges.subscribe((dobValue) => {
      if (dobValue) this.calculateAge(dobValue);
    });

    this.form
      .get('a_rec_adv_main_id')
      ?.valueChanges.subscribe((advertisementId) => {
        if (advertisementId) this.fetchPostsByAdvertisement(advertisementId);
      });

    this.form.get('post_code')?.valueChanges.subscribe((postCode) => {
      if (postCode) this.fetchSubjectsByPost(postCode);
    });

    this.form.get('Permanent_State_Id')?.valueChanges.subscribe((stateId) => {
      this.fetchDistrictsByState(stateId);
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

  // --- API Data Access Methods (Moved from Service) ---

  private getUserData(): Observable<any> {
    const registrationNo = 24000001; // 🔒 Hardcoded for now
    return this.HTTP.getParam(
      '/master/get/getApplicant',
      { registration_no: registrationNo },
      'recruitement'
    );
  }

  private getSubjectsByPostCode(postCode: number): Observable<any> {
    return this.HTTP.getParam(
      '/master/get/getSubjectsByPost',
      { post_code: postCode },
      'recruitement'
    );
  }

  private getReligions(): Observable<any> {
    return this.HTTP.getParam(
      '/master/get/getReligionCode',
      {},
      'recruitement'
    );
  }

  private getCountries(): Observable<any> {
    return this.HTTP.getParam('/master/get/getCountryList', {}, 'recruitement');
  }

  private getStates(): Observable<any> {
    return this.HTTP.getParam('/master/get/getStateList', {}, 'recruitement');
  }

  private getPostByAdvertisement(advertisementId: number): Observable<any> {
    return this.HTTP.getParam(
      '/master/get/getPostByAdvertiment',
      { a_rec_adv_main_id: advertisementId },
      'recruitement'
    );
  }

  private getDistrictsByState(stateId: number): Observable<any> {
    return this.HTTP.getParam(
      '/master/get/getDistrictsByState',
      { state_id: stateId },
      'recruitement'
    );
  }

  private getLanguageTypes(): Observable<any> {
    return this.HTTP.getParam(
      '/master/get/getLanguageType',
      {},
      'recruitement'
    );
  }

  private getLanguages(): Observable<any> {
    return this.HTTP.getParam('/master/get/getLanguages', {}, 'recruitement');
  }

  private getLanguageSkills(): Observable<any> {
    return this.HTTP.getParam(
      '/master/get/getLanguagesSkill',
      {},
      'recruitement'
    );
  }

  private getAdditionalInfoQuestions(): Observable<any> {
    return this.HTTP.getParam(
      '/master/get/getAddtionalInforList',
      {},
      'recruitement'
    );
  }

  private getSavedLanguages(): Observable<any> {
    const registrationNo = 24000001;
    return this.HTTP.getParam(
      '/master/get/getLanguagesByRegistration',
      { registration_no: registrationNo },
      'recruitement'
    );
  }

  private getSavedAdditionalInfo(registrationNo: number): Observable<any> {
    return this.HTTP.getParam(
      '/candidate/get/getAddtionInfoDetails',
      { question_label: registrationNo },
      'recruitement'
    );
  }

  private getAdvertisementDetails(adv_main_id: number): Observable<any> {
    return this.HTTP.getParam(
      '/master/get/getLatestAdvertisement',
      { adv_main_id },
      'recruitement'
    );
  }

  private saveAdditionalInfo(formData: FormData): Observable<any> {
    return this.HTTP.postForm(
      '/candidate/postFile/saveOrUpdateAdditionalInformation',
      formData,
      'recruitement'
    );
  }

  // --- Form & UI Event Handlers ---

  private patchUserData(data: any): void {
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
    this.form.patchValue({ presentSame: sameAddress });
    if (sameAddress) {
      this.copyPermanentToCurrentAddress();
      this.disableCurrentAddressFields();
    }
  }

  private patchUserLanguages(langData: any[]): void {
    const langFormArray = this.form.get('languages') as FormArray;
    langFormArray.clear();
    if (langData.length === 0) {
      langFormArray.push(this.createLanguageGroup()); // Add one empty row if none saved
      return;
    }
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
          m_rec_language_id: [lang.m_rec_language_id, Validators.required],
          m_rec_language_skill_id: [
            lang.m_rec_language_skill_id,
            Validators.required,
          ],
        })
      );
    });
  }

  private fetchPostsByAdvertisement(advertisementId: number): void {
    this.getPostByAdvertisement(advertisementId).subscribe({
      next: (response: any) => {
        if (response?.body?.error) {
          this.alert.alert(true, response.body.error);
          return;
        }
        this.postList = response?.body?.data;
      },
      error: (err) => {
        this.alert.alert(true, 'Failed to load posts. Please try again.');
      },
    });
  }

  private fetchSubjectsByPost(postCode: number): void {
    this.getSubjectsByPostCode(postCode).subscribe({
      next: (response: any) => {
        if (response?.body?.error) {
          this.alert.alert(true, response.body.error);
          return;
        }
        this.subjectList = response?.body?.data;
      },
      error: (err) => {
        this.alert.alert(
          true,
          'Failed to load subjects for this post. Please try again.'
        );
        this.subjectList = [];
        this.form.get('subject_id')?.setValue('');
      },
    });
  }

  private fetchDistrictsByState(stateId: number | null): void {
    if (stateId) {
      this.getDistrictsByState(stateId).subscribe({
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
          this.alert.alert(true, 'Error loading districts. Please try again.');
          this.districtList = [];
          this.form.get('Permanent_District_Id')?.setValue('');
        },
      });
    } else if (!stateId) {
      this.districtList = [];
      this.form.get('Permanent_District_Id')?.setValue('');
    }
  }

  private calculateAge(dobValue: string): void {
    if (!dobValue) {
      this.form.get('age')?.setValue('', { emitEvent: false });
      this.form.get('age')?.setErrors(null);
      return;
    }
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
    const ageString = `${years} year${years !== 1 ? 's' : ''}, ${months} month${
      months !== 1 ? 's' : ''
    }, ${days} day${days !== 1 ? 's' : ''}`;
    this.form.get('age')?.setValue(ageString, { emitEvent: false });
    if (years < 18) {
      this.form.get('age')?.setErrors({ underage: true });
    } else {
      this.form.get('age')?.setErrors(null);
    }
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
            )}KB.`
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

  getLatestAdvertisement() {
    this.HTTP.getParam(
      '/master/get/getAddtionalInforList/',
      {},
      'recruitement'
    ).subscribe((result: any): void => {
      const advertismentNos = result.body.data;
      console.log(
        '🟢 JSON fgh List:',
        JSON.stringify(advertismentNos, null, 2)
      );
    });
  }

  private maxMarriageDateValidator(maxDateStr: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value || !maxDateStr) {
        return null;
      }
      const selectedDate = new Date(control.value);
      const maxDate = new Date(maxDateStr);
      selectedDate.setHours(0, 0, 0, 0);
      maxDate.setHours(0, 0, 0, 0);
      if (selectedDate > maxDate) {
        return {
          invalidMarriageDateMax: {
            max: this.formatDateToYYYYMMDD(maxDate),
            actual: this.formatDateToYYYYMMDD(selectedDate),
          },
        };
      }
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

  private loadAdvertisementDetails(): void {
    const advId = this.form.get('a_rec_adv_main_id')?.value;
    if (!advId) return;
    this.getAdvertisementDetails(advId).subscribe({
      next: (res) => {
        if (res?.body?.data?.length > 0) {
          this.advertisementDetails = res.body.data[0];
          console.log(
            '✅ Advertisement Details Loaded:',
            this.advertisementDetails
          );
          const dobControl = this.form.get('DOB');
          if (dobControl && this.advertisementDetails.age_calculation_date) {
            dobControl.setValidators([
              Validators.required,
              this.dobValidator(this.advertisementDetails.age_calculation_date),
            ]);
            dobControl.updateValueAndValidity();
          }
          this.form.get('condition_1')?.updateValueAndValidity();
        }
      },
      error: (err) => {
        this.alert.alert(true, 'Failed to load advertisement config.');
      },
    });
  }

  private loadAndPatchAdditionalInfo(registrationNo: number): Observable<void> {
    // Return the Observable stream instead of subscribing inside the function
    return this.getSavedAdditionalInfo(registrationNo).pipe(
      // Use the 'map' operator to handle the successful response
      map((res) => {
        const savedInfo: any[] = res?.body?.data || [];
        this.savedAdditionalInfo = savedInfo;

        // Create a map of saved answers for easy lookup
        const savedAnswersMap = new Map<number, any>();
        savedInfo.forEach((item) => {
          // Map answers to questions
          if (item.condition_id === null) {
            savedAnswersMap.set(item.question_id, item);
          }
        });

        // Loop through ALL questions from the master list
        this.additionalQuestions.forEach((question) => {
          const controlName = `question_${question.question_id}`;
          const control = this.form.get(controlName);
          if (control) {
            const savedAnswer = savedAnswersMap.get(question.question_id);
            // Set the value if found, otherwise set it to null.
            control.setValue(savedAnswer ? savedAnswer.input_field : null);
          }
        });

        // Now, patch all the conditional fields
        savedInfo.forEach((item) => {
          if (item.condition_id !== null) {
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
      }),
      // Use 'catchError' to handle any failures in the stream
      catchError((err) => {
        this.alert.alert(true, 'Failed to load saved additional info.');
        // Return an empty observable to allow the chain to complete gracefully
        return of(undefined);
      })
    );
  }
  private conditionalFileValidator(controlName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const hasNewFile = control.value instanceof File;
      const hasExistingFile = this.additionalFilePaths.has(controlName);
      const isValid = hasNewFile || hasExistingFile;
      return isValid ? null : { required: true };
    };
  }

  getAdditionalFilePath(controlName: string): string | null {
    return this.additionalFilePaths.get(controlName) || null;
  }

private buildAdditionalInfoFormControls(questions: any[]): void {
  questions.forEach((question) => {
    const validators = [];
    if (question.is_required === 'Y') {
      validators.push(Validators.required);
    }

    this.form.addControl(
      `question_${question.question_id}`,
      this.fb.control(null, validators) // Initialize main questions with null
    );

    question.options.forEach((option: any) => {
      if (option.has_condition === 'Y') {
        option.conditions.forEach((condition: any) => {
          this.form.addControl(
            `condition_${condition.condition_id}`,
            // ✅ THE FIX: Initialize conditional controls with null instead of ''
            this.fb.control(null) 
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
      this.alert.alertMessage(
        'Invalid Date Selected',
        `The marriage date cannot be after <b>${maxDate}</b>.<br>Please choose a valid date.`,
        'error'
      );
    }
  }

private setupConditionalValidators(questions: any[]): void {
  questions.forEach((question) => {
    const questionControl = this.form.get(`question_${question.question_id}`);
    if (!questionControl) return;

    questionControl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe((selectedValue) => {
        // --- Logic to fetch dynamic dropdown data on demand ---
        if (question.question_id === 5 && selectedValue === 'Y') {
          const disabilityCondition = question.options
            .find((opt: any) => opt.option_value === 'Y')
            ?.conditions?.find((c: any) => c.condition_data_type === 'select');

          if (disabilityCondition && this.disabilityTypes.length === 0) {
            this.getDropdownDataByQuery(disabilityCondition.query_id).subscribe(
              (res) => {
                this.disabilityTypes = res?.body?.data?.data || [];
                this.cdr.markForCheck();
              }
            );
          }
        }
        
        question.options.forEach((option: any) => {
          const isSelected = option.option_value === selectedValue;
          if (option.has_condition === 'Y') {
            option.conditions.forEach((condition: any) => {
              const controlName = `condition_${condition.condition_id}`;
              const conditionControl = this.form.get(controlName);
              if (conditionControl) {
                if (isSelected && condition.condition_required === 'Y') {
                  const validators: ValidatorFn[] = [];
                  if (condition.condition_data_type === 'file') {
                    validators.push(this.conditionalFileValidator(controlName));
                  } else {
                    validators.push(Validators.required);
                  }
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
                } else {
                  conditionControl.clearValidators();
                  // ✅ THE FIX: Reset the control's value to null, not an empty string.
                  conditionControl.reset(null, { emitEvent: false }); 
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
  public handleRadioChange(controlName: string, value: any): void {
    const control = this.form.get(controlName);
    if (control) {
      control.setValue(value);
      control.markAsTouched();
      this.cdr.detectChanges();
    }
  }

  public getSelectedOption(question: any): any | null {
    const control = this.form.get(`question_${question.question_id}`);
    if (!control || !control.value) {
      return null;
    }
    return question.options.find(
      (opt: any) => opt.option_value === control.value
    );
  }
  private validateFile(
    file: File,
    allowedTypes: string[],
    errorMessage: string
  ): boolean {
    const isAllowed = allowedTypes.some((type) => {
      // Handle wildcards like 'image/*'
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      // Handle specific types like 'application/pdf'
      return file.type === type;
    });

    if (!isAllowed) {
      this.alert.alert(true, errorMessage);
      return false;
    }
    return true;
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
    return this.filePaths.get(key) || null;
  }

  sanitizeFileUrl(filePath: string): SafeUrl {
    const fileName = filePath.split('\\').pop() || filePath;
    const url = `http://192.168.1.57:3500/${fileName}`;
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  getFileName(filePath: string): string {
    return filePath.split('\\').pop() || 'Unknown File';
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

  logValidationErrors(group: FormGroup | FormArray): string[] {
    const errors: string[] = [];
    Object.keys(group.controls).forEach((key: string) => {
      const control = group.get(key);
      if (control instanceof FormGroup || control instanceof FormArray) {
        errors.push(...this.logValidationErrors(control));
      } else if (control?.invalid && control?.touched) {
        let displayName = this.fieldNameMap[key] || key;
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
        } else if (control.errors?.['pattern'] && key === 'Mobile_No') {
          errors.push(`${displayName} must be a valid 10-digit Indian number.`);
        } else if (control.errors?.['underage']) {
          errors.push(`You must be at least 18 years old for ${displayName}.`);
        }
      }
    });
    return errors;
  }

  async saveAdditionalInformation(): Promise<void> {
    const formData = new FormData();
    const registrationNo = this.form.get('registration_no')?.value;
    formData.append('registration_no', registrationNo);
    const additionalInfoPayload: any[] = [];
    for (const question of this.additionalQuestions) {
      const questionControlName = `question_${question.question_id}`;
      const selectedOptionValue = this.form.get(questionControlName)?.value;
      if (selectedOptionValue) {
        const selectedOption = question.options.find(
          (opt: any) => opt.option_value === selectedOptionValue
        );
        if (selectedOption) {
          additionalInfoPayload.push({
            question_id: question.question_id,
            option_id: selectedOption.option_id,
            condition_id: null,
            input_field: null,
          });
          if (selectedOption.has_condition === 'Y') {
            for (const condition of selectedOption.conditions) {
              const conditionControlName = `condition_${condition.condition_id}`;
              const conditionControl = this.form.get(conditionControlName);
              const conditionValue = conditionControl?.value;
              let inputFieldValue = null;
              if (conditionValue instanceof File) {
                const fileControlName = `additional_${question.question_id}_${selectedOption.option_id}_${condition.condition_id}`;
                formData.append(
                  fileControlName,
                  conditionValue,
                  conditionValue.name
                );
              } else {
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
    console.log(
      '🔼 Frontend payload being sent:',
      JSON.stringify(additionalInfoPayload, null, 2)
    );
    if (additionalInfoPayload.length === 0) {
      console.warn('No additional info data to save.');
      return Promise.resolve();
    }
    formData.append('additionalInfo', JSON.stringify(additionalInfoPayload));
    return new Promise((resolve, reject) => {
      this.saveAdditionalInfo(formData).subscribe({
        next: (res) => {
          if (res?.body?.error) {
            this.alert.alert(true, res.body.error);
            reject(new Error(res.body.error));
          } else {
            console.log('✅ Additional info saved successfully.');
            resolve();
          }
        },
        error: (err) => {
          this.alert.alert(true, 'Failed to save additional info.');
          reject(err);
        },
      });
    });
  }

  // --- Utility & Helper Methods ---
  onCharacterInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const initialValue = input.value;

    // This regex removes anything that is NOT a letter or a space
    const sanitizedValue = initialValue.replace(/[^a-zA-Z\s]/g, '');

    if (initialValue !== sanitizedValue) {
      // Get the form control name from the input element's id or name attribute
      const formControlName = input.getAttribute('formControlName');
      if (formControlName) {
        this.form
          .get(formControlName)
          ?.setValue(sanitizedValue, { emitEvent: false });
      }
    }
  }
  onNumericInput(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const initialValue = input.value;

    // Remove any non-digit characters
    const sanitizedValue = initialValue.replace(/[^0-9]/g, '');

    if (initialValue !== sanitizedValue) {
      this.form
        .get(controlName)
        ?.setValue(sanitizedValue, { emitEvent: false });
    }
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
    };

    const additionalInfoDetails: { question: string; answer: any }[] = [];
    if (this.additionalQuestions && this.additionalQuestions.length > 0) {
      this.additionalQuestions.forEach((question) => {
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
                const existingFilePath =
                  this.additionalFilePaths.get(conditionControlName);

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
            debounceTime(300), // Slightly increased debounce time
            distinctUntilChanged(),
            switchMap((value) => {
              const trimmed = (value || '').trim();
              if (trimmed === '') {
                hinControl.setValue('');
                return of(null); // Return observable that does nothing
              }
              // Let translateToHindi handle success/failure
              return this.translateToHindi(trimmed);
            })
          )
          // ✅ Use the object syntax for subscribe to handle errors
          .subscribe({
            next: (result) => {
              // This block only runs on a SUCCESSFUL translation
              if (result !== null) {
                hinControl.setValue(result);
              }
            },
            error: (err) => {
              // On API error, DO NOTHING. The existing Hindi value is preserved.
              console.error('Transliteration failed:', err);
            },
          });
      }
    });
  }

  translateToHindi(text: string): Observable<string | null> {
    return this.HTTP.getParam(
      '/master/get/getTransliterationHindi',
      { text },
      'recruitement'
    ).pipe(
      map((response: any) => {
        const transliteration = response?.body?.data?.transliteration;
        // ✅ Return the value on success, or null if not found
        return transliteration || null;
      }),
      catchError((err) => {
        // ✅ On network error, re-throw the error to be caught by the subscribe block
        console.error('Transliteration API error:', err);
        throw err;
      })
    );
  }

  async submitForm(): Promise<void> {
    this.emitFormData();
    this.markFormGroupTouched(this.form);

    if (this.form.invalid) {
      const validationErrors = this.logValidationErrors(this.form);
      const firstErrorMessage =
        validationErrors[0] || 'Please fill all mandatory fields.';
      this.alert.alert(true, firstErrorMessage);
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

    // --- 3. Prepare Additional Information Payload (based on current form state) ---
    const additionalInfoPayload: any[] = [];
    for (const question of this.additionalQuestions) {
      const questionControlName = `question_${question.question_id}`;
      const selectedOptionValue = this.form.get(questionControlName)?.value;

      if (selectedOptionValue) {
        const selectedOption = question.options.find(
          (opt: any) => opt.option_value === selectedOptionValue
        );
        if (selectedOption) {
          const existingMainRecord = this.savedAdditionalInfo.find(
            (info) =>
              info.question_id === question.question_id &&
              info.condition_id === null
          );

          additionalInfoPayload.push({
            a_rec_app_main_addtional_info_id:
              existingMainRecord?.a_rec_app_main_addtional_info_id || null,
            question_id: question.question_id,
            option_id: selectedOption.option_id,
            condition_id: null,
            input_field: null,
          });

          if (selectedOption.has_condition === 'Y') {
            for (const condition of selectedOption.conditions) {
              const conditionControlName = `condition_${condition.condition_id}`;
              const conditionValue = this.form.get(conditionControlName)?.value;
              let inputFieldValue = null;

              const existingConditionRecord = this.savedAdditionalInfo.find(
                (info) =>
                  info.question_id === question.question_id &&
                  info.option_id === selectedOption.option_id &&
                  info.condition_id === condition.condition_id
              );

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

    // --- 4. ⭐ NEW LOGIC: Determine which records to delete ---
    // Create a Set of primary keys from the new payload that should exist in the DB.
    const newRecordIds = new Set(
      additionalInfoPayload
        .map((p) => p.a_rec_app_main_addtional_info_id)
        .filter((id) => id != null) // Only consider existing records with an ID
    );

    // Compare the original saved records with the new set. Any missing ID is marked for deletion.
    const additionalInfoIdsToDelete: number[] = [];
    this.savedAdditionalInfo.forEach((savedRecord) => {
      if (!newRecordIds.has(savedRecord.a_rec_app_main_addtional_info_id)) {
        additionalInfoIdsToDelete.push(
          savedRecord.a_rec_app_main_addtional_info_id
        );
      }
    });

    // --- 5. Append all data to FormData ---
    if (additionalInfoPayload.length > 0) {
      formData.append('additionalInfo', JSON.stringify(additionalInfoPayload));
      formData.append(
        'additionalInfoQuestions',
        JSON.stringify(this.additionalQuestions)
      );
    }

    // ⭐ NEW: Append the array of IDs to delete. The backend will handle them.
    if (additionalInfoIdsToDelete.length > 0) {
      formData.append(
        'additionalInfoIdsToDelete',
        JSON.stringify(additionalInfoIdsToDelete)
      );
    }

    // --- 6. Make the SINGLE API call ---
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
              res.body.error.message || 'An error occurred.'
            );
            reject(new Error(res.body.error.message));
            return;
          }

          this.alert.alert(false, 'All candidate details saved successfully!');

          // ⭐ NEW & CRITICAL: After a successful save, re-fetch the latest
          // additional info to update our local state (`savedAdditionalInfo`).
          // This ensures the next save operation works correctly.
          const registrationNo = this.form.get('registration_no')?.value;
          if (registrationNo) {
            this.getSavedAdditionalInfo(registrationNo).subscribe(
              (response) => {
                this.savedAdditionalInfo = response?.body?.data || [];
              }
            );
          }

          if (res.body?.data?.photo_path) {
            this.filePaths.set('photo', res.body.data.photo_path);
            this.photoPreview = this.getFileUrl(res.body.data.photo_path);
            this.form
              .get('photo')
              ?.setValue(res.body.data.photo_path, { emitEvent: false });
          }
          if (res.body?.data?.signature_path) {
            this.filePaths.set('signature', res.body.data.signature_path);
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
          this.alert.alert(true, errorMessage);
          reject(err);
        },
      });
    });
  }
}
