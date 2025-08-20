import {Injectable} from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class AlertService {

  constructor() {
  }

  alert(is_error: boolean, message: string, timer: null | number = null) {
    const type = is_error ? 'error' : 'success';
    const options: any = {
      title: message ?? '',
      text: '',
      icon: type,
      showConfirmButton: false,
    };
    if (timer) options.timer = timer;
    else options.showConfirmButton = true;
    Swal.fire(options);
  }

  alertStatus(status: number, message: string, timer: null | number = null): void {
    const isSuccess = status >= 200 && status < 300;
    const type = isSuccess ? 'success' : 'error';
    const options: any = {
      title: message ?? '',
      text: '',
      icon: type,
      showConfirmButton: false,
    };
    if (timer) options.timer = timer;
    else options.showConfirmButton = true;
    Swal.fire(options);
  }

  alertMessage(title: string, html: string, icons: any, confirmButtonText = "OK"): any {
    Swal.fire({
      title: `<b>${title}</b>`,
      html: html,
      icon: icons,
      showConfirmButton: true,
      confirmButtonText: confirmButtonText,
      allowOutsideClick: false,
      allowEscapeKey: false,
      // timer: 2000,
      // timerProgressBar: true
    })
  }

  confirmAlert(title: any, html: any, icons: any): any {
    return Swal.fire({
      title: `<b>${title}</b>`,
      text: html,
      icon: icons,
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
      backdrop: true,
    })
  }

  remarkAlert(title: any): any {
    return Swal.fire({
      title: `<b>${title}</b>`,
      input: 'text',
      icon: 'question',
      inputAttributes: {
        required: 'required',
        placeholder: 'Remark',
        class: 'form-control'
      },
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
      showLoaderOnConfirm: true,
      preConfirm: (name) => {
        if (!name) {
          Swal.showValidationMessage('Remark field is required.')
        }
        return name
      },
      allowOutsideClick: () => !Swal.isLoading()
    })
  }
}
