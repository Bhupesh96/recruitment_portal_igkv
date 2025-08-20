import {Injectable} from '@angular/core';
import {Subject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  isLoading = new Subject<boolean>();
  dotLoading = new Subject<boolean>();

  constructor() {
    // console.log('loader services')
  }

  show() {
    this.isLoading.next(true);
  }

  hide() {
    this.isLoading.next(false);
  }

  showLoader() {
    this.dotLoading.next(true);
  }

  hideLoader() {
    this.dotLoading.next(false);
  }
}
