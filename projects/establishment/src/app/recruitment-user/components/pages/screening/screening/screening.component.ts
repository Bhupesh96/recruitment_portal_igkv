import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { catchError, map, Observable, of, switchMap, forkJoin } from 'rxjs';
import { AlertService, HttpService } from 'shared';
import { HeaderComponent } from '../../../header/header.component';
import { FooterComponent } from '../../../footer/footer.component';
import { StepperComponent } from '../screening-stepper/stepper.component';
import {
  RecruitmentStateService,
  UserRecruitmentData,
} from '../../recruitment-state.service';
// FIX 1: Add IDs for efficient filtering and add subject property
export interface Candidate {
  registrationNo: number;
  name: string;
  age: string;
  category: string;
  advertisementId: number;
  postId: number;
  subjectId: number;
  a_rec_app_main_id: number;
  advertisement: string;
  post: string;
  subject: string; // <-- Added subject
  status: string;
  eligibilityStatus: 'Y' | 'N' | null;
  details?: string;
}

export interface DropdownItem {
  id: number | string;
  name: string;
  disabled?: boolean;
  status?: string; // optional for post status
}

export interface SelectedFilters {
  advertisement: number | null;
  post: number | null;
  subject: number | null;
  status: string;
  claimType: string;
  eligibility: 'Y' | 'N' | 'null' | '';
}

@Component({
  selector: 'app-screening',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    FooterComponent,
    NgSelectModule,
    StepperComponent,
  ],
  templateUrl: './screening.component.html',
  styleUrls: ['./screening.component.scss'],
})
export class ScreeningComponent implements OnInit {
  advertisements: DropdownItem[] = [];
  posts: DropdownItem[] = [];
  subjects: DropdownItem[] = [];
  searchText: string = '';
  candidates: Candidate[] = [];

  selected: SelectedFilters = {
    advertisement: null,
    post: null,
    subject: null,
    status: '',
    claimType: '',
    eligibility: '',
  };

  expandedIndex: number | null = null;
  viewingProfileIndex: number | null = null;
  viewingProfile: boolean = false;

  constructor(
    private HTTP: HttpService,
    private alert: AlertService,
    private recruitmentState: RecruitmentStateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAdvertisements();
    this.candidates = [];
  }

  /** Load advertisements dropdown */
  private loadAdvertisements() {
    this.getDropdownData(110).subscribe((res: DropdownItem[]) => {
      this.advertisements = res;
    });
  }

