// src/app/shared-data.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs'; // 👈 Import BehaviorSubject

@Injectable({
  providedIn: 'root',
})
export class SharedDataService {
  // Use a BehaviorSubject to hold and stream the form data.
  // Initialize with an empty object.
  private formDataSubject = new BehaviorSubject<{ [key: number]: any }>({});

  // Expose the data as an observable for components to subscribe to.
  // This prevents components from accidentally pushing new data.
  public formData$ = this.formDataSubject.asObservable();

  constructor() {}

  // Called by the Stepper to PUSH new data into the stream.
  setFormData(data: { [key: number]: any }) {
    // Deep copy the data to ensure immutability
    const deepCopiedData = JSON.parse(JSON.stringify(data));
    this.formDataSubject.next(deepCopiedData); // Use .next() to emit the new value
    console.log(
      '✅ Data has been SET in the singleton SharedDataService:',
      JSON.stringify(deepCopiedData, null, 2)
    );
  }

  // The getFormData() method is no longer needed, as components will subscribe to formData$
}
