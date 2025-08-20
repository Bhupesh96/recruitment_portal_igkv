import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {UserLoginComponent} from './user-login/user-login.component';
import {LoginLayoutComponent} from './login-layout/login-layout.component';
import {ForgotpasswordComponent} from './user-login/forgotpassword/forgotpassword.component';
import {ChangepasswordComponent} from './user-login/changepassword/changepassword.component';
import {PostselectionComponent} from './user-login/postselection/postselection.component';
import {LayoutComponent, NotFoundComponent} from 'shared';

const routes: Routes = [
  {
    path: 'user',
    component: LoginLayoutComponent,
    children: [
      {
        path: 'login',
        component: UserLoginComponent,
        title: 'IGKV | USER LOGIN'
      },
      {
        path: 'forgot',
        component: ForgotpasswordComponent,
        title: 'IGKV | Forgot Password'
      },
      {
        path: 'pswrd',
        component: ChangepasswordComponent,
        title: 'IGKV | Change Password'
      },
      {
        path: 'post',
        component: PostselectionComponent,
        title: 'IGKV | Post selection'
      }
    ]
  },
  {
    path: 'common',
    component: LayoutComponent
  },
  {
    path: '',
    redirectTo: '/user/login',
    pathMatch: 'full',
  },
  {
    path: '404',
    component: NotFoundComponent,
    title: 'Page Not Found',
  },
  {
    path: '**',
    redirectTo: '404',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
