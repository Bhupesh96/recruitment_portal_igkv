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
import { RecruitmentStateService } from '../../../recruitment-state.service';
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
  private dropdownConfig = [
    { propertyName: 'salutations', queryId: 111 },
    { propertyName: 'religionList', queryId: 112 },
    { propertyName: 'countryList', queryId: 113 },
    { propertyName: 'stateList', queryId: 114 }, // You can also put numbers directly
    { propertyName: 'languageTypes', queryId: 116 },
    { propertyName: 'languages', queryId: 117 },
    { propertyName: 'languageSkills', queryId: 118 },
    { propertyName: 'advertisementList', queryId: 108 },
  ];
  form: FormGroup;
  showSubjectDropdown = false;
  salutations: any[] = [];
  subjectList: any[] = [];
  religionList: any[] = [];
  countryList: any[] = [];
  stateList: any[] = [];
  permanentDistrictList: any[] = [];
  currentDistrictList: any[] = [];
  birthDistrictList: any[] = [];
  languageTypes: any[] = [];
  languages: any[] = [];
  languageSkills: any[] = [];
  public isScreeningMode: boolean = true;
  postList: {
    post_code: number;
    post_name: string;
    post_status_name: string;
  }[] = [];
  advertisementList: {
    a_rec_adv_main_id: number;
    advertisment_no: string;
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
  public verifyStatusList: any[] = [];
  public verifyRemarkList: any[] = [];
  disabilityTypes: any[] = []; // <-- ADD THIS LINE
  private isUpdatingScreenerRecord = false; // Flag to track if we are updating an 'E' record
  private screenerAppMainId: number | null = null;
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
    gender_id: 'Gender',
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
    private loader: LoaderService,
    private recruitmentState: RecruitmentStateService
  ) {
    const initialUserData = this.recruitmentState.getScreeningCandidateData();
    console.log(
      'data saved for step-1 for screening: ',
      JSON.stringify(initialUserData, null, 2)
    );
    this.showSubjectDropdown = !!initialUserData?.subject_id;
    this.form = this.fb.group({
      a_rec_app_main_id: [null],
      registration_no: [
        initialUserData?.registration_no || null,
        Validators.required,
      ],
      a_rec_adv_main_id: [
        { value: initialUserData?.a_rec_adv_main_id || null, disabled: true },
        Validators.required,
      ],
      post_name: [''],
      post_code: [
        { value: initialUserData?.post_code || null, disabled: true },
        Validators.required,
      ],
      session_id: [
        initialUserData?.academic_session_id || null,
        Validators.required,
      ],
      subject_id: [
        { value: initialUserData?.subject_id || 0, disabled: true },
        this.showSubjectDropdown ? Validators.required : [], // Validator is also conditional
      ],
      Salutation_E: [null, Validators.required],
      Salutation_H: [null, Validators.required],
      Applicant_First_Name_E: ['', Validators.required],
      Applicant_Middle_Name_E: [''],
      Applicant_Last_Name_E: [''],
      Applicant_First_Name_H: ['', Validators.required],
      Applicant_Middle_Name_H: [''],
      Applicant_Last_Name_H: [''],
      Applicant_Father_Name_E: ['', Validators.required],
      Applicant_Mother_Name_E: ['', Validators.required],
      gender_id: [null, Validators.required], // Radios also benefit from null
      DOB: [null, Validators.required],
      Document_Status_Flag_Id: [null, Validators.required], // Add Status control
      Document_Status_Remark_Id: [null],
      age: [{ value: '', disabled: true }],
      Mobile_No: [
        { value: '', disabled: true },
        [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)],
      ],
      Email_Id: [
        { value: '', disabled: true },
        [Validators.required, Validators.email],
      ],
      Birth_Place: ['', Validators.required],
      Birth_District_Id: [null, Validators.required], // Changed from '' to null
      Birth_State_Id: [null, Validators.required],
      Birth_Country_Id: [null, Validators.required], // Changed from '' to null
      Identification_Mark1: ['', Validators.required],
      Identification_Mark2: ['', Validators.required],
      religion_code: [null, Validators.required], // Changed from '' to null
      Permanent_Address1: ['', Validators.required],
      Permanent_City: ['', Validators.required],
      Permanent_District_Id: [null, Validators.required], // Changed from '' to null
      Permanent_State_Id: [null, Validators.required], // Changed from '' to null
      Permanent_Country_Id: [null, Validators.required], // Changed from '' to null
      Permanent_Pin_Code: [
        '',
        [Validators.required, Validators.pattern(/^\d{6}$/)],
      ],
      Current_Address1: ['', Validators.required],
      Current_City: ['', Validators.required],
      Current_District_Id: [null, Validators.required], // Changed from '' to null
      Current_State_Id: [null, Validators.required], // Changed from '' to null
      Current_Country_Id: [null, Validators.required], // Changed from '' to null
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
    this.setupDOBRemarkValidation();
  }
  private setupDOBRemarkValidation(): void {
    const statusControl = this.form.get('Document_Status_Flag_Id');
    const remarkControl = this.form.get('Document_Status_Remark_Id');

    if (statusControl && remarkControl) {
      statusControl.valueChanges.subscribe((statusId) => {
        if (statusId === 2) {
          // Assuming '2' means Rejected
          remarkControl.setValidators(Validators.required);
        } else {
          remarkControl.clearValidators();
        }
        remarkControl.updateValueAndValidity();
      });
    }
  }
  private initializeFormWithData(): void {
    this.loader.showLoader();

    // 1. Automatically create API calls for all dropdowns from the configuration array
    const dropdownRequests = this.dropdownConfig.map((config) =>
      this.getDropdownData(config.queryId)
    );

    // 2. Define the remaining, non-dropdown API calls
    const otherRequests = [
      this.getAdditionalInfoQuestions(),
      this.getUserData(),
      this.getSavedLanguages(),
      this.getDropdownData(258), // API call for Verify Status
      this.getDropdownData(259, { Score_Field_Parent_Id: 0 }),
    ];

    // 3. Combine all requests into a single array for forkJoin
    const allDataSources$ = [...dropdownRequests, ...otherRequests];

    forkJoin(allDataSources$).subscribe({
      next: (responses) => {
        // 4. Automatically assign dropdown data to component properties using the configuration
        this.dropdownConfig.forEach((config, index) => {
          (this as any)[config.propertyName] = responses[index];
        });

        // 5. Manually get the results of the non-dropdown calls from the end of the response array
        const additionalQuestionsRes = responses[this.dropdownConfig.length];
        const userDataRes = responses[this.dropdownConfig.length + 1];
        const savedLanguagesRes = responses[this.dropdownConfig.length + 2];
        this.verifyStatusList = responses[this.dropdownConfig.length + 3]; // Assign Verify Status data
        this.verifyRemarkList = responses[this.dropdownConfig.length + 4];

        // 6. Process the remaining data as before
        let questions = additionalQuestionsRes?.body?.data?.questions || [];
        questions.forEach((question: any) => {
          question.options.forEach((option: any) => {
            if (option.conditions && option.conditions.length > 0) {
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

        if (this.additionalQuestions.length > 0) {
          this.buildAdditionalInfoFormControls(this.additionalQuestions);
          this.setupConditionalValidators(this.additionalQuestions);
        }

        const userData = userDataRes?.body?.data?.[0];
        if (userData) {
          this.patchUserData(userData);
          const savedLanguages = savedLanguagesRes?.body?.data || [];
          if (savedLanguages.length > 0) {
            this.patchUserLanguages(savedLanguages);
          }
          this.loadAndPatchAdditionalInfo(userData.registration_no).subscribe(
            () => {
              this.setupCustomLogicListeners();
              this.loadAdvertisementDetails();
              this.disableFormForScreening();
              this.loader.hideLoader();
            }
          );
        } else {
          this.loader.hideLoader();
        }
      },
      error: (err: any) => {
        console.error('Error during initial data load:', err);
        this.alert.alert(
          true,
          'Failed to load essential application data. Please refresh the page.'
        );
        this.loader.hideLoader();
      },
    });
  }

  private getDropdownData(
    queryId: number,
    params: { [key: string]: any } = {}
  ): Observable<any[]> {
    return this.HTTP.getParam(
      '/master/get/getDataByQueryId',
      { query_id: queryId, ...params },
      'recruitement'
    ).pipe(
      map((res: any) => {
        const data = res?.body?.data || [];
        if (data.length === 0) {
          return [{ id: '', name: 'No Data Available', disabled: true }];
        }
        return data.map((item: any) => ({
          ...item,
          id: item.data_id,
          name: item.data_name,
          disabled: false,
        }));
      }),
      catchError(() => {
        return of([{ id: '', name: 'Error loading data', disabled: true }]);
      })
    );
  }

  private setupCustomLogicListeners(): void {
    const residentControl = this.form.get('question_3');
    const categoryControl = this.form.get('question_2');

    if (!residentControl || !categoryControl || !this.categoryQuestion) {
      return;
    }
    const updateCategoryOptions = (isResident: string | null) => {
      if (isResident === 'N') {
        this.filteredCategoryOptions = this.categoryQuestion.options.filter(
          (opt: any) => opt.option_value === 'UR'
        );
        if (categoryControl.value !== 'UR') {
          categoryControl.setValue('UR');
        }
      } else {
        this.filteredCategoryOptions = this.categoryQuestion.options;
      }
      this.cdr.markForCheck();
    };
    residentControl.valueChanges.subscribe(updateCategoryOptions);
    updateCategoryOptions(residentControl.value);
  }

  private initializeFormListeners(): void {
    this.setupLiveHindiTranslation();
    this.form.get('Salutation_E')?.valueChanges.subscribe((selectedId) => {
      if (selectedId && this.salutations.length > 0) {
        const selectedSalutation = this.salutations.find(
          (s) => s.id == selectedId
        );

        if (selectedSalutation) {
          this.form
            .get('Salutation_H')
            ?.setValue(selectedSalutation.id, { emitEvent: false });
        }
      }
    });

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
      this.permanentDistrictList = [];
      // ✅ Add emitEvent: false here
      this.form
        .get('Permanent_District_Id')
        ?.setValue(null, { emitEvent: false });
      if (stateId) {
        this.getDistrictsByState(stateId).subscribe((res) => {
          this.permanentDistrictList = res?.body?.data || [];
        });
      }
    });

    // Listener for Current State
    this.form.get('Current_State_Id')?.valueChanges.subscribe((stateId) => {
      this.currentDistrictList = [];
      // ✅ Add emitEvent: false here
      this.form
        .get('Current_District_Id')
        ?.setValue(null, { emitEvent: false });
      if (stateId) {
        this.getDistrictsByState(stateId).subscribe((res) => {
          this.currentDistrictList = res?.body?.data || [];
        });
      }
    });

    // Listener for Birth State
    this.form.get('Birth_State_Id')?.valueChanges.subscribe((stateId) => {
      this.birthDistrictList = [];
      // ✅ Add emitEvent: false here
      this.form.get('Birth_District_Id')?.setValue(null, { emitEvent: false });
      if (stateId) {
        this.getDistrictsByState(stateId).subscribe((res) => {
          this.birthDistrictList = res?.body?.data || [];
        });
      }
    });

    this.form
      .get('presentSame')
      ?.valueChanges.subscribe((isChecked: boolean) => {
        if (isChecked) {
          // 1. Get all the values you need to copy from the permanent address.
          const permanentValues = {
            address: this.form.get('Permanent_Address1')?.value,
            city: this.form.get('Permanent_City')?.value,
            countryId: this.form.get('Permanent_Country_Id')?.value,
            stateId: this.form.get('Permanent_State_Id')?.value,
            districtId: this.form.get('Permanent_District_Id')?.value,
            pinCode: this.form.get('Permanent_Pin_Code')?.value,
          };

          // 2. Disable the current address fields first.
          this.disableCurrentAddressFields();

          // 3. Patch all values EXCEPT the district, as it depends on an API call.
          this.form.patchValue(
            {
              Current_Address1: permanentValues.address,
              Current_City: permanentValues.city,
              Current_Country_Id: permanentValues.countryId,
              Current_State_Id: permanentValues.stateId,
              Current_Pin_Code: permanentValues.pinCode,
            },
            { emitEvent: false }
          ); // Use emitEvent: false to be safe

          // 4. If a state was selected, fetch its districts.
          if (permanentValues.stateId) {
            this.getDistrictsByState(permanentValues.stateId).subscribe(
              (res) => {
                // 5. Populate the district list for the UI.
                this.currentDistrictList = res?.body?.data || [];

                // 6. NOW, it is safe to set the district value.
                this.form
                  .get('Current_District_Id')
                  ?.setValue(permanentValues.districtId, { emitEvent: false });

                // Trigger change detection to ensure the UI updates correctly.
                this.cdr.markForCheck();
              }
            );
          } else {
            // If there's no state, just ensure the district list is empty and the value is null.
            this.currentDistrictList = [];
            this.form
              .get('Current_District_Id')
              ?.setValue(null, { emitEvent: false });
          }
        } else {
          // If the box is unchecked, re-enable and clear the fields.
          this.enableCurrentAddressFields();
          this.clearCurrentAddress();
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['triggerValidation'] && this.triggerValidation) {
      this.markFormGroupTouched(this.form);
    }
  }

  private getUserData(): Observable<any> {
    const candidateData = this.recruitmentState.getScreeningCandidateData();
    const registrationNo = candidateData?.registration_no;

    // ✅ MODIFIED: Always request screening record first, fallback to candidate record
    return this.HTTP.getParam(
      '/master/get/getApplicant',
      {
        registration_no: registrationNo,
        Application_Step_Flag_CES: 'E', // First try to get screening record
      },
      'recruitement'
    ).pipe(
      switchMap((screeningResponse: any) => {
        // If screening record exists and has data, use it
        if (
          screeningResponse?.body?.data &&
          screeningResponse.body.data.length > 0
        ) {
          console.log(
            '✅ Found screening record (E)',
            screeningResponse.body.data[0]
          );
          return of(screeningResponse);
        } else {
          // If no screening record, fallback to candidate record
          console.log(
            '⚠️ No screening record found, falling back to candidate record'
          );
          return this.HTTP.getParam(
            '/master/get/getApplicant',
            {
              registration_no: registrationNo,
              Application_Step_Flag_CES: 'C', // Get candidate record
            },
            'recruitement'
          );
        }
      }),
      catchError((error) => {
        console.error('Error fetching user data:', error);
        // If both fail, return empty
        return of({ body: { data: [] } });
      })
    );
  }
  private getSubjectsByPostCode(postCode: number): Observable<any> {
    return this.HTTP.getParam(
      '/master/get/getSubjectsByPost',
      { post_code: postCode },
      'recruitement'
    );
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

  private getAdditionalInfoQuestions(): Observable<any> {
    return this.HTTP.getParam(
      '/master/get/getAddtionalInforList',
      {},
      'recruitement'
    );
  }
  public getConditionStatus(condition: any): string | null {
    if (!condition || !condition.condition_id) {
      return null;
    }
    const controlName = `verify_status_${condition.condition_id}`;
    const control = this.form.get(controlName);
    return control ? control.value : null;
  }
  private getSavedLanguages(): Observable<any> {
    const candidateData = this.recruitmentState.getScreeningCandidateData();
    const registrationNo = candidateData?.registration_no;
    return this.HTTP.getParam(
      '/master/get/getLanguagesByRegistration',
      { registration_no: registrationNo },
      'recruitement'
    );
  }

  private getSavedAdditionalInfo(
    registrationNo: number,
    flag: 'C' | 'E'
  ): Observable<any> {
    console.log('Registration number: ', registrationNo);
    return this.HTTP.getParam(
      '/candidate/get/getAddtionInfoDetails',
      {
        registration_no: registrationNo,
        Application_Step_Flag_CES: flag,
      },
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
      '/candidate/postFile/saveOrUpdateAdditionalInformationForScreening',
      formData,
      'recruitement'
    );
  }

  private patchUserData(data: any): void {
    if (!data) return; // Exit if no data provided

    // Store the screener ID if available
    this.screenerAppMainId = data.a_rec_app_main_id;
    console.log(
      '📝 Stored screening record ID:',
      this.screenerAppMainId,
      'with flag:',
      data.Application_Step_Flag_CES
    );

    // --- File Handling (Keep as is, ensure emitEvent: false) ---
    if (data.candidate_photo) {
      this.filePaths.set('photo', data.candidate_photo);
      this.photoPreview = this.getFileUrl(data.candidate_photo);
      // Patch value silently and clear validators if file exists
      this.form
        .get('photo')
        ?.setValue(data.candidate_photo, { emitEvent: false });
      this.form.get('photo')?.clearValidators();
    } else {
      this.form.get('photo')?.setValidators([Validators.required]); // Require if no file exists
    }
    this.form.get('photo')?.updateValueAndValidity(); // Update control state

    if (data.candidate_signature) {
      this.filePaths.set('signature', data.candidate_signature);
      this.signaturePreview = this.getFileUrl(data.candidate_signature);
      // Patch value silently and clear validators if file exists
      this.form
        .get('signature')
        ?.setValue(data.candidate_signature, { emitEvent: false });
      this.form.get('signature')?.clearValidators();
    } else {
      this.form.get('signature')?.setValidators([Validators.required]); // Require if no file exists
    }
    this.form.get('signature')?.updateValueAndValidity(); // Update control state
    // --- End File Handling ---

    // Trigger fetching related data based on patched IDs
    if (data.a_rec_adv_main_id) {
      this.fetchPostsByAdvertisement(data.a_rec_adv_main_id);
    }
    if (data.post_code) {
      this.fetchSubjectsByPost(data.post_code);
    }

    // Prepare requests to fetch district lists based on state IDs
    const districtRequests: { [key: string]: Observable<any> } = {};
    if (data.Permanent_State_Id) {
      districtRequests['permanent'] = this.getDistrictsByState(
        data.Permanent_State_Id
      );
    }
    if (data.Current_State_Id) {
      districtRequests['current'] = this.getDistrictsByState(
        data.Current_State_Id
      );
    }
    if (data.Birth_State_Id) {
      districtRequests['birth'] = this.getDistrictsByState(data.Birth_State_Id);
    }

    // Define the patching function (to be called after districts are loaded, if needed)
    const patchTheForm = () => {
      this.form.patchValue(
        {
          // Map API data to form controls, ensuring type conversions for dropdowns
          a_rec_app_main_id: data.a_rec_app_main_id,
          post_code: data.post_code ? Number(data.post_code) : null,
          subject_id: data.subject_id ? Number(data.subject_id) : 0, // Default to 0 if null/missing
          registration_no: data.registration_no,
          a_rec_adv_main_id: data.a_rec_adv_main_id
            ? Number(data.a_rec_adv_main_id)
            : null,
          session_id: data.academic_session_id || data.session_id, // Use correct field name from API
          Salutation_E: data.Salutation_E ? Number(data.Salutation_E) : null,
          Salutation_H: data.Salutation_E ? Number(data.Salutation_E) : null, // Assuming H uses E's ID
          Applicant_First_Name_E: data.Applicant_First_Name_E,
          Applicant_Middle_Name_E: data.Applicant_Middle_Name_E,
          Applicant_Last_Name_E: data.Applicant_Last_Name_E,
          Applicant_First_Name_H: data.Applicant_First_Name_H,
          Applicant_Middle_Name_H: data.Applicant_Middle_Name_H,
          Applicant_Last_Name_H: data.Applicant_Last_Name_H,
          Applicant_Father_Name_E: data.Applicant_Father_Name_E,
          Applicant_Mother_Name_E: data.Applicant_Mother_Name_E,
          gender_id: data.gender_id, // Usually string 'M', 'F', 'T'
          DOB: data.DOB ? this.formatDateToYYYYMMDD(data.DOB) : null,
          // Patch DOB status/remark, converting to number if not null
          Document_Status_Flag_Id: data.Document_Status_Flag_Id
            ? Number(data.Document_Status_Flag_Id)
            : null,
          Document_Status_Remark_Id: data.Document_Status_Remark_Id
            ? Number(data.Document_Status_Remark_Id)
            : null,
          Mobile_No: String(data.mobile_no || data.Mobile_No || ''), // Allow for different API field names
          Email_Id: data.email_id || data.Email_Id, // Allow for different API field names
          Birth_Place: data.Birth_Place,
          Birth_District_Id: data.Birth_District_Id
            ? Number(data.Birth_District_Id)
            : null,
          Birth_State_Id: data.Birth_State_Id
            ? Number(data.Birth_State_Id)
            : null,
          Birth_Country_Id: data.Birth_Country_Id
            ? Number(data.Birth_Country_Id)
            : null,
          Identification_Mark1: data.Identification_Mark1,
          Identification_Mark2: data.Identification_Mark2,
          religion_code: data.religion_code ? Number(data.religion_code) : null,
          Permanent_Address1: data.Permanent_Address1,
          Permanent_City: data.Permanent_City,
          Permanent_District_Id: data.Permanent_District_Id
            ? Number(data.Permanent_District_Id)
            : null,
          Permanent_State_Id: data.Permanent_State_Id
            ? Number(data.Permanent_State_Id)
            : null,
          Permanent_Country_Id: data.Permanent_Country_Id
            ? Number(data.Permanent_Country_Id)
            : null,
          Permanent_Pin_Code: data.Permanent_Pin_Code,
          Current_Address1: data.Current_Address1,
          Current_City: data.Current_City,
          Current_District_Id: data.Current_District_Id
            ? Number(data.Current_District_Id)
            : null,
          Current_State_Id: data.Current_State_Id
            ? Number(data.Current_State_Id)
            : null,
          Current_Country_Id: data.Current_Country_Id
            ? Number(data.Current_Country_Id)
            : null,
          Current_Pin_Code: data.Current_Pin_Code,
          // Note: photo and signature are handled via setValue before patchTheForm if needed
        },
        { emitEvent: false } // Prevent triggering valueChanges listeners during patch
      );
      this.cdr.markForCheck(); // Ensure UI updates after patching
    };

    // Load districts if necessary, then patch the form
    if (Object.keys(districtRequests).length > 0) {
      forkJoin(districtRequests).subscribe({
        next: (responses: any) => {
          // Populate district lists from responses
          if (responses.permanent)
            this.permanentDistrictList = responses.permanent?.body?.data || [];
          if (responses.current)
            this.currentDistrictList = responses.current?.body?.data || [];
          if (responses.birth)
            this.birthDistrictList = responses.birth?.body?.data || [];
          this.cdr.markForCheck(); // Update UI with district options *before* patching
          patchTheForm(); // Patch form *after* lists are ready
        },
        error: (err) => {
          console.error('Error loading district data:', err);
          this.alert.alert(true, 'Error loading district data.');
          patchTheForm(); // Still attempt to patch other form fields on error
        },
      });
    } else {
      patchTheForm(); // No districts to load, patch immediately
    }
  }
  private patchUserLanguages(langData: any[]): void {
    const langFormArray = this.form.get('languages') as FormArray;
    langFormArray.clear();
    if (langData.length === 0) {
      langFormArray.push(this.createLanguageGroup());
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
      if (maxSizeKB) {
        const maxSizeInBytes = maxSizeKB * 1024;
        if (file.size > maxSizeInBytes) {
          this.alert.alert(
            true,
            `File size cannot exceed ${maxSizeKB}KB. Your file is ~${Math.round(
              file.size / 1024
            )}KB.`
          );
          input.value = '';
          control.setValue(null);
          control.markAsTouched();
          return;
        }
      }
      control.setValue(file);
    } else if (control) {
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
    console.log(
      `Loading additional info for reg no: ${registrationNo}. Checking 'E' first...`
    );

    // 1. Always try to fetch the 'E' (Screening) record first
    return this.getSavedAdditionalInfo(registrationNo, 'E').pipe(
      switchMap((screeningResponse: any) => {
        const screeningData = screeningResponse?.body?.data;

        // 2. Check if the 'E' record has data
        if (screeningData && screeningData.length > 0) {
          console.log(
            '✅ Found screening (E) additional info, patching...',
            JSON.stringify(screeningData, null, 2)
          );
          // If 'E' data exists, pass it to the 'map' operator
          return of(screeningData);
        } else {
          // 3. 'E' record is empty, so fetch the 'C' (Candidate) record
          console.log(
            '⚠️ No screening (E) info found. Falling back to candidate (C) record.'
          );
          return this.getSavedAdditionalInfo(registrationNo, 'C').pipe(
            map((candidateResponse: any) => {
              const candidateData = candidateResponse?.body?.data || [];
              console.log(
                `✅ Found candidate (C) additional info, patching...`,
                JSON.stringify(candidateData, null, 2)
              );
              // Return the data array from the 'C' response
              return candidateData;
            })
          );
        }
      }),
      map((savedInfo: any[]) => {
        // 4. This 'map' operator now receives data from *either* the 'E' or 'C' call
        // All the existing patching logic from here down remains the same.

        this.savedAdditionalInfo = savedInfo; // Store the fetched raw data

        const savedAnswersMap = new Map<number, any>(); // Map for main question answers { question_id -> record }
        const savedConditionsMap = new Map<number, any>(); // Map for conditional answers { condition_id -> record }

        // Populate the maps for efficient lookup
        savedInfo.forEach((item) => {
          if (item.condition_id === null) {
            // It's an answer to a main question
            savedAnswersMap.set(item.question_id, item);
          } else {
            // It's an answer to a conditional field
            savedConditionsMap.set(item.condition_id, item);
          }
        });

        // --- Patch Form Controls ---
        this.additionalQuestions.forEach((question) => {
          // 1. Patch Main Question Control
          const mainControlName = `question_${question.question_id}`;
          const mainControl = this.form.get(mainControlName);
          if (mainControl) {
            const savedAnswer = savedAnswersMap.get(question.question_id);
            if (savedAnswer) {
              // Find the option corresponding to the saved option_id
              const selectedOption = question.options.find(
                (opt: any) => opt.option_id === savedAnswer.option_id
              );
              // Patch the *value* ('Y', 'N', 'UR', etc.) into the radio/select control
              mainControl.setValue(
                selectedOption ? selectedOption.option_value : null,
                { emitEvent: false }
              );
            } else {
              // No saved answer for this question
              mainControl.setValue(null, { emitEvent: false });
            }
          }

          // 2. Patch Conditional Controls (Inputs, Files, Status, Remarks)
          question.options.forEach((option: any) => {
            if (option.has_condition === 'Y' && option.conditions) {
              option.conditions.forEach((condition: any) => {
                const conditionControlName = `condition_${condition.condition_id}`;
                const conditionControl = this.form.get(conditionControlName);
                const savedConditionData = savedConditionsMap.get(
                  condition.condition_id
                ); // Get saved data for this specific condition

                if (conditionControl) {
                  // Check if the form control exists
                  if (savedConditionData) {
                    // Check if we have saved data for this condition
                    // Patch the condition's main input value (text, date, select, or file path)
                    if (condition.condition_data_type === 'file') {
                      if (savedConditionData.input_field) {
                        // Check if a file path was saved
                        this.additionalFilePaths.set(
                          conditionControlName,
                          savedConditionData.input_field
                        );
                        // For file controls, patch the *path string* (not a File object)
                        conditionControl.setValue(
                          savedConditionData.input_field,
                          { emitEvent: false }
                        );
                        // Since a file exists, clear validation (it's satisfied by the existing file)
                        conditionControl.clearValidators();
                        conditionControl.updateValueAndValidity({
                          emitEvent: false,
                        });
                      } else {
                        conditionControl.setValue(null, { emitEvent: false }); // No file was saved
                      }

                      // ✅ Patch verification status and remark for this file condition
                      const statusControl = this.form.get(
                        `verify_status_${condition.condition_id}`
                      );
                      const remarkControl = this.form.get(
                        `verify_remark_${condition.condition_id}`
                      );

                      if (statusControl) {
                        statusControl.setValue(
                          savedConditionData.Document_Status_Flag_Id
                            ? Number(savedConditionData.Document_Status_Flag_Id)
                            : null,
                          { emitEvent: false }
                        );
                      }
                      if (remarkControl) {
                        remarkControl.setValue(
                          savedConditionData.Document_Status_Remark_Id
                            ? Number(
                                savedConditionData.Document_Status_Remark_Id
                              )
                            : null,
                          { emitEvent: false }
                        );
                      }
                    } else {
                      // For non-file types (text, date, radio, select)
                      // Patch the value directly
                      conditionControl.setValue(
                        savedConditionData.input_field,
                        { emitEvent: false }
                      );
                    }
                  } else {
                    // No saved data found for this specific condition
                    conditionControl.setValue(null, { emitEvent: false }); // Reset the condition input
                    // Also reset any associated verification controls if no data exists
                    if (condition.condition_data_type === 'file') {
                      const statusControl = this.form.get(
                        `verify_status_${condition.condition_id}`
                      );
                      const remarkControl = this.form.get(
                        `verify_remark_${condition.condition_id}`
                      );
                      if (statusControl)
                        statusControl.setValue(null, { emitEvent: false });
                      if (remarkControl)
                        remarkControl.setValue(null, { emitEvent: false });
                    }
                  }
                } // End if(conditionControl)
              }); // End loop through conditions
            } // End if option has conditions
          }); // End loop through options
        }); // End loop through questions

        this.cdr.markForCheck(); // Trigger UI update once all patching is done
      }), // End map operator
      catchError((err) => {
        // Catch errors during API call or mapping
        console.error('Failed to load or patch additional info:', err);
        this.alert.alert(true, 'Failed to load saved additional info.');
        return of(undefined); // Return an empty observable to allow the main stream to complete
      })
    ); // End pipe
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
        this.fb.control(null, validators)
      );
      question.options.forEach((option: any) => {
        if (option.has_condition === 'Y') {
          option.conditions.forEach((condition: any) => {
            this.form.addControl(
              `condition_${condition.condition_id}`,
              this.fb.control(null)
            );
            if (condition.condition_data_type === 'file') {
              const statusControlName = `verify_status_${condition.condition_id}`;
              const remarkControlName = `verify_remark_${condition.condition_id}`;
              this.form.addControl(statusControlName, this.fb.control(null));
              this.form.addControl(remarkControlName, this.fb.control(null));
              const statusControl = this.form.get(statusControlName);
              const remarkControl = this.form.get(remarkControlName);
              if (statusControl && remarkControl) {
                statusControl.valueChanges.subscribe((statusId) => {
                  if (statusId === 2) {
                    remarkControl.setValidators(Validators.required);
                  } else {
                    remarkControl.clearValidators();
                  }
                  remarkControl.updateValueAndValidity();
                });
              }
            }
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
    const control = this.form.get('condition_1');
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
          if (question.question_id === 5 && selectedValue === 'Y') {
            const disabilityCondition = question.options
              .find((opt: any) => opt.option_value === 'Y')
              ?.conditions?.find(
                (c: any) => c.condition_data_type === 'select'
              );
            const advId = this.form.get('a_rec_adv_main_id')?.value;
            const post_code = this.form.get('post_code')?.value;
            if (
              disabilityCondition &&
              this.disabilityTypes.length === 0 &&
              advId
            ) {
              this.getDropdownData(disabilityCondition.query_id, {
                a_rec_adv_main_id: advId,
                post_code: post_code,
              }).subscribe((data: any[]) => {
                this.disabilityTypes = data;
                this.cdr.markForCheck();
              });
            }
          }
          question.options.forEach((option: any) => {
            const isSelected = option.option_value === selectedValue;
            if (option.has_condition === 'Y') {
              option.conditions.forEach((condition: any) => {
                const controlName = `condition_${condition.condition_id}`;
                const conditionControl = this.form.get(controlName);
                const statusControl = this.form.get(
                  `verify_status_${condition.condition_id}`
                );
                const remarkControl = this.form.get(
                  `verify_remark_${condition.condition_id}`
                );
                if (conditionControl) {
                  if (isSelected && condition.condition_required === 'Y') {
                    const validators: ValidatorFn[] = [];
                    if (condition.condition_data_type === 'file') {
                      validators.push(
                        this.conditionalFileValidator(controlName)
                      );
                      if (statusControl) {
                        statusControl.setValidators(Validators.required);
                      }
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
                    conditionControl.reset(null, { emitEvent: false });
                    if (statusControl) {
                      statusControl.clearValidators();
                      statusControl.reset(null, { emitEvent: false });
                    }
                    if (remarkControl) {
                      remarkControl.clearValidators();
                      remarkControl.reset(null, { emitEvent: false });
                    }
                  }
                  conditionControl.updateValueAndValidity({ emitEvent: false });
                  if (statusControl)
                    statusControl.updateValueAndValidity({ emitEvent: false });
                  if (remarkControl)
                    remarkControl.updateValueAndValidity({ emitEvent: false });
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
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
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
        if (
          key === 'Document_Status_Flag_Id' ||
          key === 'Document_Status_Remark_Id'
        ) {
          const fieldName = this.fieldNameMap[key] || key;
          if (control.errors?.['required']) {
            errors.push(`${fieldName} is required.`);
          }
        } else if (
          key.startsWith('verify_status_') ||
          key.startsWith('verify_remark_')
        ) {
          const conditionId = Number(key.split('_').pop());
          for (const q of this.additionalQuestions) {
            for (const o of q.options) {
              const condition = o.conditions?.find(
                (c: any) => c.condition_id === conditionId
              );
              if (condition) {
                const fieldName = key.startsWith('verify_status_')
                  ? 'Verify Status'
                  : 'Verify Remark';
                errors.push(
                  `'${fieldName}' is required for the '${condition.dependent_field_label}' attachment under '${q.question_label}'.`
                );
                return;
              }
            }
          }
        }
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
                displayName = `${condition.dependent_field_label} (under ${q.question_label})`;
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
    if (additionalInfoPayload.length === 0) {
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

  onCharacterInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const initialValue = input.value;
    const sanitizedValue = initialValue.replace(/[^a-zA-Z\s]/g, '');
    if (initialValue !== sanitizedValue) {
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

  markFormGroupTouched(group: FormGroup | FormArray): void {
    Object.values(group.controls).forEach((control) => {
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      } else {
        control.markAsTouched();
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
        this.permanentDistrictList.find(
          // Use the correct list
          (d: any) => d.district_id === Number(formValue.Permanent_District_Id) // Add the 'any' type
        )?.district_name || '',

      Current_Country_Name:
        this.countryList.find(
          (c: any) => c.country_id === Number(formValue.Current_Country_Id)
        )?.country_name || '',

      Current_State_Name:
        this.stateList.find(
          (s: any) => s.state_id === Number(formValue.Current_State_Id)
        )?.name || '',

      Current_District_Name:
        this.currentDistrictList.find(
          // Use the correct list
          (d: any) => d.district_id === Number(formValue.Current_District_Id) // Add the 'any' type
        )?.district_name || '',

      Birth_Country_Name:
        this.countryList.find(
          (c: any) => c.country_id === Number(formValue.Birth_Country_Id)
        )?.country_name || '',

      Birth_State_Name:
        this.stateList.find(
          (s: any) => s.state_id === Number(formValue.Birth_State_Id)
        )?.name || '',

      Birth_District_Name:
        this.birthDistrictList.find(
          // Use the correct list
          (d: any) => d.district_id === Number(formValue.Birth_District_Id) // Add the 'any' type
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
            debounceTime(300),
            distinctUntilChanged(),
            switchMap((value) => {
              const trimmed = (value || '').trim();
              if (trimmed === '') {
                hinControl.setValue('');
                return of(null);
              }
              return this.translateToHindi(trimmed);
            })
          )
          .subscribe({
            next: (result) => {
              if (result !== null) {
                hinControl.setValue(result);
              }
            },
            error: (err) => {
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
        return transliteration || null;
      }),
      catchError((err) => {
        console.error('Transliteration API error:', err);
        throw err;
      })
    );
  }
  private disableFormForScreening(): void {
    const disableOptions = { emitEvent: false };

    // Disable main form controls (except verification)
    Object.keys(this.form.controls).forEach((key) => {
      const isVerificationControl =
        key.startsWith('verify_status_') ||
        key.startsWith('verify_remark_') ||
        key === 'Document_Status_Flag_Id' ||
        key === 'Document_Status_Remark_Id';

      // ✅ NEW: Check if it's an additional question control
      const isAdditionalQuestionControl = key.startsWith('question_');
      const isConditionalControl = key.startsWith('condition_'); // Conditional controls should also be disabled

      // Only disable if it's NOT a verification control
      // It *should* disable additional questions and conditions
      if (!isVerificationControl) {
        const control = this.form.get(key);
        if (control) {
          control.disable(disableOptions);
        }
      } else {
        // Ensure verification controls ARE enabled
        const control = this.form.get(key);
        if (control?.disabled) {
          control.enable(disableOptions);
        }
      }
    });

    // Languages array should still be disabled
    this.languagesArray.disable(disableOptions);

    // --- Ensure Additional Question controls are explicitly disabled ---
    // (This might be redundant if the loop above catches them, but ensures clarity)
    this.additionalQuestions.forEach((question) => {
      const questionControl = this.form.get(`question_${question.question_id}`);
      if (questionControl && !questionControl.disabled) {
        questionControl.disable(disableOptions);
      }
      // Also disable conditional controls again, just to be sure
      question.options.forEach((option: any) => {
        if (option.has_condition === 'Y' && option.conditions) {
          option.conditions.forEach((condition: any) => {
            const condControl = this.form.get(
              `condition_${condition.condition_id}`
            );
            if (condControl && !condControl.disabled) {
              condControl.disable(disableOptions);
            }
          });
        }
      });
    });

    console.log(
      'Form disabled for screening. Verification controls should remain enabled.'
    );
    this.cdr.markForCheck(); // Ensure UI reflects disabled state
  }
  async submitForm(): Promise<void> {
    this.emitFormData(); // Emit data for preview or parent component
    this.markFormGroupTouched(this.form); // Mark all fields as touched for validation

    // Check if the form is valid according to Angular's validators
    if (this.form.invalid) {
      const validationErrors = this.logValidationErrors(this.form);
      const firstErrorMessage =
        validationErrors[0] || 'Please fill all mandatory fields.';
      this.alert.alert(true, firstErrorMessage); // Show the first validation error
      return Promise.reject(new Error('Form is invalid')); // Stop submission
    }

    this.loader.showLoader(); // Show loading indicator

    const formData = new FormData(); // Initialize FormData for file uploads
    // Use getRawValue() to include disabled controls (like IDs potentially set during load)
    const formValue = this.form.getRawValue();

    // --- 1. Prepare Main Profile Payload ---
    const mainPayloadForJson = { ...formValue };
    delete mainPayloadForJson.photo; // Remove potential File object for photo
    delete mainPayloadForJson.signature; // Remove potential File object for signature

    // --- Start Revised ID Logic for Screening Upsert ---
    let idForPayload: number | null = null;

    // Prioritize the ID stored in the component state (set during load if 'E' record exists)
    if (this.screenerAppMainId) {
      idForPayload = this.screenerAppMainId;
      console.log(
        `Using component's stored screenerAppMainId: ${idForPayload}`
      );
    }
    // Fallback: Check if an ID exists in the form's raw value (might be set during patching)
    else if (mainPayloadForJson.a_rec_app_main_id) {
      idForPayload = mainPayloadForJson.a_rec_app_main_id;
      console.log(
        `Using a_rec_app_main_id from formValue as fallback: ${idForPayload}`
      );
      // Optional: Sync component state if it was missing but found in form
      // this.screenerAppMainId = idForPayload;
    }

    // Set or delete the ID in the final payload based on whether one was found
    if (idForPayload) {
      mainPayloadForJson.a_rec_app_main_id = idForPayload; // Ensure the correct ID is set for UPDATE
      console.log(`✅ Preparing payload for UPDATE with ID: ${idForPayload}`);
    } else {
      delete mainPayloadForJson.a_rec_app_main_id; // Ensure no ID is sent for INSERT
      console.log('ℹ️ Preparing payload for INSERT (no ID found).');
    }
    // --- End Revised ID Logic ---

    console.log(
      '🚀 Frontend mainPayload BEFORE sending:',
      JSON.stringify(mainPayloadForJson, null, 2)
    );
    // Log DOB verification fields specifically
    console.log(
      '    >> Frontend DOB Status:',
      mainPayloadForJson.Document_Status_Flag_Id
    );
    console.log(
      '    >> Frontend DOB Remark:',
      mainPayloadForJson.Document_Status_Remark_Id
    );

    // Handle photo file upload or existing path
    if (formValue.photo instanceof File) {
      formData.append('photo', formValue.photo, formValue.photo.name);
      // If sending a new file, don't send the old path in the JSON payload
      delete mainPayloadForJson.candidate_photo;
    } else {
      // Keep existing path if not a new file (value is string path or null)
      mainPayloadForJson.candidate_photo = formValue.photo;
    }

    // Handle signature file upload or existing path
    if (formValue.signature instanceof File) {
      formData.append(
        'signature',
        formValue.signature,
        formValue.signature.name
      );
      // If sending a new file, don't send the old path in the JSON payload
      delete mainPayloadForJson.candidate_signature;
    } else {
      // Keep existing path if not a new file (value is string path or null)
      mainPayloadForJson.candidate_signature = formValue.signature;
    }

    // Append the main JSON payload (now with correct ID handling)
    formData.append('mainPayload', JSON.stringify(mainPayloadForJson));

    // --- 2. Prepare Languages Payload ---
    const languagePayload = this.languagesArray.controls.map((ctrl) => ({
      ...ctrl.getRawValue(), // Use getRawValue as languages array might be disabled
      registration_no: mainPayloadForJson.registration_no,
      a_rec_adv_main_id: mainPayloadForJson.a_rec_adv_main_id,
    }));
    formData.append('languages', JSON.stringify(languagePayload));

    // --- 3. Prepare Additional Info & Conditional Files Payload ---
    const additionalInfoPayload: any[] = [];
    for (const question of this.additionalQuestions) {
      const questionControlName = `question_${question.question_id}`;
      const selectedOptionValue = formValue[questionControlName]; // Use raw value

      if (selectedOptionValue) {
        const selectedOption = question.options.find(
          (opt: any) => opt.option_value === selectedOptionValue
        );

        if (selectedOption) {
          // Add the main question's answer record
          additionalInfoPayload.push({
            question_id: question.question_id,
            option_id: selectedOption.option_id,
            condition_id: null, // Main question has null condition_id
            input_field: selectedOptionValue, // Store the selected value (e.g., 'Y', 'N')
            Document_Status_Flag_Id: null, // Status/Remark only apply to conditions (files)
            Document_Status_Remark_Id: null,
          });

          // Process conditions if they exist for the selected option
          if (
            selectedOption.has_condition === 'Y' &&
            selectedOption.conditions
          ) {
            for (const condition of selectedOption.conditions) {
              const conditionControlName = `condition_${condition.condition_id}`;
              const conditionValue = formValue[conditionControlName]; // Use raw value
              let inputFieldValue: any = null; // Value to store in DB (path or text)

              // Get verification status/remark controls
              const statusControl = this.form.get(
                `verify_status_${condition.condition_id}`
              );
              const remarkControl = this.form.get(
                `verify_remark_${condition.condition_id}`
              );

              // Handle file conditions
              if (condition.condition_data_type === 'file') {
                if (conditionValue instanceof File) {
                  // New file uploaded
                  const fileControlName = `additional_${question.question_id}_${selectedOption.option_id}_${condition.condition_id}`;
                  formData.append(
                    fileControlName,
                    conditionValue,
                    conditionValue.name
                  );
                  // Backend will generate path, so input_field can be null or filename sent separately if needed
                  inputFieldValue = null; // Or maybe conditionValue.name if backend needs it? Check backend logic.
                } else {
                  // No new file, use existing path from component state if available
                  inputFieldValue =
                    this.additionalFilePaths.get(conditionControlName) || null;
                }
              } else {
                // Non-file condition, use the value directly
                inputFieldValue = conditionValue;
              }

              // Add the condition record to the payload
              additionalInfoPayload.push({
                question_id: question.question_id,
                option_id: selectedOption.option_id,
                condition_id: condition.condition_id,
                input_field: inputFieldValue,
                // Include status and remark from their respective controls (using getRawValue internally)
                Document_Status_Flag_Id: statusControl?.value || null,
                Document_Status_Remark_Id: remarkControl?.value || null,
              });
            }
          }
        }
      }
    }
    formData.append('additionalInfo', JSON.stringify(additionalInfoPayload));
    // Note: Sending additionalInfoQuestions might be redundant if backend doesn't use it for this specific save operation.
    // formData.append(
    //   'additionalInfoQuestions',
    //   JSON.stringify(this.additionalQuestions)
    // );

    // --- 4. Call the Backend API ---
    return new Promise((resolve, reject) => {
      this.HTTP.postForm(
        '/candidate/postFile/saveOrUpdateFullCandidateProfileForScreening', // Endpoint for screening save
        formData,
        'recruitement'
      ).subscribe({
        next: async (res) => {
          // Keep async if using await alert
          this.loader.hideLoader();
          if (res?.body?.error) {
            // Handle backend-specific errors
            this.alert.alert(
              true,
              res.body.error.message || 'An error occurred during save.'
            );
            // Reject with a specific error code/message if possible
            reject(new Error(res.body.error.code || 'SAVE_FAILED'));
            return;
          }

          // --- Update Component State After Successful Save ---
          const returnedAppMainId = res?.body?.data?.a_rec_app_main_id;
          if (returnedAppMainId && !this.screenerAppMainId) {
            // This happens after the *first* successful save (INSERT)
            console.log(
              `✅ Received new screening ID ${returnedAppMainId} from backend, updating component state.`
            );
            this.screenerAppMainId = returnedAppMainId;
            // Silently update the form control value to match the state
            this.form
              .get('a_rec_app_main_id')
              ?.setValue(this.screenerAppMainId, { emitEvent: false });
          } else if (
            returnedAppMainId &&
            this.screenerAppMainId &&
            this.screenerAppMainId !== returnedAppMainId
          ) {
            // Should ideally not happen if logic is correct, but handles unexpected cases
            console.warn(
              `Backend returned ID ${returnedAppMainId} which differs from component state ${this.screenerAppMainId}. Updating component state.`
            );
            this.screenerAppMainId = returnedAppMainId;
            this.form
              .get('a_rec_app_main_id')
              ?.setValue(this.screenerAppMainId, { emitEvent: false });
          }
          // Handle potential updates to file paths returned from backend
          if (res?.body?.data?.photo_path) {
            this.filePaths.set('photo', res.body.data.photo_path);
            this.photoPreview = this.getFileUrl(res.body.data.photo_path);
            this.form
              .get('photo')
              ?.setValue(res.body.data.photo_path, { emitEvent: false });
          }
          if (res?.body?.data?.signature_path) {
            this.filePaths.set('signature', res.body.data.signature_path);
            this.signaturePreview = this.getFileUrl(
              res.body.data.signature_path
            );
            this.form
              .get('signature')
              ?.setValue(res.body.data.signature_path, { emitEvent: false });
          }
          // Handle potential updates to additional info file paths (if backend returns them)
          // You would need to parse res.body.data for additional file paths and update this.additionalFilePaths map

          // --- Post-Save Actions ---
          await this.alert.alert(
            false,
            'Screening details saved successfully!'
          ); // Success message

          // Optional: Re-fetch or re-patch data only if absolutely necessary.
          // Usually, updating the component state (like screenerAppMainId and filePaths) is sufficient.
          // Re-fetching might overwrite unsaved changes if not careful.
          // if (formValue.registration_no) {
          //   console.log("Reloading additional info after successful save...");
          //   this.loadAndPatchAdditionalInfo(formValue.registration_no).subscribe(() => {
          //      console.log("Additional info reloaded.");
          //      this.cdr.markForCheck(); // Ensure UI reflects reloaded data if needed
          //   });
          // } else {
          //   console.warn("Cannot reload additional info: registration number missing.");
          // }

          this.emitFormData(); // Emit the latest state again
          this.cdr.markForCheck(); // Trigger change detection
          resolve(); // Resolve the promise indicating success
        },
        error: (err) => {
          this.loader.hideLoader();
          // Extract a meaningful error message
          const errMsg =
            err?.error?.details ||
            err?.error?.message ||
            'Failed to save screening details. Please try again.';
          this.alert.alert(true, errMsg);
          console.error('❌ Error saving screening data:', err); // Log the full error
          // Reject with the error object from the backend if available
          reject(err.error || new Error('SAVE_FAILED'));
        },
      });
    });
  }
}
