import { Injectable } from '@angular/core';

export interface LoginFormState {
  captcha: string;
  captchaSvg: string;
  values: {
    user_id: string;
    password: string;
    captcha: string;
  };
}

@Injectable({ providedIn: 'root' })
export class LoginFormStateService {
  private state: LoginFormState | null = null;

  get(): LoginFormState | null {
    return this.state;
  }

  set(state: LoginFormState): void {
    this.state = state;
  }

  clear(): void {
    this.state = null;
  }
}
