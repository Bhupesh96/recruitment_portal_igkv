import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-step-8',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './step-8.component.html',
  styleUrls: ['./step-8.component.scss'],
})
export class Step8Component implements OnInit {
  @Output() formData = new EventEmitter<{ [key: string]: any }>();
  form: FormGroup;
  isSubmitted: boolean = false;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      declaration: [false, Validators.requiredTrue],
    });
  }

  ngOnInit(): void {
    this.form.valueChanges.subscribe(() => {
      this.formData.emit({ ...this.form.value, _isValid: this.form.valid });
    });
  }

  submit() {
    if (this.form.valid) {
      this.isSubmitted = true;
      this.form.disable();
      this.formData.emit({
        ...this.form.value,
        _isValid: this.form.valid,
        isSubmitted: this.isSubmitted,
      });
    }
  }
}
