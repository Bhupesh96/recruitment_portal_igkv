import {Directive, Output, EventEmitter, HostListener} from '@angular/core';

@Directive({
  standalone: true,
  selector: '[appDetectCapsLock]'
})
export class CapslockDirective {
  @Output() capsLockOn = new EventEmitter<number>();
  capslock: number = 0;

  constructor() {
  }

  @HostListener('keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    // Check if the pressed key is the Caps Lock key
    if (event.key === 'CapsLock') {
      // Determine the state of the Caps Lock key
      const capsLockState = event.getModifierState('CapsLock');

      // Emit event based on Caps Lock state
      if (capsLockState) {
        this.capsLockOn.emit(1);
        this.capslock = 1;
      } else {
        this.capsLockOn.emit(2);
        this.capslock = 2;
      }
    } else if (this.capslock !== 0) {
      // Handle other keys when Caps Lock is already toggled
      if (this.capslock === 1) {
        this.capsLockOn.emit(2);
        this.capslock = 2;
      } else {
        this.capsLockOn.emit(1);
        this.capslock = 1;
      }
    }
  }

}
