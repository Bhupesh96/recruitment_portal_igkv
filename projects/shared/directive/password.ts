import {AbstractControl, ValidatorFn} from '@angular/forms';

export function passwordValidator(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    const password = control.value || '';
    const minLength = 8;
    const maxLength = 16;
    const allowedSymbols = /[!@#$%^&*_.]/;
    const errors: any = {};
    if (password.length <= minLength || password.length >= maxLength) {
      errors['length'] = true;
    }
    if (!/\d/.test(password)) {
      errors['number'] = true;
    }
    if (!allowedSymbols.test(password)) {
      errors['symbol'] = true;
    }
    if (!/[A-Z]/.test(password)) {
      errors['upper'] = true;
    }
    if (!/[a-z]/.test(password)) {
      errors['lower'] = true;
    }
    return Object.keys(errors).length ? errors : null;
  };
}