  /** Fetches additional info for a single candidate, including category */
  private getAdditionalInfo(registrationNo: number): Observable<any[]> {
    return this.HTTP.getParam(
      '/candidate/get/getAddtionInfoDetails',
      {
        registration_no: registrationNo,
        Application_Step_Flag_CES: 'C',
      },
      'recruitement'
    ).pipe(
      map((res: any) => res?.body?.data || []),
      catchError(() => of([])) // Return an empty array on error to not break forkJoin
    );
  }
  private getEligibilityStatus(
    registrationNo: number,
    advId: number
  ): Observable<'Y' | 'N' | null> {
    return this.HTTP.getParam(
      '/candidate/get/getScreeningOrScoringStatus',
      {
        registration_no: registrationNo,
        a_rec_adv_main_id: advId,
        Application_Step_Flag_CES: 'E', // Always check the Screening record
      },
      'recruitement'
    ).pipe(
      map((res: any) => {
        // Extract the specific field from the response data array (assuming it returns an array)
        const decision = res?.body?.data?.[0]?.Verification_Finalize_YN;
        // Ensure we return only 'Y', 'N', or null
        if (decision === 'Y' || decision === 'N') {
          return decision;
        }
        return null; // Return null if the value is missing, 'S', or anything else
      }),
      catchError((error) => {
        console.error(
          `Error fetching eligibility status for ${registrationNo}:`,
          error
        );
        return of(null); // Return null on API error to prevent breaking the list
      })
    );
  }
  /** Load candidates and their additional info from API */
  private loadCandidates() {
    this.resetViewState();
    this.HTTP.getData(
      '/candidate/get/getRecruitementCandidateList',
      'recruitement'
    )
      .pipe(
        switchMap((res: any) => {
          const candidatesData = res.body.data || [];
          if (candidatesData.length === 0) {
            return of([]); // No candidates, return empty
          }

          // --- Step 1: Fetch Additional Info (Category) ---
          const additionalInfoRequests = candidatesData.map((c: any) =>
            this.getAdditionalInfo(c.registration_no)
          );

          return forkJoin(additionalInfoRequests).pipe(
            // --- Step 2: Combine Base Data + Additional Info ---
            map((additionalInfos: any) => {
              return candidatesData.map((c: any, index: number) => {
                const additionalInfo = additionalInfos[index];
                const categoryInfo = additionalInfo.find(
                  (info: any) => info.question_id === 2
                );
                const category = categoryInfo
                  ? categoryInfo.input_field
                  : 'N/A';

                // Create preliminary candidate object (without eligibility yet)
                return {
                  registrationNo: c.registration_no,
                  name: `${c.Applicant_First_Name_E} ${
                    c.Applicant_Middle_Name_E || ''
                  } ${c.Applicant_Last_Name_E}`,
                  age: this.calculateAge(c.DOB),
                  category: category,
                  advertisementId: c.a_rec_adv_main_id,
                  postId: c.post_code,
                  subjectId: c.subject_id, // Keep as potentially null
                  a_rec_app_main_id: c.a_rec_app_main_id,
                  advertisement: this.getNameById(
                    this.advertisements,
                    c.a_rec_adv_main_id
                  ),
                  post: this.getNameById(this.posts, c.post_code),
                  subject: this.getNameById(this.subjects, c.subject_id), // Handle null ID gracefully
                  status: 'Pending', // Set a default initial status - Modify if API provides this
                  eligibilityStatus: null, // Initialize eligibilityStatus as null
                  details: '',
                } as Candidate; // Assert type here
              });
            }),
            // --- Step 3: Fetch Eligibility Status for all candidates ---
            switchMap((candidatesWithCategory: Candidate[]) => {
              if (candidatesWithCategory.length === 0) {
                return of([]); // Pass empty array if no candidates
              }
              // Create observables for fetching eligibility status
              const eligibilityRequests = candidatesWithCategory.map((c) =>
                this.getEligibilityStatus(c.registrationNo, c.advertisementId)
              );
              // Fetch all statuses
              return forkJoin(eligibilityRequests).pipe(
                // --- Step 4: Combine Candidate Data + Eligibility Status ---
                map((eligibilityStatuses: Array<'Y' | 'N' | null>) => {
                  // Add the fetched status to each candidate object
                  return candidatesWithCategory.map((candidate, index) => ({
                    ...candidate,
                    eligibilityStatus: eligibilityStatuses[index], // Assign the fetched status
                  }));
                })
              );
            })
          ); // End forkJoin for additional info
        }), // End initial switchMap
        catchError((err) => {
          // Add top-level error handling
          console.error('Error loading candidates:', err);
          this.alert.alert(true, 'Failed to load candidate data.');
          return of([]); // Return empty array on error
        })
      ) // End pipe
      .subscribe((finalCandidates: Candidate[]) => {
        this.candidates = finalCandidates;
        this.cdr.markForCheck(); // Ensure UI updates
      });
  }
  private resetViewState() {
    this.expandedIndex = null;
    this.viewingProfileIndex = null;
    this.viewingProfile = false;
  }
  /** Generic dropdown API */
  private getDropdownData(
    queryId: number,
    params: { [key: string]: any } = {}
  ): Observable<DropdownItem[]> {
    return this.HTTP.getParam(
      '/master/get/getDataByQueryId',
      { query_id: queryId, ...params },
      'recruitement'
    ).pipe(
      map((res: any) => {
        const data = res?.body?.data || [];
        if (!data.length)
          return [{ id: '', name: 'No Data Available', disabled: true }];
        return data.map((item: any) => ({
          id: item.data_id,
          name: item.data_name,
          status: item.post_status_name, // optional
          disabled: false,
        }));
      }),
      catchError(() =>
        of([{ id: '', name: 'Error loading data', disabled: true }])
      )
    );
  }
  get currentStats() {
    // Step 1: Create a base list filtered by everything EXCEPT status.
    const baseList = this.candidates.filter(
      (c) =>
        (!this.selected.advertisement ||
          c.advertisementId === this.selected.advertisement) &&
        (!this.selected.post || c.postId === this.selected.post) &&
        (!this.selected.subject || c.subjectId === this.selected.subject)
    );

    // Step 2: Apply the text search to this base list.
    const searchTerm = this.searchText.toLowerCase().trim();
    const finalList = !searchTerm
      ? baseList
      : baseList.filter(
          (c) =>
            c.name.toLowerCase().includes(searchTerm) ||
            c.registrationNo.toString().includes(searchTerm) ||
            c.post.toLowerCase().includes(searchTerm) ||
            c.category.toLowerCase().includes(searchTerm)
        );

    // Step 3: Calculate all stats from this final, status-agnostic list.
    return {
      total: finalList.length, // This is the CORRECT total count.
      allotted: finalList.filter((c) => c.status === 'Allotted').length,
      eligible: finalList.filter((c) => c.eligibilityStatus === 'Y').length,
      notEligible: finalList.filter((c) => c.eligibilityStatus === 'N').length,
      pending: finalList.filter((c) => c.eligibilityStatus === null).length,
    };
  }
  /** Get name by ID from dropdown array */
  getNameById(arr: DropdownItem[], id: number | string | null): string {
    if (!id || !arr || arr.length === 0) return 'N/A'; // Added guard clause
    const found = arr.find((x) => x.id === id);
    return found ? found.name : 'N/A'; // Return N/A if not found
  }

