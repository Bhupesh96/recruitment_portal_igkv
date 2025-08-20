import {Directive, ElementRef, HostListener} from '@angular/core';

@Directive({
  standalone: true,
  selector: '[isFloat]'
})
export class FloatDirective {
  private regex: RegExp = new RegExp(/^\d+(\.\d{0,4})?$/);
  private specialKeys: Array<string> = ['Backspace', 'Tab', 'End', 'Home', 'Delete', 'ArrowLeft', 'ArrowRight'];

  constructor(private el: ElementRef) {
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (this.specialKeys.indexOf(event.key) !== -1) return;
    const current: string = this.el.nativeElement.value;
    const next: string = current.concat(event.key);
    if (!String(next).match(this.regex)) event.preventDefault();
  }

  @HostListener('input', ['$event'])
  onInput(event: Event) {
    const currentValue = this.el.nativeElement.value;
    const decimalIndex = currentValue.indexOf('.');
    if (decimalIndex !== -1) {
      const decimalPart = currentValue.slice(decimalIndex + 1);
      if (decimalPart.length > 4) {
        this.el.nativeElement.value = currentValue.slice(0, decimalIndex + 5);
      }
    }
  }
}
