import {NgModule} from '@angular/core';
import {CommonModule, DatePipe} from '@angular/common';
import {MatIconModule} from "@angular/material/icon";
import {ReactiveFormsModule} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {HTTP_INTERCEPTORS, HttpClientModule} from "@angular/common/http";
import {MatInputModule} from "@angular/material/input";
import {MatButtonModule} from "@angular/material/button";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatProgressBarModule} from "@angular/material/progress-bar";
import {MatCardModule} from "@angular/material/card";
import {MatSelectModule} from "@angular/material/select";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatTableModule} from "@angular/material/table";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatStepperModule} from "@angular/material/stepper";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MatNativeDateModule} from "@angular/material/core";
import {MatRadioModule} from "@angular/material/radio";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatDialogModule} from "@angular/material/dialog";
import {RouterLink} from "@angular/router";
import {NgSelectModule} from "@ng-select/ng-select";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTab, MatTabContent, MatTabGroup} from "@angular/material/tabs";
import {JWT_OPTIONS, JwtHelperService} from "@auth0/angular-jwt";
import {AuthService} from "./service/auth.service";
import {HttpService} from "./service/http.service";
import {AuthInterceptor} from "./service/auth.interceptor";
import {FileuploadComponent} from './component/fileupload/fileupload.component';
import {FilterPipe} from './directive/filter.directive';


@NgModule({
  declarations: [
    FileuploadComponent
  ],
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatIconModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
    MatButtonModule,
    MatToolbarModule,
    MatCardModule,
    MatTab,
    MatTabGroup,
    MatTabContent,
    MatSelectModule,
    FilterPipe
  ],
  exports: [
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    HttpClientModule,
    MatPaginatorModule,
    MatTableModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatFormFieldModule,
    MatStepperModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatRadioModule,
    MatTooltipModule,
    NgSelectModule,
    MatDialogModule,
    FileuploadComponent,
  ],
  providers: [
    DatePipe,
    FilterPipe,
    {provide: JWT_OPTIONS, useValue: {tokenGetter: () => localStorage.getItem('token')}}, // Provide JWT_OPTIONS
    AuthService, // Ensure AuthService is provided
    HttpService,  // Ensure HttpService is provided
    JwtHelperService, // Add JwtHelperService to providers
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
  ]
})
export class SharedModule {
}
