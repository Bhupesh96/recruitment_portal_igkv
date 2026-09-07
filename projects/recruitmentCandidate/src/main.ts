import {platformBrowser} from '@angular/platform-browser';
import {apiPort} from 'environment';
import {AppModule} from './app/app.module';

async function handleTokenFromUrl() {
  const url = new URL(window.location.href);
  const uuid = url.searchParams.get('jti');
  if (!uuid) return;
  try {
    const response = await fetch(`${apiPort.commonApi}/security/getAccessToken/`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({jti: uuid}),
    });
    const res = await response.json();
    if (!res?.error) {
      localStorage.setItem('n_access_token', res.data.accessToken);
      localStorage.setItem('n_refresh_token', res.data.refreshToken);
      localStorage.setItem('n_user_token', res.data.user_data);
      url.searchParams.delete('jti');
      window.history.replaceState({}, '', url.toString());
    }
  } catch (e) {
    console.error('Token fetch error:', e);
  }
}

async function bootstrap() {
  try {
    await handleTokenFromUrl();
    await platformBrowser().bootstrapModule(AppModule);
  } catch (err) {
    console.error('Bootstrap error:', err);
  }
}

bootstrap().then();
