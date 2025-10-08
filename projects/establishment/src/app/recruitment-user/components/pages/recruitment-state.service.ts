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
        ...currentUser, // Spread the rest of the properties from the original object
      };

      // We update the BehaviorSubject with the new data.
      this._userData.next(recruitmentData);
      console.log(
        '✅ RecruitmentStateService initialized with data from AuthService:',
        recruitmentData
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

  public getScreeningCandidateData(): UserRecruitmentData | null {
    return this._screeningCandidateData.getValue();
  }
}
