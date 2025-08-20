import {Injectable} from '@angular/core';
import {FormGroup, AbstractControl, ValidatorFn} from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {

  getErrorMessage(control: AbstractControl, field: string, select: boolean): string {
    if (control.invalid && (control.dirty || control.touched)) {
      switch (true) {
        case control.hasError('required'):
          return select ? `Please select ${field}` : `${field} is required.`;
        case control.hasError('pattern'):
          return `${field} format is invalid.`;
        case control.hasError('minlength'):
          const requiredMinLength = control.getError('minlength').requiredLength;
          return `${field} must be at least ${requiredMinLength} characters.`;
        case control.hasError('maxlength'):
          const requiredMaxLength = control.getError('maxlength').requiredLength;
          return `${field} must be at most ${requiredMaxLength} characters.`;
        case control.hasError('email'):
          return `Please enter a valid email address.`;
        case control.hasError('min'):
          const min = control.getError('min').min;
          return `${field} must be greater than or equal to ${min}.`;
        case control.hasError('max'):
          const max = control.getError('max').max;
          return `${field} must be less than or equal to ${max}.`;
        case control.hasError('invalidAadhar'):
          return `${field} is invalid.`;
        case control.hasError('mismatch'):
          return `${field} does not match.`;
        case control.hasError('invalidPhone'):
          return `Please enter a valid phone number.`;
        case control.hasError('invalidPAN'):
          return `Please enter a valid PAN number.`;
        case control.hasError('invalidIFSC'):
          return `Please enter a valid IFSC code.`;
        case control.hasError('invalidGST'):
          return `Please enter a valid GST number.`;
        default:
          return `Invalid ${field}.`;
      }
    } else {
      return ''
    }
  }

  MatchingValidator(controlName: string, matchingControlName: string): any {
    return (formGroup: FormGroup) => {
      const control = formGroup.controls[controlName];
      const matchingControl: any = formGroup.controls[matchingControlName];
      if (matchingControl.errors && !matchingControl.errors.confirmedValidator) return;
      if (control.value !== matchingControl.value) {
        matchingControl.setErrors({confirmedValidator: true});
      } else {
        matchingControl.setErrors(null);
      }
    };
  }

  addValidators(form: FormGroup, fieldName: string, validators: ValidatorFn | ValidatorFn[]): void {
    const control = form.get(fieldName);
    if (control) {
      control.setValidators(validators);
      control.updateValueAndValidity();
    } else {
      console.error(`Control with name ${fieldName} not found in the form group.`);
    }
  }

  // Method to remove validators from a form control
  removeValidators(form: FormGroup, fieldName: string): void {
    const control = form.get(fieldName);
    if (control) {
      control.clearValidators();
      control.updateValueAndValidity();
    } else {
      console.error(`Control with name ${fieldName} not found in the form group.`);
    }
  }

  // Method to reset a form control's value
  resetControlValue(form: FormGroup, fieldName: string | string[], value: any = null): void {
    if (Array.isArray(fieldName)) {
      fieldName.forEach(name => this.resetSingleControl(form, name, value));
    } else {
      this.resetSingleControl(form, fieldName, value);
    }
  }

  // Helper method to reset a single form control
  private resetSingleControl(form: FormGroup, fieldName: string, value: any): void {
    const control = form.get(fieldName);
    if (control) {
      control.reset(value);
    } else {
      console.error(`Control with name ${fieldName} not found in the form group.`);
    }
  }

  private disableSingleControl(form: FormGroup, fieldName: string): void {
    const control = form.get(fieldName);
    if (control) {
      control.disable();
    } else {
      console.error(`Control with name ${fieldName} not found in the form group.`);
    }
  }

  disableControl(form: FormGroup, fieldName: string | string[]): void {
    if (Array.isArray(fieldName)) {
      fieldName.forEach(name => this.disableSingleControl(form, name));
    } else {
      this.disableSingleControl(form, fieldName);
    }
  }
}
