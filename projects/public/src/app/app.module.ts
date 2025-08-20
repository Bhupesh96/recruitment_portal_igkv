import {NgModule, isDevMode} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {UserLoginComponent} from './user-login/user-login.component';
import {LoginLayoutComponent} from './login-layout/login-layout.component';
import {SharedModule} from 'shared';
import {CapslockDirective} from '../../../shared/directive/capslock.directive';
import { ForgotpasswordComponent } from './user-login/forgotpassword/forgotpassword.component';
import { ChangepasswordComponent } from './user-login/changepassword/changepassword.component';
import { PostselectionComponent } from './user-login/postselection/postselection.component';
import { ServiceWorkerModule } from '@angular/service-worker';

@NgModule({
  declarations: [
    AppComponent,
    UserLoginComponent,
    LoginLayoutComponent,
    ForgotpasswordComponent,
    ChangepasswordComponent,
    PostselectionComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NgbModule,
    SharedModule,
    CapslockDirective,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: true,
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [
    provideAnimationsAsync()
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
