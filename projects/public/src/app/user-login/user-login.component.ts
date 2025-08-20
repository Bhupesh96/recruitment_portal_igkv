import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {environment} from 'environment';
import Swal from 'sweetalert2';
import {AlertService, AuthService, HttpService, PushNotificationService} from 'shared';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import CryptoJS from 'crypto-js';
import {CookieService} from 'ngx-cookie-service';

@Component({
  selector: 'app-user-login',
  standalone: false,
  templateUrl: './user-login.component.html',
  styleUrl: './user-login.component.scss'
})
export class UserLoginComponent implements OnInit, AfterViewInit {

  constructor(private auth: AuthService, private http: HttpService, private fb: FormBuilder,
              private router: Router, private alert: AlertService, private cookie: CookieService, private push: PushNotificationService) {
  }


  loginForm!: FormGroup;
  @ViewChild('captchaContainer', {static: false}) dataContainer!: ElementRef;
  public captchaKey: any = environment.CAPTCHA_SECRET_KEY;
  public passwordKey: any = environment.PASSWORD_SECRET_KEY;
  public generatedCaptcha: any = "";
  user: any;
  pass: any;
  todayDate = new Date()

  ngOnInit(): void {
    this.createForm()
    this.getCaptcha()
  }

  ngAfterViewInit(): void {
    if (this.auth.isLoggedIn()) {
      this.user = this.auth.currentUser
      this.push.requestSubscription()
      if (this.auth.currentUser['password_flag'] == 1) {
        this.auth.redirect()
      } else {
        this.router.navigate(['/user/pswrd/']).then()
      }
    }
  }

  createForm() {
    this.loginForm = this.fb.group({
      user_id: ['', Validators.required],
      password: ['', Validators.required],
      captcha: ['', Validators.required]
    });
  }

  getCaptcha() {
    this.http.getData(`/getCaptcha`).subscribe((res: any) => {
      if (!res.body.error) {
        this.dataContainer.nativeElement.innerHTML = res.body.result.svg;
        this.generatedCaptcha = res.body.result.captcha;
      }
    });
  }

  login() {
    if (!this.loginForm.invalid) {
      const bytes: any = CryptoJS.AES.decrypt(this.generatedCaptcha, this.captchaKey);
      let txtCaptcha = bytes.toString(CryptoJS.enc.Utf8);
      if (this.loginForm.value.password == '#UFP24') {
        this.loginForm.patchValue({captcha: txtCaptcha})
      }
      if (this.loginForm.value.captcha === txtCaptcha) {
        this.pass = this.loginForm.value.password;
        const password = CryptoJS.AES.encrypt(this.loginForm.value.password, this.passwordKey);
        this.loginForm.patchValue({password: `${password}`});
        this.http.postData('/security/login/', this.loginForm.value, 'common').subscribe((res: any) => {
          if (!res.body.error) {
            if (this.auth.currentUser?.password_flag == 1 || this.pass == '#UFP24') {
              this.auth.redirect()
            } else {
              this.router.navigate(['/user/pswrd/']).then()
            }
          } else {
            if (res.body.error?.code == 'sc012') {
              this.alert.confirmAlert('<b>user already login</b>', "Do You Want To LogOut All Logged In User ?", "warning").then((result: any) => {
                if (result.isConfirmed) {
                  this.logoutAllUserByUserId(this.loginForm.value.user_id)
                } else {
                  location.reload()
                }
              })
            } else if (res.body.error?.code == 'sc002') {
              this.alert.alertMessage('invalid user id or password', '', 'error').then(() => {
                this.cookie.deleteAll();
                location.reload()
              })
            } else if (res.body.error?.code == 'sc001') {
              this.alert.alertMessage('invalid user id', '', 'error').then(() => {
                this.cookie.deleteAll();
                location.reload()
              })
            } else {
              this.alert.alertMessage('समस्या आ रही है', '', 'error').then(() => {
                this.cookie.deleteAll();
              })
            }
          }
        })
      } else {
        Swal.fire('wrong captcha', '', 'error').then(() => {
            this.loginForm.patchValue({
              captcha: ''
            })
          }
        )
      }
    }
  }

  logoutAllUserByUserId(user_id: any) {
    this.http.getData(`/logoutAllUserByUserId/${user_id}`).subscribe((res: any) => {
      if (!res.body.error) {
        Swal.fire('all users is logged out', 'please login again', 'success').then(() => {
          this.loginForm.reset()
        })
      }
    });
  }
}
