import { Component, OnInit } from '@angular/core';
import {
  RecruitmentStateService,
  UserRecruitmentData,
} from '../../recruitment-state.service';
import { AlertService, HttpService } from 'shared';
import { CommonModule } from '@angular/common';
import { ClaimModalComponent } from '../claim-modal/claim-modal.component';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, switchMap, map } from 'rxjs/operators';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-dawapatti',
  standalone: true,
  templateUrl: './dawapatti.component.html',
  styleUrl: './dawapatti.component.scss',
  imports: [CommonModule, ClaimModalComponent],
})
export class DawapattiComponent implements OnInit {
  applicantData: any = null; // This will hold the 'E' (Screening) record
  subjectList: any[] = [];
  applicantCategory: string = '';
  scoringTableData: any[] = [];
  totalMaxMarks: number = 0;
  totalObtainedMarks: number = 0;
  candidateAppMainId: number | null = null;

  private dropdownData = new Map<number, any[]>();
  private dropdownControlTypes = new Set([
    'D',
    'DC',
    'DE',
    'DM',
    'DP',
    'DV',
    'DY',
  ]);
  public isClaimModalVisible: boolean = false;
  public selectedItemForClaim: any = null;
  public selectedRowForClaim: any = null;
  public appliedClaimsList: any[] = [];
  private getVerifyStatusClass(status: string | null): string {
    switch (status) {
      case '1': // Verified
        // Using bg-green-50 for a subtle highlight
        return 'bg-green-100 hover:bg-green-200';
      case '2': // Rejected
        return 'bg-red-100 hover:bg-red-200';
      case '8': // Verified with Modification
        return 'bg-blue-100 hover:bg-blue-200';
      default:
        // Default row hover, no highlight
        return 'hover:bg-gray-50';
    }
  }

  constructor(
    private recruitmentState: RecruitmentStateService,
    private HTTP: HttpService,
    private sanitizer: DomSanitizer,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    const userData = this.recruitmentState.getCurrentUserData();
    if (userData?.registration_no) {
      this.candidateAppMainId = userData.a_rec_app_main_id;
      console.log(
        `✅ Stored 'C' (Candidate) app_main_id: ${this.candidateAppMainId}`
      );
      this.getApplicantData(userData.registration_no);
    } else {
      console.error('❌ No registration number found in state.');
    }
  }
  private extractAppliedClaims(nodes: any[]): any[] {
    let claims: any[] = [];
    if (!nodes || nodes.length === 0) {
      return claims;
    }

    nodes.forEach((item) => {
      // 1. Check the item's own parameter data (e.g., for Ph.D. or Research Paper entries)
      if (item.parameterData && item.parameterData.rows.length > 0) {
        const appliedRows = item.parameterData.rows.filter(
          (row: any) => row.isClaimApplied
        );

        appliedRows.forEach((row: any) => {
          claims.push({
            // e.g., "Research Publications", "Ph.D.", etc.
            itemName: item.score_field_title_name, // The specific row data (e.g., [University, Year, ...])
            rowData: row, // The headers for that row (e.g., [University, Year, ...])
            definitions: item.parameterData.definitions,
          });
        });
      } // 2. Recurse into children (e.g., for "Academic Background" group)

      if (item.subHeadings && item.subHeadings.length > 0) {
        claims = claims.concat(this.extractAppliedClaims(item.subHeadings));
      }
    });

    return claims;
  }
  onApplyClaim(item: any, row: any): void {
    console.log('Opening claim for item:', item, 'and row:', row);
    this.selectedItemForClaim = item;
    this.selectedRowForClaim = row;
    this.isClaimModalVisible = true;
  }

  public getDropdownName(queryId: number, valueId: any): string {
    if (
      !queryId ||
      queryId === 0 ||
      valueId === null ||
      valueId === undefined
    ) {
      return valueId;
    }

    const options = this.dropdownData.get(queryId);
    if (!options) {
      console.warn(`[getDropdownName] No cache data for queryId: ${queryId}`);
      return valueId;
    }

    const match = options.find((opt) => opt.data_id == valueId);
    return match ? match.data_name : valueId;
  }

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

