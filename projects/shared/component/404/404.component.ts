import {Component} from '@angular/core';
import {AuthService} from '../../service/auth.service';
import {NgIf} from '@angular/common';

@Component({
  selector: 'app-404',
  templateUrl: './404.component.html',
  styleUrl: './404.component.scss',
  imports: [
    NgIf
  ],
  standalone: true
})
export class NotFoundComponent {
  user: any

  constructor(private auth: AuthService) {
    this.user = this.auth.currentUser
  }
}
