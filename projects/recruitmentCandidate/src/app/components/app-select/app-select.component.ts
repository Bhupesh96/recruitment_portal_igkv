import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  FormsModule
} from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgSelectModule
  ],
  templateUrl: './app-select.component.html',
  styleUrls: ['./app-select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppSelectComponent),
      multi: true
    }
  ]
})
export class AppSelectComponent implements ControlValueAccessor, OnChanges {

  @Input() items: any[] = [];
  @Input() bindLabel = '';
  @Input() bindValue = '';
  @Input() placeholder = 'Select';
  @Input() clearable = false;
  @Input() searchable = true;

  value: any;
  disabled = false; // Tracks the Angular form control state

  private onChange = (_: any) => {};
  private onTouched = () => {};

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      this.normalizeValue();
    }
  }

  writeValue(value: any): void {
    this.value = value;
    this.normalizeValue();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  change(value: any) {
    this.value = value;
    this.onChange(value);
    this.onTouched();
  }

  private normalizeValue() {
    if (this.value != null && this.items && this.items.length > 0 && this.bindValue) {
      // Use loose equality (==) to handle string "17" vs number 17 automatically
      const matchedItem = this.items.find(item => item[this.bindValue] == this.value);
      if (matchedItem && matchedItem[this.bindValue] !== this.value) {
        this.value = matchedItem[this.bindValue];
        this.cdr.markForCheck();
      }
    }
  }
}
