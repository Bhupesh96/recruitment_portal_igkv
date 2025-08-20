import {Component, OnInit} from '@angular/core';
import Swal from 'sweetalert2';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {environment} from 'environment';
import {AlertService, AuthService, ErrorHandlerService, HttpService, passwordValidator} from 'shared';
import {Router} from '@angular/router';
import CryptoJS from 'crypto-js';

@Component({
  selector: 'app-changepassword',
  standalone: false,
  templateUrl: './changepassword.component.html',
  styleUrl: './changepassword.component.scss'
})
export class ChangepasswordComponent implements OnInit {
  psswordResetForm!: FormGroup;
  user: any;
  public passwordKey: any = environment.PASSWORD_SECRET_KEY;
  isCapsLockIsOn: boolean = false;
  showPassword: boolean = false;

  constructor(private auth: AuthService, private http: HttpService, private fb: FormBuilder,
              private router: Router, private alert: AlertService, private error: ErrorHandlerService) {
    this.user = this.auth.currentUser
  }

  todayDate = new Date()

  ngOnInit(): void {
    this.createForm()
  }

  createForm() {
    const config = {
      user_id: [this.user?.user_id],
      password: ['', [Validators.required, passwordValidator()]],
      cpassword: ['', Validators.required]
    };
    const extra: any = {
      validator: [this.error.MatchingValidator('password', 'cpassword')]
    };
    this.psswordResetForm = this.fb.group(config, extra);
  }

  control(field: string): any {
    return this.psswordResetForm.controls[field]
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  resetPassword() {
    // if (!this.psswordResetForm.invalid) {
    //   const password = CryptoJS.AES.encrypt(this.psswordResetForm.value.password, this.passwordKey);
    //   this.psswordResetForm.patchValue({password: `${password}`, cpassword: `${password}`});
    //   this.auth.resetPassword(this.psswordResetForm.value).subscribe((res: any) => {
    //     if (!res.body.error) {
    //       Swal.fire('पासवर्ड सफलतापूर्वक बदल दिया गया है, कृपया पुनः लॉगिन करें |', '', 'success').then(() => {
    //         this.auth.logout();
    //       })
    //     } else {
    //       Swal.fire('पासवर्ड बदलने में समस्या आ  रही है|', '', 'error').then(() => {
    //         this.error.resetControlValue(this.psswordResetForm, ['password', 'cpassword']);
    //         // this.auth.logout();
    //       })
    //     }
    //   })
    // } else {
    //
    // }
  }

  logout() {
    this.auth.logout()
  }
}
