import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from 'shared'; // Assuming 'shared' is the correct path

/**
 * Defines the structure for the core user data needed for the recruitment form.
 * Using an interface provides type safety and makes your code easier to read.
 */
export interface UserRecruitmentData {
  registration_no: number | null;
  a_rec_adv_main_id: number | null;
  post_code: number | null;
  subject_id: number | null;
  academic_session_id: number | null;
  a_rec_app_main_id: number | null;
  // This allows for any other properties that might exist on the currentUser object.
  [key: string]: any;
}

@Injectable({
  providedIn: 'root',
})
export class RecruitmentStateService {
  // A private BehaviorSubject holds the current state of the user's recruitment data.
  // It's initialized to null, indicating that the data might not be loaded yet.
  private readonly _userData = new BehaviorSubject<UserRecruitmentData | null>(
    null
  );

  /**
   * A public observable ($) that components can subscribe to.
   * This allows components to react automatically whenever the user data changes.
   */
  public readonly userData$: Observable<UserRecruitmentData | null> =
    this._userData.asObservable();

  private readonly _screeningCandidateData =
    new BehaviorSubject<UserRecruitmentData | null>(null);
  public readonly screeningCandidateData$ =
    this._screeningCandidateData.asObservable();

  constructor(private authService: AuthService) {
    // When the service is first created, it immediately checks the AuthService.
    const currentUser = this.authService.currentUser;

    if (currentUser) {
      // If a user object exists, we extract the necessary data.
      // This mapping creates a clean, dedicated object for our form's state.
      const recruitmentData: UserRecruitmentData = {
        registration_no: currentUser.registration_no,
        a_rec_adv_main_id: currentUser.a_rec_adv_main_id,
        post_code: currentUser.post_code,
        subject_id: currentUser.subject_id,
        academic_session_id: currentUser.academic_session_id,
        a_rec_app_main_id: currentUser.a_rec_app_main_id,
        ...currentUser, // Spread the rest of the properties from the original object
      };

      // We update the BehaviorSubject with the new data.
      this._userData.next(recruitmentData);
      console.log(
        '✅ RecruitmentStateService initialized with data from AuthService:',
        JSON.stringify(recruitmentData, null, 2)
      );
    } else {
      console.warn(
        'RecruitmentStateService: No currentUser was found in AuthService upon initialization.'
      );
    }
  }

  /**
   * 💡 A synchronous getter for components that need a one-time snapshot of the data.
   * @returns The current UserRecruitmentData object, or null if it's not set.
   */
  public getCurrentUserData(): UserRecruitmentData | null {
    return this._userData.getValue();
  }

  /**
   * A convenience helper method to quickly get just the registration number.
   * @returns The user's registration number, or null.
   */
  public getRegistrationNumber(): number | null {
    // The '??' (nullish coalescing operator) is a safe way to return null if the user data or the property is missing.
    return this.getCurrentUserData()?.registration_no ?? null;
  }
  public setScreeningCandidate(data: UserRecruitmentData | null): void {
    this._screeningCandidateData.next(data);
  }
  public updateUserData(newData: Partial<UserRecruitmentData>): void {
    const currentData = this._userData.getValue();

    if (currentData) {
      // 1. Merge existing data with the new data (e.g., adding the new ID)
      const updatedData = { ...currentData, ...newData };

      // 2. Update the BehaviorSubject so all subscribers get the new ID immediately
      this._userData.next(updatedData);

      // 3. IMPORTANT: Update the AuthService or LocalStorage so the ID persists on Page Refresh (F5)
      // Assuming your AuthService reads from 'currentUser' in localStorage:
      const storedUser = localStorage.getItem('currentUser'); // Check your specific key
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        const mergedUser = { ...parsedUser, ...newData };
        localStorage.setItem('currentUser', JSON.stringify(mergedUser));

        // If your AuthService has a subject, update it here too if possible
        // this.authService.currentUser = mergedUser;
      }

      console.log('🔄 Recruitment State Updated:', updatedData);
    }
  }
  public getScreeningCandidateData(): UserRecruitmentData | null {
    const data = this._screeningCandidateData.getValue();
    console.log(
      '🔍 getScreeningCandidateData() returning:',
      JSON.stringify(data, null, 2)
    );
    return data;
  }
}
