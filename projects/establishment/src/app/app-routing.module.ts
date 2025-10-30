import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NotFoundComponent, UpdateRoutesComponent } from 'shared';
import { HomeComponent } from './recruitment-user/components/home/home.component';
import { SignupComponent } from './recruitment-user/components/pages/registration/signup/signup.component';
import { LoginComponent } from './recruitment-user/components/pages/registration/login/login.component';
import { StepperComponent } from './recruitment-user/components/pages/stepper/stepper.component';
import { PdfPreviewComponent } from './recruitment-user/components/pages/pdf-preview/pdf-preview.component';
import { PdfDownloadComponent } from './recruitment-user/components/pages/pdf-download/pdf-download.component';
import { ScreeningComponent } from './recruitment-user/components/pages/screening/screening/screening.component';
import { DawapattiComponent } from './recruitment-user/components/pages/dawapatti/dawapatti/dawapatti.component';
import { DawapattiHomeComponent } from './recruitment-user/components/pages/dawapatti/dawapatti-home/dawapatti-home.component';
import { ScorecardComponent } from './recruitment-user/components/pages/dawapatti/scorecard/scorecard.component';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' }, // 👈 Default route

  { path: 'home', component: HomeComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'login', component: LoginComponent },
  { path: 'stepper', component: StepperComponent },
  { path: 'pdf-preview', component: PdfPreviewComponent },
  { path: 'pdf-download', component: PdfDownloadComponent },
  { path: 'screening', component: ScreeningComponent },

  // ✅ Dawapatti layout with nested routes
  {
    path: 'dawapatti-home',
    component: DawapattiHomeComponent,
    children: [
      { path: '', redirectTo: 'dawapatti', pathMatch: 'full' },
      { path: 'dawapatti', component: DawapattiComponent },
      { path: 'score-card', component: ScorecardComponent },
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
