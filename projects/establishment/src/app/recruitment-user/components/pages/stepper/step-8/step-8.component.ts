import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpService } from 'shared'; // Assuming HttpService is in 'shared'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-step-8',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './step-8.component.html',
  styleUrls: ['./step-8.component.scss'],
})
export class Step8Component implements OnInit {
  @Output() formData = new EventEmitter<{ [key: string]: any }>();
  form: FormGroup;
  isSubmitted: boolean = false;
  declarationText: SafeHtml = ''; // Use SafeHtml to store sanitized HTML
  private a_rec_adv_main_id = 96;

  constructor(
    private fb: FormBuilder,
    private http: HttpService, // Inject HttpService
    private sanitizer: DomSanitizer // Inject DomSanitizer
  ) {
    this.form = this.fb.group({
      declaration: [false, Validators.requiredTrue],
    });
  }

  ngOnInit(): void {
    this.loadDeclaration(); // Call the method to load the declaration
    this.form.valueChanges.subscribe(() => {
      this.formData.emit({ ...this.form.value, _isValid: this.form.valid });
    });
  }

  loadDeclaration(): void {
    const apiUrl = `/master/get/getLatestAdvertisement?a_rec_adv_main_id=${this.a_rec_adv_main_id}`;
    this.http.getData(apiUrl, 'recruitement').subscribe({
      next: (response: any) => {
        const data = response?.body?.data?.[0];
        if (data && data.advertisement_declaration) {
          // Sanitize the HTML before setting it
          this.declarationText = this.sanitizer.bypassSecurityTrustHtml(
            data.advertisement_declaration
          );
        }
      },
      error: (err) => {
        // Fallback or error message for the user
        this.declarationText = this.sanitizer.bypassSecurityTrustHtml(
          'Failed to load declaration. Please try again later.'
        );
      },
    });
  }

  submit() {
    if (this.form.valid) {
      this.isSubmitted = true;
      this.form.disable();
      this.formData.emit({
        ...this.form.value,
        _isValid: this.form.valid,
        isSubmitted: this.isSubmitted,
      });
    }
  }
}
