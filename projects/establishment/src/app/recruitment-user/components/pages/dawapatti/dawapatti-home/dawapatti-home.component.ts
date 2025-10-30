import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SidenavComponent } from '../sidenav/sidenav.component';
import { DawapattiHeaderComponent } from "../dawapatti-header/dawapatti-header.component";
import { FooterComponent } from "../../../footer/footer.component";

@Component({
  selector: 'app-dawapatti-home',
  standalone: true,
  templateUrl: './dawapatti-home.component.html',
  styleUrls: ['./dawapatti-home.component.scss'],
  imports: [
    SidenavComponent,
    RouterOutlet,
    DawapattiHeaderComponent,
    FooterComponent
],
})
export class DawapattiHomeComponent {}
