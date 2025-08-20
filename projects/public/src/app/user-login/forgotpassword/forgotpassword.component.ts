import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {AlertService, AuthService, HttpService} from 'shared';
import {Router} from '@angular/router';
import {CookieService} from 'ngx-cookie-service';
import {environment} from 'environment';

@Component({
  selector: 'app-forgotpassword',
  standalone: false,

  templateUrl: './forgotpassword.component.html',
  styleUrl: './forgotpassword.component.scss'
})
export class ForgotpasswordComponent implements OnInit {
  basicForm!: FormGroup


  constructor(private auth: AuthService, private http: HttpService, private fb: FormBuilder,
              private router: Router, private alert: AlertService, private cookie: CookieService) {
  }

  loginForm!: FormGroup;
  @ViewChild('captchaContainer', {static: false}) dataContainer!: ElementRef;
  public generatedCaptcha: any = "";
  user: any;
  todayDate = new Date()

  ngOnInit(): void {
    this.createForm()
    this.getCaptcha()
  }

  createForm() {
    this.basicForm = this.fb.group({
      user_id: ['', Validators.required],
      otp: ['', Validators.required],
      captcha: ['', Validators.required]
    });
  }

  resendOtp() {

  }

  getCaptcha() {
    this.http.getData(`/getCaptcha`).subscribe((res: any) => {
      if (!res.body.error) {
        this.dataContainer.nativeElement.innerHTML = res.body.result.svg;
        this.generatedCaptcha = res.body.result.captcha;
      }
    });
  }
}
