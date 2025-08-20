import {Component, OnInit} from '@angular/core';
import {AuthService} from 'shared';
import {PushNotificationService} from 'shared';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'IGKV';

  constructor(private push: PushNotificationService, private auth: AuthService) {
  }

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.push.requestSubscription();
    }
  }
}
