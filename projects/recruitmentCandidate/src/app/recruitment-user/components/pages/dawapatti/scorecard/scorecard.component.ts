import { Component, OnInit } from '@angular/core';
import {
  RecruitmentStateService,
  UserRecruitmentData,
} from '../../recruitment-state.service';
import { HttpService, LoaderService } from 'shared';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser'; // Import DomSanitizer
import { environment } from 'environment';

@Component({
  selector: 'app-scorecard',
  standalone: true,
  templateUrl: './scorecard.component.html',
  styleUrl: './scorecard.component.scss',
  imports: [CommonModule],
})
export class ScorecardComponent implements OnInit {
  applicantData: any = null; // This will hold the 'E' (Screening) record
  subjectList: any[] = [];
  applicantCategory: string = '';
  scoringTableData: any[] = [];
  totalMaxMarks: number = 0;
  totalObtainedMarks: number = 0;
  // ✅ ADDED: This will store the 'C' (Candidate) record ID
  candidateAppMainId: number | null = null;

  constructor(
    private recruitmentState: RecruitmentStateService,
    private HTTP: HttpService,
    private sanitizer: DomSanitizer,
    private loader: LoaderService
  ) {}

  ngOnInit(): void {
    // Get the user data from the state
    const userData = this.recruitmentState.getCurrentUserData();
    console.log(
      'User data in scorecard ngOnInit: ',
      JSON.stringify(userData, null, 2)
    );

    if (userData?.registration_no) {
      // ✅ STORE THE 'C' (CANDIDATE) ID
      this.candidateAppMainId = userData.a_rec_app_main_id;
      console.log(
        `✅ Stored 'C' (Candidate) app_main_id: ${this.candidateAppMainId}`
      );

      // Go fetch the 'E' (Screening) record
      this.getApplicantData(userData.registration_no);
    } else {
      console.error('❌ No registration number found in state.');
    }
  }

  // In scorecard.component.ts

  async downloadPDF() {
    const printElement = document.getElementById('scorecard-to-print');
    if (!printElement) return;

    // Convert the logo (if it exists) to base64 before capturing HTML
    const logoImg = printElement.querySelector('img#logo') as HTMLImageElement;
    if (logoImg && logoImg.src && !logoImg.src.startsWith('data:')) {
      const base64 = await this.convertImageToBase64(logoImg.src);
      logoImg.src = base64;
    }

    const htmlContent = printElement.outerHTML;
    const payload = { html: htmlContent, orientation: 'portrait' };

    this.loader.showLoader();
    this.HTTP.postBlob(
      '/file/post/htmltoPdf',
      payload,
      'scorecard.pdf',
      'common'
    )
      .pipe(finalize(() => this.loader.hideLoader()))
      .subscribe({
        next: () => console.log('PDF download initiated.'),
        error: (err) => console.error('Error generating PDF:', err),
      });
  }

