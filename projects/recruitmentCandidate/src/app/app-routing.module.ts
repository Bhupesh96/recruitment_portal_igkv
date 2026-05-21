import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NotFoundComponent, UpdateRoutesComponent } from 'shared';
import { HomeComponent } from './recruitment-user/components/home/home.component';
import { SignupComponent } from './recruitment-user/components/pages/registration/signup/signup.component';
import { LoginComponent } from './recruitment-user/components/pages/registration/login/login.component';
import { StepperComponent } from './recruitment-user/components/pages/stepper/stepper.component';
import { PdfPreviewComponent } from './recruitment-user/components/pages/pdf-preview/pdf-preview.component';
import { PdfDownloadComponent } from './recruitment-user/components/pages/pdf-download/pdf-download.component';
import { DawapattiComponent } from './recruitment-user/components/pages/dawapatti/dawapatti/dawapatti.component';
import { DawapattiHomeComponent } from './recruitment-user/components/pages/dawapatti/dawapatti-home/dawapatti-home.component';
import { ScorecardComponent } from './recruitment-user/components/pages/dawapatti/scorecard/scorecard.component';
import {RecruitmentAuthGuard} from '../../../shared/service/recruitment-auth.guard';
import {RecruitmentFormGuard} from '../../../shared/service/recruitment-form.guard';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' }, // 👈 Default route

  // 🔓 PUBLIC ROUTES (No Guard)
  { path: 'home', component: HomeComponent },


  // 🔒 PROTECTED ROUTES (Requires Login)
  {
    path: 'pdf-preview',
    component: PdfPreviewComponent,
    canActivate: [RecruitmentAuthGuard] // 👈 Blocks access if not logged in
  },
  {
    path: 'pdf-download',
    component: PdfDownloadComponent,
    canActivate: [RecruitmentAuthGuard]
  },

  {
    path: 'recruitment',
    component: DawapattiHomeComponent, // The layout with Sidenav and <router-outlet>
    canActivate: [RecruitmentAuthGuard],
    canActivateChild: [RecruitmentAuthGuard],
    children: [
      // 🚨 REMOVE the redirectTo: 'recruitment-form'
      // Leave the path empty, but don't attach a component so the parent layout handles the logic
      { path: '', pathMatch: 'full', children: [] },

      {
        path: 'recruitment-form',
        component: StepperComponent,
        canActivate: [RecruitmentFormGuard] // This guard remains strictly for this URL
      },
      {
        path: 'score-card',
        component: ScorecardComponent,
      },
      {
        path: 'dawapatti',
        component: DawapattiComponent,
      },
    ],
  },

  { path: 'update', component: UpdateRoutesComponent },
  { path: '404', component: NotFoundComponent, title: 'Page Not Found' },
  { path: '**', redirectTo: '404', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
