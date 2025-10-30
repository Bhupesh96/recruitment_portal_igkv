import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'shared';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { AppComponent } from './app.component';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { PdfDownloadComponent } from './recruitment-user/components/pages/pdf-download/pdf-download.component';
import { DotLoaderComponent } from '../../../shared/component/dot-loader/dot-loader.component';
import { HeaderComponent } from './recruitment-user/components/header/header.component';
import { DawapattiComponent } from './recruitment-user/components/pages/dawapatti/dawapatti/dawapatti.component';
import { ScorecardComponent } from './recruitment-user/components/pages/dawapatti/scorecard/scorecard.component';



@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    PdfDownloadComponent,
    BrowserAnimationsModule,
    AppRoutingModule,
    NgSelectModule,
    NgbNavModule,
    CommonModule,
    SharedModule,
    NgbModule,
    DotLoaderComponent,
    HeaderComponent,
    DawapattiComponent,
    ScorecardComponent
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
