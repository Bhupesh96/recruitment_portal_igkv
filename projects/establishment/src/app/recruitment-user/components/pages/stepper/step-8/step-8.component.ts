import {
  Component,
  OnInit,
  Output,
  EventEmitter,
  OnDestroy,
} from '@angular/core'; // <-- Add OnDestroy
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpService, AlertService, LoaderService, SharedModule } from 'shared';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SharedDataService } from '../../shared-data.service';
import { Subject } from 'rxjs'; // ✅ 2. IMPORT RXJS UTILS
import { takeUntil } from 'rxjs/operators';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-step-8',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    SharedModule,
  ],
  templateUrl: './step-8.component.html',
  styleUrls: ['./step-8.component.scss'],
})
export class Step8Component implements OnInit, OnDestroy {
  // <-- Implement OnDestroy
  @Output() formData = new EventEmitter<{ [key: string]: any }>();
  @Output() finalSubmitSuccess = new EventEmitter<void>(); // ❌ 3. REMOVE THE @Input() // @Input() registrationNo: number | string | null = null;
  // ✅ 4. ADD THESE PROPERTIES
  private registrationNo: number | string | null = null;
  private destroy$ = new Subject<void>();

  form: FormGroup;
  isSubmitted: boolean = false;
  declarationText: SafeHtml = '';
  private a_rec_adv_main_id = 96;

  constructor(
    private fb: FormBuilder,
    private http: HttpService,
    private sanitizer: DomSanitizer,
    private alert: AlertService,
    private loader: LoaderService,
    private sharedDataService: SharedDataService // ✅ 5. INJECT THE SERVICE
  ) {
    this.form = this.fb.group({
      declaration: [false, Validators.requiredTrue],
    });
  }

  ngOnInit(): void {
    // ✅ 6. SUBSCRIBE TO THE SHARED DATA TO GET THE REGISTRATION NUMBER
    this.sharedDataService.formData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        if (data && data[1] && data[1].registration_no) {
          this.registrationNo = data[1].registration_no;
          console.log(
            `✅ Registration number captured in Step 8: ${this.registrationNo}`
          );
        }
      });

    this.loadDeclaration();
    this.form.valueChanges.subscribe(() => {
      this.formData.emit({ ...this.form.value, _isValid: this.form.valid });
    });
  }

  // ✅ 7. ADD OnDestroy TO PREVENT MEMORY LEAKS
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDeclaration(): void {
    // This function remains the same
    const apiUrl = `/master/get/getLatestAdvertisement?a_rec_adv_main_id=${this.a_rec_adv_main_id}`;
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
  submit(): void {
    console.log('Submit method in step 8 called');
    if (this.form.invalid) {
      this.alert.alert(true, 'You must accept the declaration to proceed.');
      return;
    }
    if (!this.registrationNo) {
      this.alert.alert(true, 'Cannot submit. Registration number is missing.');
      return;
    }

    this.loader.show();
    this.isSubmitted = true;
    this.form.disable();

    const payload = {
      registration_no: this.registrationNo,
    }; // The API endpoint was slightly off, it should match your backend route

    this.http
      .postForm(
        '/candidate/postFile/updateFinalDeclaration', // Corrected endpoint
        payload,
        'recruitement'
      )
      .subscribe({
        next: (res: any) => {
          console.log('API call successful:', res);
          this.loader.hide();
          if (res?.body?.error) {
            this.alert.alert(
              true,
              res.body.error.message || 'An unknown error occurred.'
            );
            this.isSubmitted = false; // Allow retry
            this.form.enable();
          } else {
            this.alert.alert(false, 'Application Submitted Successfully!');
            this.finalSubmitSuccess.emit(); // Notify parent component
          }
        },
        error: (err) => {
          console.error('API call failed:', err);
          this.loader.hide();
          this.alert.alert(true, 'A server error occurred. Please try again.');
          this.isSubmitted = false; // Allow retry
          this.form.enable();
        },
      });
  }
}
