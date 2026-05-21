import {Component, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common'; // ✅ Required for ngSwitch

import { SidenavComponent } from '../sidenav/sidenav.component';
import { DawapattiHeaderComponent } from "../dawapatti-header/dawapatti-header.component";
import { FooterComponent } from "../../../footer/footer.component";
import {StepperComponent} from '../../stepper/stepper.component';
import {DawapattiComponent} from '../dawapatti/dawapatti.component';
import {ScorecardComponent} from '../scorecard/scorecard.component';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import {AuthService, HttpService} from 'shared';
import {environment} from 'environment';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
@Component({
  selector: 'app-dawapatti-home',
  standalone: true,
  templateUrl: './dawapatti-home.component.html',
  styleUrls: ['./dawapatti-home.component.scss'],
  imports: [
    CommonModule,
    SidenavComponent,
    DawapattiHeaderComponent,
    FooterComponent,
    // ✅ Add the page components to imports
    StepperComponent,
    ScorecardComponent,
    DawapattiComponent
  ],
})
export class DawapattiHomeComponent implements OnInit {
  ngOnInit() {
    this.loadAfterLoginMarquee();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {

        const url = this.router.url;

        if (url.includes('score-card')) {
          this.activeView = 'score-card';
        }
        else if (url.includes('dawapatti')) {
          this.activeView = 'dawapatti';
        }
        else {
          this.activeView = 'recruitment-form';
        }
      });
  }
  constructor(
    private router: Router,
    private http: HttpService,
    private sanitizer: DomSanitizer,
    private authService: AuthService
  ) {}
  // ✅This state tracks which component to show.
  // 'recruitment-form' is the default view on login.
  activeView: string = 'recruitment-form';
  marqueeItems: any[] = [];
  showMarqueeModal = false;
  loadAfterLoginMarquee() {

    const user = this.authService.currentUser;

    if (!user) return;

    const advId =
      user.a_rec_adv_main_id || user.advertisement_id;

    const sessionId =
      user.academic_session_id || user.session_id;

    const url =
      `/publicApi/get/getRecruitmentLinkManagementListPublic?list_adv_session_wise=true&a_rec_adv_main_id=${advId}&academic_session_id=${sessionId}`;

    this.http.getData(url, 'recruitement').subscribe({

      next: (res: any) => {

        this.marqueeItems = [];

        if (res?.body?.data) {

          const now = new Date();

          res.body.data.forEach((link: any) => {

            // AFTER LOGIN MARQUEE ONLY
            if (
              link.m_rec_link_type_id === 8 &&
              link.Live_YN === 'Y' &&
              link.visible_after_login === 'Y'
            ) {

              const startDate = new Date(
                link.startDate.replace(' ', 'T')
              );

              const endDate = new Date(
                link.endDate.replace(' ', 'T')
              );

              if (now >= startDate && now <= endDate) {

                this.marqueeItems.push({
                  title: link.linkname,
                  file_path: link.file_path,
                  target_url: link.TargetUrl
                });

              }

            }

          });

        }

      },

      error: (err) => {
        console.error('Failed to load marquee', err);
      }

    });

  }
  getFileUrl(fileName?: string): SafeUrl {

    if (!fileName) {
      return this.sanitizer.bypassSecurityTrustUrl('');
    }

    const normalized = fileName
      .replace(/^services[\\/]/, '')
      .replace(/\\/g, '/');

    const url =
      `${environment.recruitmentFileBaseUrl}/${normalized}`;

    return this.sanitizer.bypassSecurityTrustUrl(url);
  }
}
