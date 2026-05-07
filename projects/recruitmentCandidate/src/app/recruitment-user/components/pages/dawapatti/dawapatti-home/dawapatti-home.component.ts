import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // ✅ Required for ngSwitch

import { SidenavComponent } from '../sidenav/sidenav.component';
import { DawapattiHeaderComponent } from "../dawapatti-header/dawapatti-header.component";
import { FooterComponent } from "../../../footer/footer.component";
import {StepperComponent} from '../../stepper/stepper.component';
import {DawapattiComponent} from '../dawapatti/dawapatti.component';
import {ScorecardComponent} from '../scorecard/scorecard.component';
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
export class DawapattiHomeComponent {
  // ✅ This state tracks which component to show.
  // 'recruitment-form' is the default view on login.
  activeView: string = 'recruitment-form';
}
