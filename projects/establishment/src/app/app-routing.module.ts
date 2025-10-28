import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {
  AuthGuard,
  LayoutComponent,
  NotFoundComponent,
  UpdateRoutesComponent,
} from 'shared';
import { HomeComponent } from './recruitment-user/components/home/home.component';
import { SignupComponent } from './recruitment-user/components/pages/registration/signup/signup.component';
import { LoginComponent } from './recruitment-user/components/pages/registration/login/login.component';
import { StepperComponent } from './recruitment-user/components/pages/stepper/stepper.component';
import { PdfPreviewComponent } from './recruitment-user/components/pages/pdf-preview/pdf-preview.component';
import { PdfDownloadComponent } from './recruitment-user/components/pages/pdf-download/pdf-download.component';
import { ScreeningComponent } from './recruitment-user/components/pages/screening/screening/screening.component';
import { ScoringComponent } from './recruitment-user/components/pages/scoring/scoring/scoring.component';
import { DawapattiComponent } from './recruitment-user/components/pages/dawapatti/dawapatti.component';

const routes: Routes = [
  {
    path: '',
    // component: LayoutComponent,
    children: [
      {
        path: '404',
        component: NotFoundComponent,
        title: 'Page Not Found',
      },
      { path: 'signup', component: SignupComponent },
      { path: 'login', component: LoginComponent },
      { path: 'home', component: HomeComponent },
      { path: 'stepper', component: StepperComponent },
      { path: 'pdf-preview', component: PdfPreviewComponent },
      { path: 'pdf-download', component: PdfDownloadComponent },
      { path: 'screening', component: ScreeningComponent },
      // { path: 'scoring', component: ScoringComponent },
      { path: 'dawapatti', component: DawapattiComponent },
      { path: '**', redirectTo: 'home' },
    ],
  },
  {
    path: 'update',
    component: UpdateRoutesComponent,
  },

  {
    path: '**',
    redirectTo: '404',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
