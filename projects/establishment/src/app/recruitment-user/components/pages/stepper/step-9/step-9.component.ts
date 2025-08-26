import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-step-9',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step-9.component.html',
  styleUrls: ['./step-9.component.scss'],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(20px)' }))
      ])
    ])
  ]
})
export class Step9Component {
  @Output() formData = new EventEmitter<{ [key: string]: any }>();

  submit() {
    this.formData.emit({ _isValid: true });
  }
}