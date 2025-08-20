import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.scss'],
})
export class FormComponent implements OnInit {
  registrationForm: FormGroup;
  degreeProgrammeTypes: any[] = [];
  degreeProgrammes: any[] = [];
  subjects: string[] = [];
  salutations: any[] = [];
  genders: any[] = [];
  categories: any[] = [];
  nationalities = ['Indian', 'Other'];
  states = ['Select', 'Chhattisgarh', 'Madhya Pradesh', 'Other'];
  examCentres: string[] = [];
  examStatus = ['Passed', 'Appearing'];
  employmentStatus = [
    'Fresher',
    'IGKV inservice',
    'C.G Ag.Dept In-service',
    'Other SAU inservice',
    'Sponsor Candidate',
  ];
  years: string[] = [];
  photoPreview: string | null = null;
  signaturePreview: string | null = null;
  photoFile: File | null = null;
  signatureFile: File | null = null;
  appearingCertificateFile: File | null = null;

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.registrationForm = this.fb.group({
      registrationNo: [
        '202503471',
        [Validators.required, Validators.pattern(/^\d+$/)],
      ],
      degreeProgrammeType: ['', Validators.required],
      applyingForDegree: ['', Validators.required],
      subject: ['', Validators.required],
      salutation: ['', Validators.required],
      firstName: ['', Validators.required],
      middleName: [''],
      lastName: [''],
      fathersName: ['', Validators.required],
      mothersName: ['', Validators.required],
      guardiansName: [''],
      dateOfBirth: ['', Validators.required],
      gender: ['', Validators.required],
      category: ['', Validators.required],
      nationality: ['', Validators.required],
      cgDomicile: [false],
      debarred: [false],
      studiedPGFromIGKV: [''],
      pursuingPhDFromIGKV: [false],
      photo: ['', Validators.required],
      signature: ['', Validators.required],
      corrAddressLine1: ['', Validators.required],
      corrAddressLine2: [''],
      corrDistrict: ['', Validators.required],
      corrState: ['', Validators.required],
      corrPinCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      sameAsCorrespondence: [false],
      permAddressLine1: ['', Validators.required],
      permAddressLine2: [''],
      permDistrict: ['', Validators.required],
      permState: ['', Validators.required],
      permPinCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      mobileNo: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      examCentre1: [''],
      examCentre2: [''],
      examCentre3: [''],
      examCentre4: [''],
      examCentre5: [''],
      examCentre6: [''],
      examCentre7: [''],
      examCentre8: [''],
      examCentre9: [''],
      examCentre10: [''],
      examCentre11: [''],
      examCentre12: [''],
      pgExamStatus: [''],
      appearingCertificate: [''],
      hscDetails: this.fb.group({
        board: [''],
        rollNo: [''],
        year: [''],
        obtainedMarks: [''],
        maxMarks: [''],
        percentage: [''],
        degreeProgramme: [''],
        subject: [''],
      }),
      hsscDetails: this.fb.group({
        board: [''],
        rollNo: [''],
        year: [''],
        obtainedMarks: [''],
        maxMarks: [''],
        percentage: [''],
        degreeProgramme: [''],
        subject: [''],
      }),
      bachelorDetails: this.fb.group({
        board: [''],
        rollNo: [''],
        year: [''],
        obtainedMarks: [''],
        maxMarks: [''],
        percentage: [''],
        degreeProgramme: [''],
        subject: [''],
      }),
      employmentStatus: [''],
      declaration: [false, Validators.requiredTrue],
    });
  }

  ngOnInit(): void {
    this.getDegreeProgrammeTypes().subscribe({
      next: (data) => {
        this.degreeProgrammeTypes = data;
      },
      error: (err) => {
        console.error('Failed to fetch degree programme types:', err);
      },
    });
    this.getSubjects().subscribe({
      next: (data) => {
        this.subjects = data.map((item: any) => item.Subject_Name_E);
      },
      error: (err) => {
        console.error('Failed to fetch subjects:', err);
        this.subjects = [];
      },
    });
    this.getSalutation().subscribe({
      next: (data) => {
        this.salutations = data.map((item: any) => item.Salutation_Name_E);
      },
      error: (err) => {
        console.error('Failed to fetch salutation:', err);
        this.salutations = [];
      },
    });
    this.getGender().subscribe({
      next: (data) => {
        this.genders = data.map((item: any) => item.gender_name);
      },
      error: (err) => {
        console.error('Failed to fetch genders:', err);
        this.genders = [];
      },
    });
    this.getCategory().subscribe({
      next: (data) => {
        this.categories = data.map((item: any) => item.Category_Name);
      },
      error: (err) => {
        console.error('Failed to fetch categories:', err);
        this.categories = [];
      },
    });
    this.getExamCentres().subscribe({
      next: (data) => {
        this.examCentres = data.map((item: any) => item.College_Name_E);
      },
      error: (err) => {
        console.error('Failed to fetch exam centres:', err);
        this.examCentres = [];
      },
    });
    this.getYears().subscribe({
      next: (data) => {
        this.years = data.map((item: any) => item.End_Session_Name);
      },
      error: (err) => {
        console.error('Failed to fetch years:', err);
        this.years = [];
      },
    });
    this.registrationForm
      .get('degreeProgrammeType')
      ?.valueChanges.subscribe((typeId) => {
        if (typeId) {
          this.getDegreeProgrammes(typeId).subscribe({
            next: (data) => {
              this.degreeProgrammes = data;
              this.registrationForm.get('applyingForDegree')?.reset();
            },
            error: (err) => {
              console.error('Failed to fetch degree programmes:', err);
              this.degreeProgrammes = [];
            },
          });
        } else {
          this.degreeProgrammes = [];
          this.registrationForm.get('applyingForDegree')?.reset();
        }
      });
  }

  getDegreeProgrammeTypes(): Observable<any> {
    return this.http.get('http://localhost:3000/degree-programme-types');
  }

  getDegreeProgrammes(typeId: string): Observable<any> {
    return this.http.get(`http://localhost:3000/degree-programmes/${typeId}`);
  }

  getSubjects(): Observable<any> {
    return this.http.get('http://localhost:3000/subject');
  }

  getSalutation(): Observable<any> {
    return this.http.get('http://localhost:3000/salutation');
  }

  getGender(): Observable<any> {
    return this.http.get('http://localhost:3000/gender');
  }

  getCategory(): Observable<any> {
    return this.http.get('http://localhost:3000/category');
  }

  getExamCentres(): Observable<any> {
    return this.http.get('http://localhost:3000/exam-centers');
  }

  getYears(): Observable<any> {
    return this.http.get('http://localhost:3000/session');
  }

  onFileChange(event: Event, type: string): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = () => {
        if (type === 'photo') {
          this.photoFile = file;
          this.photoPreview = reader.result as string;
          this.registrationForm.get('photo')?.setValue(file.name);
        } else if (type === 'signature') {
          this.signatureFile = file;
          this.signaturePreview = reader.result as string;
          this.registrationForm.get('signature')?.setValue(file.name);
        } else if (type === 'appearingCertificate') {
          this.appearingCertificateFile = file;
          this.registrationForm
            .get('appearingCertificate')
            ?.setValue(file.name);
        }
      };

      if (type === 'photo' || type === 'signature') {
        reader.readAsDataURL(file);
      } else {
        this.registrationForm.get('appearingCertificate')?.setValue(file.name);
      }
    }
  }

  uploadFile(type: string): void {
    let file: File | null = null;
    if (type === 'photo' && this.photoFile) {
      file = this.photoFile;
    } else if (type === 'signature' && this.signatureFile) {
      file = this.signatureFile;
    } else if (
      type === 'appearingCertificate' &&
      this.appearingCertificateFile
    ) {
      file = this.appearingCertificateFile;
    }

    if (file) {
      console.log(`Uploading ${type}:`, file);
    } else {
      console.warn(`No file selected for ${type}`);
    }
  }

  removeFile(type: string, input: HTMLInputElement): void {
    if (type === 'photo') {
      this.photoPreview = null;
      this.photoFile = null;
      this.registrationForm.get('photo')?.setValue('');
    } else if (type === 'signature') {
      this.signaturePreview = null;
      this.signatureFile = null;
      this.registrationForm.get('signature')?.setValue('');
    } else if (type === 'appearingCertificate') {
      this.appearingCertificateFile = null;
      this.registrationForm.get('appearingCertificate')?.setValue('');
    }
    input.value = '';
  }

  copyCorrespondenceAddress(): void {
    if (this.registrationForm.get('sameAsCorrespondence')?.value) {
      const corr = this.registrationForm.value;
      this.registrationForm.patchValue({
        permAddressLine1: corr.corrAddressLine1,
        permAddressLine2: corr.corrAddressLine2,
        permDistrict: corr.corrDistrict,
        permState: corr.corrState,
        permPinCode: corr.corrPinCode,
      });
    }
  }

  onSubmit(): void {
    if (this.registrationForm.valid) {
      console.log('Form Submitted:', this.registrationForm.value);
      const formData = new FormData();
      formData.append('formData', JSON.stringify(this.registrationForm.value));
      if (this.photoFile) formData.append('photo', this.photoFile);
      if (this.signatureFile) formData.append('signature', this.signatureFile);
      if (this.appearingCertificateFile)
        formData.append('appearingCertificate', this.appearingCertificateFile);
      // Implement API call to submit formData
    } else {
      console.log('Form is invalid:', this.registrationForm.errors);
    }
  }
}