  /** Post name by ID */
  getPostNameById(postCode: number): string {
    const post = this.posts.find((p) => p.id === postCode);
    return post ? post.name : 'N/A';
  }

  /** Category name mapping */
  getCategoryName(categoryId: number | null): string {
    if (!categoryId) return 'N/A';
    const categories: { [key: number]: string } = {
      1: 'UR',
      2: 'OBC',
      3: 'SC',
      4: 'ST',
      5: 'EWS',
    };
    return categories[categoryId] || 'Other';
  }

  /** Calculate age from DOB */
  calculateAge(dob: string): string {
    if (!dob) return '0y 0m 0d';
    const birth = new Date(dob);
    const today = new Date();

    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years}y ${months}m ${days}d`;
  }

  /** Filtered candidates */
  get filteredCandidates(): Candidate[] {
    // 1. Start with the existing dropdown/status filters
    let filteredList = this.candidates.filter(
      (c) =>
        (!this.selected.advertisement ||
          c.advertisementId === this.selected.advertisement) &&
        (!this.selected.post || c.postId === this.selected.post) &&
        (!this.selected.subject || c.subjectId === this.selected.subject) &&
        (!this.selected.status || c.status === this.selected.status) &&
        (!this.selected.status || c.status === this.selected.status) &&
        // Apply eligibility filter (for 'Y', 'N', 'null')
        (!this.selected.eligibility ||
          (this.selected.eligibility === 'null'
            ? c.eligibilityStatus === null
            : c.eligibilityStatus === this.selected.eligibility))
      // --- END FIX ---
    );

    // 2. If there's no search text, return the list as is
    if (!this.searchText) {
      return filteredList;
    }

    // 3. Otherwise, apply the text search on the already filtered list
    const searchTerm = this.searchText.toLowerCase().trim();

    return filteredList.filter((candidate) => {
      // Search across multiple fields. Convert non-string fields to string for searching.
      return (
        candidate.name.toLowerCase().includes(searchTerm) ||
        candidate.registrationNo.toString().includes(searchTerm) ||
        candidate.post.toLowerCase().includes(searchTerm) ||
        candidate.category.toLowerCase().includes(searchTerm)
      );
    });
  }

  /** Advertisement change */
  onAdvertisementChange(adId: number | null) {
    this.selected.post = null;
    this.selected.subject = null;
    this.posts = [];
    this.subjects = [];
    this.candidates = []; // Clear previous candidates immediately
    this.resetViewState();
    if (!adId) {
      return;
    }

    this.getDropdownData(120, { a_rec_adv_main_id: adId }).subscribe((res) => {
      this.posts = res;
      // CHANGE: Moved loadCandidates() here.
      // This ensures candidates are loaded ONLY after posts are available.
      this.loadCandidates();
    });
  }

  /** Post change */
  onPostChange(postId: number | null) {
    this.selected.subject = null;
    this.subjects = [];
    this.resetViewState();
    if (!postId) return;
    this.getDropdownData(99, { post_code: postId }).subscribe(
      (res) => (this.subjects = res)
    );
    // this.loadCandidates(); // This call is optional
  }

  /** Toggle expand candidate card */
  toggleExpand(index: number) {
    // If we're clicking the same expanded card again to close it
    if (this.expandedIndex === index) {
      this.expandedIndex = null;
      this.viewingProfileIndex = null; // Also reset the profile view
    } else {
      this.expandedIndex = index;
      this.viewingProfileIndex = null; // Reset profile view when expanding a new card
    }
  }
  showProfile(candidate: Candidate, index: number, event: MouseEvent) {
    event.stopPropagation();

    const candidateData: UserRecruitmentData = {
      registration_no: candidate.registrationNo,
      a_rec_adv_main_id: candidate.advertisementId,
      post_code: candidate.postId,
      subject_id: candidate.subjectId,
      academic_session_id: null, // Assuming this isn't needed for screening steps
      a_rec_app_main_id: candidate.a_rec_app_main_id,
    };

    this.recruitmentState.setScreeningCandidate(candidateData);

    // THIS IS THE FIX: Set the index of the profile being viewed.
    this.viewingProfileIndex = index;
  }
  closeProfile() {
    this.recruitmentState.setScreeningCandidate(null);
    this.viewingProfile = false;
  }
  /** Filter by status */
  filterByStatus(status: string) {
    this.selected.status = this.selected.status === status ? '' : status;
    this.selected.eligibility = '';
  }
  filterByEligibility(eligibility: 'Y' | 'N' | 'null' | '') {
    // Toggle eligibility or set it
    this.selected.eligibility =
      this.selected.eligibility === eligibility ? '' : eligibility;
    // Clear the status filter if we set an eligibility filter
    this.selected.status = '';
  }
  clearStatusFilters() {
    this.selected.status = '';
    this.selected.eligibility = '';
  }
  /** Refresh filters and reload data */
  refreshData() {
    // 1. Reset all filter selections
    this.selected = {
      advertisement: null,
      post: null,
      subject: null,
      status: '',
      claimType: '',
      eligibility: '',
    };

    // 2. Clear the dependent dropdowns and the main candidate list
    this.posts = [];
    this.subjects = [];
    this.candidates = [];
    this.expandedIndex = null;
    this.loadAdvertisements();
  }

  /** Selected post type display */
  getSelectedPostStatus(): string {
    // If no post is selected, return '-' instead of 'All'
    if (!this.selected.post) return '-';

    const post = this.posts.find((p) => p.id === this.selected.post);

    // Also change the fallback value here to '-'
    return post?.status ?? '-';
  }
}
