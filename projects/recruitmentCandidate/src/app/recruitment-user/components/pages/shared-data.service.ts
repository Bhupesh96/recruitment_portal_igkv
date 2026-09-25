// src/app/shared-data.service.ts

import { Injectable } from '@angular/core';
import {BehaviorSubject, Subject} from 'rxjs'; // 👈 Import BehaviorSubject

export interface LatestPdfAvailability {
  updatedAt: string;
}

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
  private pdfAvailabilitySubject =
    new BehaviorSubject<LatestPdfAvailability | null>(null);
  public pdfAvailability$ = this.pdfAvailabilitySubject.asObservable();
  private pdfDownloadRequestedSubject = new BehaviorSubject<boolean>(false);
  public pdfDownloadRequested$ = this.pdfDownloadRequestedSubject.asObservable();
  private stepChangedSubject = new Subject<void>();
  public stepChanged$ = this.stepChangedSubject.asObservable();
  constructor() {}
  notifyStepChanged(): void {
    this.stepChangedSubject.next();
  }
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

  markLatestPdfAvailable(): void {
    this.pdfAvailabilitySubject.next({
      updatedAt: new Date().toISOString(),
    });
  }

  requestLatestPdfDownload(): void {
    this.pdfDownloadRequestedSubject.next(true);
  }

  completeLatestPdfDownloadRequest(): void {
    this.pdfDownloadRequestedSubject.next(false);
  }
}
