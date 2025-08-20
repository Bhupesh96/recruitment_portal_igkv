// kt-scroll.service.ts
import { Injectable } from '@angular/core';

declare let KTScroll: any; // Declare KTScroll as an external variable

@Injectable({
  providedIn: 'root'
})
export class KTScrollService {

  private timer: any;

  constructor() { }

  public init() {
    KTScroll.init();
    window.addEventListener('resize', this.resizeHandler.bind(this));
  }

  private resizeHandler() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const body = document.getElementsByTagName("BODY")[0];
      const elements = body.querySelectorAll('[data-kt-scroll="true"]');

      if (elements && elements.length > 0) {
        for (let i = 0, len = elements.length; i < len; i++) {
          const scroll = KTScroll.getInstance(elements[i]);
          if (scroll) {
            scroll.update();
          }
        }
      }
    }, 200); // Throttle with 200ms delay
  }
}
