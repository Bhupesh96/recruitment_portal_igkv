import {AbstractControl, ValidatorFn, ValidationErrors} from '@angular/forms';

export function aadharValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const aadharNumber: string | null = control.value ? control.value.toString() : null;
    if (aadharNumber) {
      const d = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
        [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
        [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
        [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
        [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
        [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
        [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
        [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
        [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      ];
      const p = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
        [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
        [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
        [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
        [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
        [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
        [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
      ];
      let array: any = [];
      if (Object.prototype.toString.call(aadharNumber) === '[object Number]') {
        array = aadharNumber.toString();
      }
      if (Object.prototype.toString.call(aadharNumber) === '[object String]') {
        array = aadharNumber.split('').map(Number);
      }
      let c = 0;
      const invertedArray = array.reverse();
      for (let i = 0; i < invertedArray.length; i++) {
        c = d[c][p[(i % 8)][invertedArray[i]]];
      }
      if (c === 0) {
        return null;
      }
      return {invalidAadhar: true};
    }
    return null
  };
}
