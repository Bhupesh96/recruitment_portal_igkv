import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import {environment} from 'environment';

if (environment.production) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};

  // Optional
  console.warn = () => {};
  console.error = () => {};
}

platformBrowserDynamic().bootstrapModule(AppModule, {
  ngZoneEventCoalescing: true,
})
  .catch(err => console.error(err));