  getFileUrl(fileName: string): SafeUrl {
    if (!fileName) {
      return this.sanitizer.bypassSecurityTrustUrl('');
    }
    const normalized = fileName
      .replace(/^services[\\/]/, '')
      .replace(/\\/g, '/');
    const url = `http://192.168.1.57:3500/${normalized}`;
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  get subjectName(): string {
    if (!this.applicantData?.subject_id || this.subjectList.length === 0) {
      return '';
    }
    const subject = this.subjectList.find(
      (s) => s.subject_id === this.applicantData.subject_id
    );
    return subject ? subject.Subject_Name_E : 'Unknown Subject';
  }

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

        if (this.applicantData.post_code) {
          this.getSubjectList(this.applicantData.post_code);
        }
        if (this.applicantData.registration_no) {
          this.getAdditionalInfo(this.applicantData.registration_no);
        }

        if (
          this.applicantData.a_rec_adv_main_id &&
          this.applicantData.registration_no &&
          this.applicantData.a_rec_app_main_id &&
          this.candidateAppMainId
        ) {
          this.getScoringDetailsAndMergeScores(
            this.applicantData.a_rec_adv_main_id,
            this.applicantData.registration_no,
            this.applicantData.a_rec_app_main_id,
            this.candidateAppMainId
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

  private getSubjectList(postCode: number): void {
    this.HTTP.getParam(
      '/master/get/getSubjectsByPost',
      { post_code: postCode },
      'recruitement'
    ).subscribe({
      next: (res) => {
        this.subjectList = res?.body?.data || [];
      },
      error: (err) => {
        console.error('❌ Error fetching subject list:', err);
        this.subjectList = [];
      },
    });
  }

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

  private processParameterValues(
    definitions: any[],
    values: any[]
  ): {
    parameterData: {
      definitions: any[];
      rows: any[];
      hasAnyClaimableRows: boolean;
    };
    totalScore: number;
  } {
    const filteredDefinitions = definitions.filter(
      (def) => def.control_type !== 'A'
    );

    // Find the 'm_rec_score_field_parameter_new_id' for the verification status (ID 68)
    const verifyStatusDef = definitions.find(
      (d) => d.m_parameter_master_id === 68
    );
    const verifyStatusParamId = verifyStatusDef
      ? verifyStatusDef.m_rec_score_field_parameter_new_id
      : null;

    // Group the flat value list by row index
    const rowsMap = new Map<number, any[]>();
    values.forEach((val: any) => {
      const rowIndex = val.parameter_row_index;
      if (!rowsMap.has(rowIndex)) {
        rowsMap.set(rowIndex, []);
      }
      rowsMap.get(rowIndex)!.push(val);
    });

    // This will now hold objects
    const dataRows: any[] = [];
    let totalItemScore = 0;
    let hasAnyClaim = false;

    // Sort by row index (e.g., 1, 2, 3...)
    const sortedRowIndices = Array.from(rowsMap.keys()).sort((a, b) => a - b);

    sortedRowIndices.forEach((rowIndex) => {
      const rowValues = rowsMap.get(rowIndex)!;

      if (rowValues.length > 0) {
        totalItemScore += rowValues[0].score_field_calculated_value || 0;
      }

      // Create a lookup map *for this row*
      const valueMap = new Map<number, { value: string; score: number }>();
      rowValues.forEach((val: any) =>
        valueMap.set(val.m_rec_score_field_parameter_new_id, {
          value: val.parameter_value,
          score: val.score_field_calculated_value || 0,
        })
      );

      // Find the status value for this specific row
      const verifyStatusValue = verifyStatusParamId
        ? valueMap.get(verifyStatusParamId)?.value ?? null
        : null;

      // Get the full record for the verification status parameter
      const verifyStatusRecord = verifyStatusParamId
        ? rowValues.find(
            (r) => r.m_rec_score_field_parameter_new_id === verifyStatusParamId
          )
        : null;

      // 🌟 1. GET THE ROW INDEX 🌟
      const paramRowIndex = verifyStatusRecord
        ? verifyStatusRecord.parameter_row_index
        : null; // Get the row index from the same record

      // Get the corresponding CSS class for the row
      const rowClass = this.getVerifyStatusClass(verifyStatusValue);

      // Check if this row should show the claim button
      const showClaim = verifyStatusValue === '2' || verifyStatusValue === '8';
      if (showClaim) {
        hasAnyClaim = true; // Set the flag for the whole table
      }

      // Map definitions to values *for this row*
      const rowData = filteredDefinitions.map((def: any) => {
        const mappedData = valueMap.get(def.m_rec_score_field_parameter_new_id);
        const originalValue = mappedData ? mappedData.value : null;

        let displayValue = originalValue;
        if (
          this.dropdownControlTypes.has(def.control_type) &&
          def.isQuery_id > 0
        ) {
          displayValue = this.getDropdownName(def.isQuery_id, originalValue);
        }

        return {
          candidate_value: displayValue,
          score: mappedData ? mappedData.score : 0,
        };
      });

      // Push the new object structure with claim button flag
      dataRows.push({
        cells: rowData,
        rowClass: rowClass,
        showClaimButton: showClaim,
        isClaimApplied: false, // ADD THIS DEFAULT STATE
        parameterRowIndex: paramRowIndex, // 2. ADD IT TO THE ROW OBJECT
      });
    });

    return {
      parameterData: {
        definitions: filteredDefinitions,
        rows: dataRows,
        hasAnyClaimableRows: hasAnyClaim,
      },
      totalScore: totalItemScore,
    };
  }

  private resolveNode(item: any): Observable<any> {
    const childrenRequest = this.HTTP.getParam(
      '/master/get/getSubHeadingByParentScoreField',
      {
        a_rec_adv_main_id: item.a_rec_adv_main_id,
        score_field_parent_id: item.m_rec_score_field_id,
        a_rec_adv_post_detail_id: item.a_rec_adv_post_detail_id,
      },
      'recruitement'
    ).pipe(
      map((res) => res?.body?.data || []),
      catchError(() => of([]))
    );

    const definitionsRequest = this.HTTP.getParam(
      '/master/get/getSubHeadingParameterByParentScoreField',
      {
        a_rec_adv_main_id: item.a_rec_adv_main_id,
        m_rec_score_field_id: item.m_rec_score_field_id,
        score_field_parent_code: item.score_field_parent_id,
        m_parameter_master2: 'Y',
      },
      'recruitement'
    ).pipe(
      map((res) => res?.body?.data || []),
      catchError(() => of([]))
    );

    return forkJoin({
      children: childrenRequest,
      definitions: definitionsRequest,
    }).pipe(
      switchMap(({ children, definitions }) => {
        const dropdownFetches = definitions
          .filter(
            (def: any) =>
              this.dropdownControlTypes.has(def.control_type) &&
              def.isQuery_id > 0 &&
              !this.dropdownData.has(def.isQuery_id)
          )
          .map((def: any) =>
            this.HTTP.getParam(
              '/master/get/getDataByQueryId',
              { query_id: def.isQuery_id },
              'recruitement'
            ).pipe(
              map((res) => ({
                queryId: def.isQuery_id,
                data: res?.body?.data || [],
              })),
              catchError(() => of({ queryId: def.isQuery_id, data: [] }))
            )
          );

        const definitionsAndDropdowns$ =
          dropdownFetches.length > 0
            ? // 🌟 THE FIX IS HERE 🌟
              forkJoin<any[]>(dropdownFetches).pipe(
                map((dropdownResults: any[]) => {
                  dropdownResults.forEach((result: any) => {
                    if (!this.dropdownData.has(result.queryId)) {
                      this.dropdownData.set(result.queryId, result.data);
                    }
                  });
                  return { children, definitions };
                })
              )
            : of({ children, definitions });

        return definitionsAndDropdowns$;
      }),
      switchMap(({ children, definitions }) => {
        // --- Case A: "University Medal" group
        if (children.length > 0 && definitions.length > 0) {
          const childValueRequests = children.map((child: any) => {
            return this.HTTP.getParam(
              '/candidate/get/getParameterValues',
              {
                registration_no: this.applicantData.registration_no,
                a_rec_app_main_id: this.candidateAppMainId,
                score_field_parent_id: child.score_field_parent_id,
                m_rec_score_field_id: child.m_rec_score_field_id,
                Application_Step_Flag_CES: 'E',
              },
              'recruitement'
            ).pipe(
              map((res) => res?.body?.data || []),
              catchError(() => of([])),
              // 🌟 CHANGED TO switchMap
              switchMap((values) => {
                const { parameterData, totalScore } =
                  this.processParameterValues(definitions, values);

                // 🌟 START: Check for existing claims
                const claimableRows = parameterData.rows.filter(
                  (r: any) => r.showClaimButton
                );

                if (claimableRows.length === 0) {
                  return of({
                    ...child,
                    subHeadings: [],
                    parameterData: parameterData,
                    score_field_calculated_value: totalScore,
                  });
                }

                const claimCheckRequests = claimableRows.map((row: any) => {
                  return this.HTTP.getParam(
                    '/candidate/get/getDawapattiDocumentAndRemark',
                    {
                      a_rec_app_main_id: this.candidateAppMainId,
                      score_field_parent_id: child.score_field_parent_id,
                      m_rec_score_field_id: child.m_rec_score_field_id,
                      parameter_row_index: row.parameterRowIndex,
                    },
                    'recruitement'
                  ).pipe(
                    map((res) => ({
                      row: row,
                      hasClaim: res?.body?.data && res.body.data.length > 0,
                    })),
                    catchError(() => of({ row: row, hasClaim: false }))
                  );
                });

                return forkJoin(claimCheckRequests).pipe(
                  map((claimResults) => {
                    claimResults.forEach((result) => {
                      if (result.hasClaim) {
                        result.row.isClaimApplied = true;
                      }
                    });

                    return {
                      ...child,
                      subHeadings: [],
                      parameterData: parameterData,
                      score_field_calculated_value: totalScore,
                    };
                  })
                );
                // 🌟 END: Check for existing claims
              })
            );
          });

          return forkJoin(childValueRequests).pipe(
            map((resolvedChildren) => ({
              ...item,
              subHeadings: resolvedChildren,
              parameterData: null,
              score_field_calculated_value: 0,
            }))
          );
        }

        // --- Case B: "Ph.D" leaf
        if (children.length === 0 && definitions.length > 0) {
          return this.HTTP.getParam(
            '/candidate/get/getParameterValues',
            {
              registration_no: this.applicantData.registration_no,
              a_rec_app_main_id: this.candidateAppMainId,
              score_field_parent_id: item.score_field_parent_id,
              m_rec_score_field_id: item.m_rec_score_field_id,
              Application_Step_Flag_CES: 'E',
            },
            'recruitement'
          ).pipe(
            map((res) => res?.body?.data || []),
            catchError(() => of([])),
            // 🌟 CHANGED TO switchMap
            switchMap((values) => {
              const { parameterData, totalScore } = this.processParameterValues(
                definitions,
                values
              );

              // 🌟 START: Check for existing claims
              const claimableRows = parameterData.rows.filter(
                (r: any) => r.showClaimButton
              );

              if (claimableRows.length === 0) {
                return of({
                  ...item,
                  subHeadings: [],
                  parameterData: parameterData,
                  score_field_calculated_value: totalScore,
                });
              }

              const claimCheckRequests = claimableRows.map((row: any) => {
                return this.HTTP.getParam(
                  '/candidate/get/getDawapattiDocumentAndRemark',
                  {
                    a_rec_app_main_id: this.candidateAppMainId,
                    score_field_parent_id: item.score_field_parent_id,
                    m_rec_score_field_id: item.m_rec_score_field_id,
                    parameter_row_index: row.parameterRowIndex,
                  },
                  'recruitement'
                ).pipe(
                  map((res) => ({
                    row: row,
                    hasClaim: res?.body?.data && res.body.data.length > 0,
                  })),
                  catchError(() => of({ row: row, hasClaim: false }))
                );
              });

              return forkJoin(claimCheckRequests).pipe(
                map((claimResults) => {
                  claimResults.forEach((result) => {
                    if (result.hasClaim) {
                      result.row.isClaimApplied = true;
                    }
                  });

                  return {
                    ...item,
                    subHeadings: [],
                    parameterData: parameterData,
                    score_field_calculated_value: totalScore,
                  };
                })
              );
              // 🌟 END: Check for existing claims
            })
          );
        }

        // --- Case C: "Group" folder
        if (children.length > 0 && definitions.length === 0) {
          const childRequests = children.map((child: any) =>
            this.resolveNode(child)
          );
          return forkJoin(childRequests).pipe(
            map((resolvedChildren) => ({
              ...item,
              subHeadings: resolvedChildren,
              parameterData: null,
              score_field_calculated_value: 0,
            }))
          );
        }

        // --- Case D: "JRF/SRF" leaf
        return of({
          ...item,
          subHeadings: [],
          parameterData: null,
          score_field_calculated_value: 0,
        });
      })
    );
  }

  private getScoringDetailsAndMergeScores(
    advertisementId: number,
    registrationNo: number,
    appMainId: number,
    candidateAppMainId: number
  ): void {
    const scoreFieldIds = [1, 8, 34, 18, 32];

    const parentRequests = scoreFieldIds.map((id) =>
      this.HTTP.getParam(
        '/master/get/getSubHeadingParameterByParentScoreField',
        {
          m_rec_score_field: 'N',
          a_rec_adv_main_id: advertisementId,
          m_rec_score_field_id: id,
        },
        'recruitement'
      ).pipe(
        map((res) => res?.body?.data[0]),
        catchError((err) => {
          console.error(`Error fetching parent ${id}`, err);
          return of(null);
        })
      )
    );

    const scoreDataRequest = this.HTTP.getParam(
      '/candidate/get/getCandidateReportCard',
      {
        Flag_CES: 'E',
        registration_no: registrationNo,
        app_main_id: candidateAppMainId,
      },
      'recruitement'
    ).pipe(
      catchError((err) => {
        console.error('❌ Error fetching scoring report card:', err);
        return of(null);
      })
    );

    forkJoin(parentRequests).subscribe({
      next: (parentData) => {
        const validParentData = parentData.filter(Boolean);
        if (validParentData.length === 0) {
          this.scoringTableData = [];
          return;
        }

        const fullStructureRequests = validParentData.map((parentItem) => {
          if (!parentItem.a_rec_adv_post_detail_id) {
            return of({
              ...parentItem,
              subHeadings: [],
              score_field_calculated_value: 0,
            });
          }
          return this.resolveNode(parentItem).pipe(
            catchError((err) => {
              console.error(
                `❌ Error resolving node for parent ${parentItem.m_rec_score_field_id}`,
                err
              );
              return of({
                ...parentItem,
                subHeadings: [],
                score_field_calculated_value: 0,
              });
            })
          );
        });

        forkJoin([forkJoin(fullStructureRequests), scoreDataRequest]).subscribe(
          {
            next: ([structure, scoreDataResponse]) => {
              const flatScoreData = scoreDataResponse?.body?.data || [];
              this.scoringTableData = this.mergeScoresIntoStructure(
                structure,
                flatScoreData
              );
              console.log(
                '✅ Final Merged Recursive Data:',
                JSON.stringify(this.scoringTableData, null, 2)
              ); // - - - 👇 ADD THIS SECTION - - - 👇 // Populate the list of already-applied claims

              this.appliedClaimsList = this.extractAppliedClaims(
                this.scoringTableData
              );
              console.log(
                '✅ Extracted Applied Claims:',
                this.appliedClaimsList
              ); // - - - 👆 END OF ADDED SECTION - - - 👆
            },
            error: (err) => {
              console.error('❌ Error fetching full scoring structure:', err);
            },
          }
        );
      },
      error: (err) => {
        console.error('❌ Error fetching parent scoring details:', err);
        this.scoringTableData = [];
      },
    });
  }

  private sumAndMergeScores(
    items: any[],
    parentScoreMap: Map<number, number>,
    itemScoreMap: Map<number, number>
  ): void {
    if (!items || items.length === 0) {
      return;
    }

    items.forEach((item: any) => {
      const itemKey = item.m_rec_score_field_id; // 1. Recurse first to get child scores calculated

      if (item.subHeadings && item.subHeadings.length > 0) {
        this.sumAndMergeScores(item.subHeadings, parentScoreMap, itemScoreMap);
      } // 2. Sum scores from children *after* they've been calculated/capped

      let totalFromChildren = 0;
      if (item.subHeadings && item.subHeadings.length > 0) {
        item.subHeadings.forEach((child: any) => {
          totalFromChildren += child.score_field_calculated_value || 0;
        });
      }

      let finalScore: number; // ✅ Get the max marks for *this* specific item
      const maxMarks = item.score_field_field_marks || 0; // Case 1: Parent Heading (e.g., "Experience", "Academic Excellence") // The API returns the final, capped score for these.

      if (item.score_field_parent_id === 0 && parentScoreMap.has(itemKey)) {
        finalScore = parentScoreMap.get(itemKey)!; // Case 2: Child Item (e.g., "As Teacher...", "Ph.D.") // The API returns the *uncapped* sum for these. We must cap it.
      } else if (item.score_field_parent_id > 0 && itemScoreMap.has(itemKey)) {
        const uncappedScore = itemScoreMap.get(itemKey)!; // ✅ APPLY THE CAP
        finalScore = Math.min(uncappedScore, maxMarks); // Case 3: Grouping Folder (e.g., "University Medal") // Its score is the sum of its children's (already capped) scores.
      } else {
        const uncappedScore =
          item.subHeadings && item.subHeadings.length > 0
            ? totalFromChildren
            : item.score_field_calculated_value || 0; // Fallback // ✅ APPLY THE CAP (Groups can also have max marks)
        finalScore = Math.min(uncappedScore, maxMarks);
      }

      item.score_field_calculated_value = finalScore;
    });
  }

  private mergeScoresIntoStructure(
    structure: any[],
    flatScoreData: any[]
  ): any[] {
    const parentScoreMap = new Map<number, number>();
    const itemScoreMap = new Map<number, number>();

    flatScoreData.forEach((item: any) => {
      const key = item.m_rec_score_field_id;
      const score = item.score_field_calculated_value || 0; // ✅ Use the item_type to distinguish

      if (
        item.item_type === 'Obtained Marks' &&
        item.score_field_parent_id === 0
      ) {
        // This is a final, capped parent score (e.g., Experience = 8)
        parentScoreMap.set(key, score);
      } else if (item.item_type === 'Scoring by Committee') {
        // This is an individual row score (e.g., 12.676 or 6.675)
        // Sum them up to get the total *uncapped* score
        itemScoreMap.set(key, (itemScoreMap.get(key) || 0) + score);
      }
    }); // This function will now correctly use the maps

    this.sumAndMergeScores(structure, parentScoreMap, itemScoreMap);

    this.totalMaxMarks = 0;
    this.totalObtainedMarks = 0; // This part remains correct, as it sums the final parent scores

    structure.forEach((parent) => {
      if (parent.score_field_parent_id === 0) {
        this.totalMaxMarks += parent.score_field_field_marks || 0;
        this.totalObtainedMarks += parent.score_field_calculated_value || 0;
      }
    });

    return structure;
  }

  handleClaimSubmit(event: any): void {
    console.log('Claim data received from modal:', event);

    // 'event' contains { remark: '...', file: File, itemData: ..., rowData: ... }

    // 1. Get all the required IDs
    const remark = event.remark;
    const file = event.file;
    const itemData = event.itemData;
    const rowData = event.rowData;

    // This is the ID we just added in Step 1
    const paramRowIndex = rowData.parameterRowIndex;

    if (!paramRowIndex) {
      console.error(
        'CRITICAL: Cannot submit claim, parameterRowIndex is missing.',
        rowData
      );
      // 🌟 USE ALERT SERVICE 🌟
      this.alertService.alert(
        true,
        'An error occurred. Could not find the row index for this claim.'
      );
      return;
    }
    if (!this.candidateAppMainId) {
      console.error(
        'CRITICAL: Cannot submit claim, candidateAppMainId is null.'
      );
      this.alertService.alert(
        true,
        'An error occurred. Candidate ID is missing.'
      );
      return;
    }
    // 2. Create a new FormData object
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('remark', remark);
    formData.append(
      'registration_no',
      this.applicantData.registration_no.toString()
    );
    formData.append('a_rec_app_main_id', this.candidateAppMainId.toString()); // 'C' record ID
    formData.append(
      'score_field_parent_id',
      itemData.score_field_parent_id.toString()
    );
    formData.append(
      'm_rec_score_field_id',
      itemData.m_rec_score_field_id.toString()
    );
    formData.append('parameter_row_index', paramRowIndex.toString());

    // 4. Call your new HTTP service
    this.HTTP.postForm(
      '/candidate/postFile/saveCandidateDawapatti',
      formData,
      'recruitement'
    ).subscribe({
      next: (res: any) => {
        // Check for a backend error message inside the successful response
        if (res?.body?.error) {
          console.error('Backend returned an error:', res.body.error);
          // 🌟 USE ALERT SERVICE 🌟
          this.alertService.alert(
            true,
            `There was an error submitting your claim: ${res.body.error}`
          );
          this.isClaimModalVisible = false; // Still close the modal
        } else {
          // This is the true success case
          console.log('Claim submitted successfully!', res?.body?.data);
          // 🌟 USE ALERT SERVICE (is_error = false) 🌟
          this.alertService.alert(false, 'Your claim has been submitted.');
          this.isClaimModalVisible = false;

          // 🌟 ADD THIS to update the UI instantly 🌟
          if (event.rowData) {
            event.rowData.isClaimApplied = true;
          }
          this.appliedClaimsList = this.extractAppliedClaims(
            this.scoringTableData
          );
        }
      },
      error: (err) => {
        // This catches network errors or 500-level server crashes
        console.error('Error submitting claim:', err);
        // 🌟 USE ALERT SERVICE 🌟
        this.alertService.alert(
          true,
          'There was a server error submitting your claim.'
        );
        this.isClaimModalVisible = false;
      },
    });
  }

  /**
   * Called when the modal emits (closeModal) or "Cancel" is clicked.
   */
  handleClaimCancel(): void {
    this.isClaimModalVisible = false;
    this.selectedItemForClaim = null;
    this.selectedRowForClaim = null;
  }
}
