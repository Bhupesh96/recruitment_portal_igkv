import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'app-recruitment-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './recruitment-form.component.html',
  styles: [],
})
export class RecruitmentFormComponent implements OnInit {
  recruitmentForm: FormGroup;
  photoPreview: string | null = null;
  signaturePreview: string | null = null;
  isSubmitting: boolean = false;
  currentDateTime: Date = new Date('2025-06-12T17:37:00+05:30'); // Current date/time: 05:37 PM IST on June 12, 2025

  // Basic English to Hindi transliteration mapping
  private transliterationMap: { [key: string]: string } = {
    a: 'ा',
    b: 'ब',
    c: 'क',
    d: 'द',
    e: 'े',
    f: 'फ',
    g: 'ग',
    h: 'ह',
    i: 'ि',
    j: 'ज',
    k: 'क',
    l: 'ल',
    m: 'म',
    n: 'न',
    o: 'ो',
    p: 'प',
    q: 'क',
    r: 'र',
    s: 'स',
    t: 'त',
    u: 'ु',
    v: 'व',
    w: 'व',
    x: 'क्ष',
    y: 'य',
    z: 'ज',
  };

  constructor(private fb: FormBuilder) {
    this.recruitmentForm = this.fb.group({
      // Applicant Name
      salutationEnglish: ['', Validators.required],
      nameEnglish: ['', Validators.required],
      middleName: [''],
      lastName: [''],
      salutationHindi: ['', Validators.required],
      nameHindi: ['', Validators.required],

      // Applicant Basic Detail
      advertisementNo: ['', Validators.required],
      post: ['', Validators.required],
      subject: [''],
      gender: ['', Validators.required],
      dateOfBirth: ['', Validators.required],
      age: [{ value: '', disabled: true }],
      fathersName: ['', Validators.required],
      mothersName: ['', Validators.required],
      religion: ['', Validators.required],

      // Permanent Address
      permAddress: ['', Validators.required],
      permCity: ['', Validators.required],
      permCountry: ['', Validators.required],
      permState: ['', Validators.required],
      permDistrict: ['', Validators.required],
      permPincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],

      // Present Address
      sameAsPermanent: [false],
      presentAddress: ['', Validators.required],
      presentCity: ['', Validators.required],
      presentCountry: ['', Validators.required],
      presentState: ['', Validators.required],
      presentDistrict: ['', Validators.required],
      presentPincode: [
        '',
        [Validators.required, Validators.pattern(/^\d{6}$/)],
      ],
      email: ['', [Validators.required, Validators.email]],
      mobileNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],

      // Photo & Signature
      photo: ['', Validators.required],
      signature: ['', Validators.required],
    });

    // Automatically calculate age based on date of birth
    this.recruitmentForm.get('dateOfBirth')?.valueChanges.subscribe((dob) => {
      if (dob) {
        const age = this.calculateAge(dob);
        this.recruitmentForm.get('age')?.setValue(age);
      }
    });

    // Handle "Same as Permanent Address" checkbox
    this.recruitmentForm
      .get('sameAsPermanent')
      ?.valueChanges.subscribe((checked) => {
        if (checked) {
          this.copyPermanentAddress();
        }
      });
  }

  ngOnInit(): void {}

  calculateAge(dob: string): string {
    const dobDate = new Date(dob);
    const referenceDate = new Date('2025-01-31'); // As per form: "Age as on 31-01-2025"
    let years = referenceDate.getFullYear() - dobDate.getFullYear();
    let months = referenceDate.getMonth() - dobDate.getMonth();
    let days = referenceDate.getDate() - dobDate.getDate();

    if (days < 0) {
      months--;
      days += new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth(),
        0
      ).getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years} Year${years !== 1 ? 's' : ''} ${months} Month${
      months !== 1 ? 's' : ''
    } and ${days} Day${days !== 1 ? 's' : ''}`;
  }

  copyPermanentAddress() {
    const permAddress = this.recruitmentForm.get('permAddress')?.value;
    const permCity = this.recruitmentForm.get('permCity')?.value;
    const permCountry = this.recruitmentForm.get('permCountry')?.value;
    const permState = this.recruitmentForm.get('permState')?.value;
    const permDistrict = this.recruitmentForm.get('permDistrict')?.value;
    const permPincode = this.recruitmentForm.get('permPincode')?.value;

    this.recruitmentForm.patchValue({
      presentAddress: permAddress,
      presentCity: permCity,
      presentCountry: permCountry,
      presentState: permState,
      presentDistrict: permDistrict,
      presentPincode: permPincode,
    });
  }

  transliterateToHindi(): void {
    const nameEnglish =
      this.recruitmentForm.get('nameEnglish')?.value?.toLowerCase() || '';
    let hindiName = '';

    for (let char of nameEnglish) {
      hindiName += this.transliterationMap[char] || char;
    }

    this.recruitmentForm.get('nameHindi')?.setValue(hindiName);
  }

  onFileChange(event: Event, field: string) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.handleFile(file, field, input);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent, field: string) {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      const input = (
        field === 'photo'
          ? document.getElementById('photo-input')
          : document.getElementById('signature-input')
      ) as HTMLInputElement;
      this.handleFile(file, field, input);
    }
  }

  handleFile(file: File, field: string, input: HTMLInputElement) {
    const reader = new FileReader();

    // Validate file size
    const maxSize = field === 'photo' ? 50 * 1024 : 30 * 1024; // 50KB for photo, 30KB for signature
    const minSize = field === 'photo' ? 30 * 1024 : 20 * 1024; // 30KB for photo, 20KB for signature
    if (file.size > maxSize || file.size < minSize) {
      alert(
        `File size must be between ${minSize / 1024}KB and ${maxSize / 1024}KB`
      );
      input.value = '';
      return;
    }

    reader.onload = () => {
      if (field === 'photo') {
        this.photoPreview = reader.result as string;
      } else if (field === 'signature') {
        this.signaturePreview = reader.result as string;
      }
      this.recruitmentForm.get(field)?.setValue(file.name);
    };
    reader.readAsDataURL(file);
  }

  uploadFile(field: string) {
    // Placeholder for file upload logic (e.g., API call to upload the file)
    console.log(`Uploading ${field}...`);
  }

  removeFile(field: string, input: HTMLInputElement) {
    if (field === 'photo') {
      this.photoPreview = null;
    } else if (field === 'signature') {
      this.signaturePreview = null;
    }
    this.recruitmentForm.get(field)?.setValue('');
    input.value = '';
  }

  onSubmit() {
    if (this.recruitmentForm.valid) {
      this.isSubmitting = true;
      // Simulate an API call with a 2-second delay
      setTimeout(() => {
        console.log('Form Submitted:', this.recruitmentForm.value);
        this.isSubmitting = false;
        // Add navigation logic here (e.g., redirect to the next step)
      }, 2000);
    } else {
      console.log('Form is invalid');
      this.recruitmentForm.markAllAsTouched();
    }
  }

  onBack() {
    console.log('Back button clicked');
    // Add navigation logic here (e.g., redirect to the previous step)
  }
}
