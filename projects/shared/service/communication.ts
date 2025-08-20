import {Injectable} from "@angular/core";
import {SwPush} from "@angular/service-worker";
import {HttpService} from 'shared';
import {environment} from 'environment';

@Injectable({providedIn: 'root'})
export class PushNotificationService {
  constructor(private http: HttpService, private _swPush: SwPush) {
  }

  requestSubscription = () => {
    if (!this._swPush.isEnabled) {
      console.warn("Notification is not enabled.");
      return;
    }
    this._swPush.requestSubscription({
      serverPublicKey: environment.publicKey
    }).then((subscription) => {
      this.sendSubscriptionToTheServer(subscription)
    }).catch((_) => console.log);
  };

  sendSubscriptionToTheServer(subscription: PushSubscription) {
    this.http.postData("/web/post/subscribe", subscription, 'admin').subscribe(res => {
      console.log(res)
    })
  }
}