  // helper
  private convertImageToBase64(url: string): Promise<string> {
    return fetch(url)
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      );
  }

  // --- Helper to get applicant's full name ---
  get fullNameE() {
    const a = this.applicantData;
    return a
      ? [
          a.Applicant_First_Name_E,
          a.Applicant_Middle_Name_E,
          a.Applicant_Last_Name_E,
        ]
          .filter(Boolean)
          .join(' ')
      : '';
  }

  // --- Helper to build safe file URLs ---
  getFileUrl(fileName: string): SafeUrl {
    if (!fileName) {
      return this.sanitizer.bypassSecurityTrustUrl('');
    }
    const normalized = fileName
      .replace(/^services[\\/]/, '')
      .replace(/\\/g, '/');
    const url = `${environment.recruitmentFileBaseUrl}/${normalized}`;
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  // --- Helper to get subject name from list ---
  get subjectName(): string {
    if (!this.applicantData?.subject_id || this.subjectList.length === 0) {
      return '';
    }
    const subject = this.subjectList.find(
      (s) => s.subject_id === this.applicantData.subject_id
    );
    return subject ? subject.Subject_Name_E : 'Unknown Subject';
  }

  // --- 1. Load Main Applicant Data (Screening 'E' Record) ---
  private getApplicantData(registrationNo: number): void {
    this.HTTP.getParam(
      '/master/get/getApplicant',
      { registration_no: registrationNo, Application_Step_Flag_CES: 'E' },
      'recruitement'
    ).subscribe({
      next: (res) => {
        this.applicantData = res?.body?.data[0];
        if (!this.applicantData) {
          console.error('❌ No applicant data found for this screening.');
          return;
        }

        console.log('✅ Applicant "E" Data:', this.applicantData);

        // Fetch side-data (subject, category)
        if (this.applicantData.post_code) {
          this.getSubjectList(this.applicantData.post_code);
        }
        if (this.applicantData.registration_no) {
          this.getAdditionalInfo(this.applicantData.registration_no);
        }

        // Now that we have all IDs, fetch the scoring structure & data.
        if (
          this.applicantData.a_rec_adv_main_id &&
          this.applicantData.registration_no &&
          this.applicantData.a_rec_app_main_id &&
          this.candidateAppMainId // <-- Check that 'C' ID is also loaded
        ) {
          this.getScoringDetailsAndMergeScores(
            this.applicantData.a_rec_adv_main_id,
            this.applicantData.registration_no,
            this.applicantData.a_rec_app_main_id, // This is the 'E' record ID (e.g., 58)
            this.candidateAppMainId // ✅ Pass the 'C' record ID (e.g., 12)
          );
        } else {
          console.warn(
            '⚠️ Cannot fetch scoring, key IDs (C_ID, E_ID, or Adv_ID) are missing.'
          );
        }
      },
      error: (err) => {
        console.error('❌ Error fetching applicant "E" data:', err);
      },
    });
  }

  // --- 2. Load Subject List ---
  private getSubjectList(postCode: number): void {
    this.HTTP.getParam(
      '/master/get/getSubjectsByPost',
      { post_code: postCode },
      'recruitement'
    ).subscribe({
      next: (res) => {
        this.subjectList = res?.body?.data || [];
        console.log('✅ Subject List:', this.subjectList);
      },
      error: (err) => {
        console.error('❌ Error fetching subject list:', err);
        this.subjectList = [];
      },
    });
  }

  // --- 3. Load Additional Info (for Category) ---
  private getAdditionalInfo(registrationNo: number): void {
    this.HTTP.getParam(
      '/candidate/get/getAddtionInfoDetails',
      { registration_no: registrationNo, Application_Step_Flag_CES: 'E' },
      'recruitement'
    ).subscribe({
      next: (res) => {
        const infoData = res?.body?.data || [];
        const categoryObj = infoData.find(
          (item: any) => item.question_id === 2
        );
        if (categoryObj) {
          this.applicantCategory = categoryObj.input_field;
          console.log('✅ Applicant Category:', this.applicantCategory);
        } else {
          console.warn('⚠️ Category not found in additional info.');
        }
      },
      error: (err) => {
        console.error('❌ Error fetching additional info:', err);
        this.applicantCategory = '';
      },
    });
  }

  // --- 4. Load Scoring Structure AND Data, then Merge ---
  private getScoringDetailsAndMergeScores(
    advertisementId: number,
    registrationNo: number,
    appMainId: number, // This is the 'E' record ID (e.g., 58)
    candidateAppMainId: number // ✅ This is the 'C' record ID (e.g., 12)
  ): void {
    const scoreFieldIds = [1, 8, 34, 18, 32];

    // --- Part A: Get the Scoring *Structure* ---
    const parentRequests = scoreFieldIds.map((id) =>
      this.HTTP.getParam(
        '/master/get/getSubHeadingParameterByParentScoreField',
        {
          m_rec_score_field: 'N',
          a_rec_adv_main_id: advertisementId,
          m_rec_score_field_id: id,
        },
        'recruitement'
      )
    );

    // --- Part B: Get the Scoring *Data* ---
    const scoreDataRequest = this.HTTP.getParam(
      '/candidate/get/getCandidateReportCard',
      {
        Flag_CES: 'S', // Try S first
        registration_no: registrationNo,
        app_main_id: candidateAppMainId,
      },
      'recruitement'
    ).pipe(
      catchError(() => of(null)), // ignore error
      switchMap((res: any) => {
        const data = res?.body?.data;
        if (data && data.length > 0) {
          return of(res); // ✔ S found → return S
        }

        // ❗ No S data → call E
        return this.HTTP.getParam(
          '/candidate/get/getCandidateReportCard',
          {
            Flag_CES: 'E',
            registration_no: registrationNo,
            app_main_id: candidateAppMainId,
          },
          'recruitement'
        ).pipe(catchError(() => of(null)));
      })
    );

    // --- Part C: Run Structure requests ---
    forkJoin(parentRequests).subscribe({
      next: (parentResponses) => {
        const parentData = parentResponses
          .map((res) => res?.body?.data[0])
          .filter(Boolean);

        if (parentData.length === 0) {
          console.warn('No parent scoring data found.');
          this.scoringTableData = [];
          return;
        }

        const subHeadingRequests = parentData.map((item) => {
          if (!item.a_rec_adv_post_detail_id) {
            return of(null);
          }
          return this.HTTP.getParam(
            '/master/get/getSubHeadingByParentScoreField',
            {
              a_rec_adv_main_id: item.a_rec_adv_main_id,
              score_field_parent_id: item.m_rec_score_field_id,
              a_rec_adv_post_detail_id: item.a_rec_adv_post_detail_id,
            },
            'recruitement'
          ).pipe(
            catchError((err) => {
              console.error(
                `Error fetching sub-headings for parent ${item.m_rec_score_field_id}:`,
                err
              );
              return of(null);
            })
          );
        });

        // --- Part D: Run Sub-heading and Score Data requests together ---
        forkJoin([forkJoin(subHeadingRequests), scoreDataRequest]).subscribe({
          next: ([subHeadingResponses, scoreDataResponse]) => {
            // Build the base structure
            const structure = parentData.map((parentItem, index) => {
              return {
                ...parentItem,
                score_field_calculated_value: 0, // Initialize score
                subHeadings: (subHeadingResponses[index]?.body?.data || []).map(
                  (subItem: any) => ({
                    ...subItem,
                    score_field_calculated_value: 0, // Initialize score
                  })
                ),
              };
            });

            // Now, merge the scores
            const flatScoreData = scoreDataResponse?.body?.data || [];
            this.scoringTableData = this.mergeScoresIntoStructure(
              structure,
              flatScoreData
            );

            console.log(
              '✅ Final Merged Scoring Data:',
              JSON.stringify(this.scoringTableData, null, 2)
            );
          },
          error: (err) => {
            console.error('❌ Error fetching sub-heading details:', err);
          },
        });
      },
      error: (err) => {
        console.error('❌ Error fetching parent scoring details:', err);
        this.scoringTableData = [];
      },
    });
  }

  private mergeScoresIntoStructure(
    structure: any[],
    flatScoreData: any[]
  ): any[] {
    // 1. Create two maps from the flat score data for easy lookup
    const parentScoreMap = new Map<number, number>(); // Key: m_rec_score_field_id
    const subItemScoreMap = new Map<number, number>(); // Key: m_rec_score_field_id

    flatScoreData.forEach((item: any) => {
      // Rule 1: If parent_id is 0, it's a main section total.
      if (item.score_field_parent_id === 0) {
        parentScoreMap.set(
          item.m_rec_score_field_id,
          item.score_field_calculated_value
        );
      }
      // Rule 2: If parent_id > 0, it's a sub-item score.
      else if (item.score_field_parent_id > 0) {
        // We sum scores in case one item appears multiple times
        const key = item.m_rec_score_field_id;
        const currentScore = subItemScoreMap.get(key) || 0;
        subItemScoreMap.set(
          key,
          currentScore + item.score_field_calculated_value
        );
      }
    });

    // 2. Loop through the structure and merge the scores
    structure.forEach((parent) => {
      // --- A. Handle Parent Scores ---
      let parentRawScore = 0;
      if (parentScoreMap.has(parent.m_rec_score_field_id)) {
        parentRawScore = parentScoreMap.get(parent.m_rec_score_field_id)!;
      }

      // ✅ LOGIC UPDATE: Cap Parent Score (Score cannot exceed Max Marks)
      const parentMaxMarks = parent.score_field_field_marks || 0;
      parent.score_field_calculated_value = Math.min(
        parentRawScore,
        parentMaxMarks
      );

      // --- B. Handle Sub-heading Scores ---
      parent.subHeadings.forEach((subItem: any) => {
        const subItemKey = subItem.m_rec_score_field_id;
        let subItemRawScore = 0;

        // Case 1: Direct match
        if (subItemScoreMap.has(subItemKey)) {
          subItemRawScore = subItemScoreMap.get(subItemKey)!;
        }
        // Case 2: Indirect match (Recursive children sum)
        else {
          for (const scoreItem of flatScoreData) {
            if (scoreItem.score_field_parent_id === subItemKey) {
              subItemRawScore += scoreItem.score_field_calculated_value;
            }
          }
        }

        // ✅ LOGIC UPDATE: Cap Sub-Item Score
        const subItemMaxMarks = subItem.score_field_field_marks || 0;
        subItem.score_field_calculated_value = Math.min(
          subItemRawScore,
          subItemMaxMarks
        );
      });
    });

    // 3. Calculate Totals based on the *Capped* values
    this.totalMaxMarks = 0;
    this.totalObtainedMarks = 0;

    structure.forEach((parent) => {
      if (parent.score_field_parent_id === 0) {
        this.totalMaxMarks += parent.score_field_field_marks || 0;
        this.totalObtainedMarks += parent.score_field_calculated_value || 0;
      }
    });

    return structure;
  }
}
