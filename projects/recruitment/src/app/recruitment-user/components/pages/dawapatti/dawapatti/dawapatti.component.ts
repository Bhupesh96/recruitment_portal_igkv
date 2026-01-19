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

  private dropdownData = new Map<string, any[]>();
  private hasSRecord: boolean = false;

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

  public getDropdownName(
    queryId: number,
    valueId: any,
    rootParentId: number = 0
  ): string {
    if (
      !queryId ||
      queryId === 0 ||
      valueId === null ||
      valueId === undefined
    ) {
      return valueId;
    }

    // 🌟 Construct Key: If 259, append the parent ID. Otherwise, use simple query ID.
    let cacheKey = queryId.toString();
    if (queryId === 259 && rootParentId > 0) {
      cacheKey = `${queryId}_${rootParentId}`;
    }

    const options = this.dropdownData.get(cacheKey);
    if (!options) {
      // console.warn(`[getDropdownName] No cache data for key: ${cacheKey}`);
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
    values: any[],
    rootParentId: number // 🌟 ADDED: 3rd Argument to match the call in resolveNode
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

    const statusMasterId = this.hasSRecord ? 3 : 68;

    const verifyStatusDef = definitions.find(
      (d) => d.m_parameter_master_id === statusMasterId
    );
    const verifyStatusParamId = verifyStatusDef
      ? verifyStatusDef.m_rec_score_field_parameter_new_id
      : null;

    const rowsMap = new Map<number, any[]>();
    values.forEach((val: any) => {
      const rowIndex = val.parameter_row_index;
      if (!rowsMap.has(rowIndex)) {
        rowsMap.set(rowIndex, []);
      }
      rowsMap.get(rowIndex)!.push(val);
    });

    const dataRows: any[] = [];
    let totalItemScore = 0;
    let hasAnyClaim = false;

    const sortedRowIndices = Array.from(rowsMap.keys()).sort((a, b) => a - b);

    sortedRowIndices.forEach((rowIndex) => {
      const rowValues = rowsMap.get(rowIndex)!;

      if (rowValues.length > 0) {
        totalItemScore += rowValues[0].score_field_calculated_value || 0;
      }

      const valueMap = new Map<number, { value: string; score: number }>();
      rowValues.forEach((val: any) =>
        valueMap.set(val.m_rec_score_field_parameter_new_id, {
          value: val.parameter_value,
          score: val.score_field_calculated_value || 0,
        })
      );

      const verifyStatusValue = verifyStatusParamId
        ? valueMap.get(verifyStatusParamId)?.value ?? null
        : null;

      const verifyStatusRecord = verifyStatusParamId
        ? rowValues.find(
            (r) => r.m_rec_score_field_parameter_new_id === verifyStatusParamId
          )
        : null;

      const paramRowIndex = verifyStatusRecord
        ? verifyStatusRecord.parameter_row_index
        : null;

      const rowClass = this.getVerifyStatusClass(verifyStatusValue);

      const showClaim = verifyStatusValue === '2' || verifyStatusValue === '8';
      if (showClaim) {
        hasAnyClaim = true;
      }

      const rowData = filteredDefinitions.map((def: any) => {
        const mappedData = valueMap.get(def.m_rec_score_field_parameter_new_id);
        const originalValue = mappedData ? mappedData.value : null;

        let displayValue = originalValue;

        // Check for standard dropdown types OR specific master IDs (68, 4)
        const isStandardDropdown = this.dropdownControlTypes.has(
          def.control_type
        );
        const isSpecialDropdown =
          def.m_parameter_master_id === 68 || def.m_parameter_master_id === 4;

        if ((isStandardDropdown || isSpecialDropdown) && def.isQuery_id > 0) {
          // 🌟 UPDATED: Pass rootParentId to get the correct list for this section
          displayValue = this.getDropdownName(
            def.isQuery_id,
            originalValue,
            rootParentId
          );
        }

        return {
          candidate_value: displayValue,
          score: mappedData ? mappedData.score : 0,
        };
      });

      dataRows.push({
        cells: rowData,
        rowClass: rowClass,
        showClaimButton: showClaim,
        isClaimApplied: false,
        parameterRowIndex: paramRowIndex,
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
  private resolveNode(item: any, rootParentId: number): Observable<any> {
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
      this.hasSRecord
        ? {
            a_rec_adv_main_id: item.a_rec_adv_main_id,
            m_rec_score_field_id: item.m_rec_score_field_id,
            score_field_parent_code: item.score_field_parent_id,
            m_parameter_master3: 'Y', // Fetch S definitions (Verify Status/Remark)
          }
        : {
            a_rec_adv_main_id: item.a_rec_adv_main_id,
            m_rec_score_field_id: item.m_rec_score_field_id,
            score_field_parent_code: item.score_field_parent_id,
            m_parameter_master2: 'Y', // Fetch E definitions
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
          .filter((def: any) => {
            const isStandardDropdown = this.dropdownControlTypes.has(
              def.control_type
            );
            // Check for specific IDs that need dropdowns (e.g. Verify Status/Remark)
            const isSpecialDropdown =
              def.m_parameter_master_id === 68 ||
              def.m_parameter_master_id === 4;

            // 1. Determine Cache Key
            let cacheKey = def.isQuery_id.toString();
            // If it's the Remark dropdown (259), make the key specific to the Parent Section
            if (def.isQuery_id === 259 && rootParentId > 0) {
              cacheKey = `${def.isQuery_id}_${rootParentId}`;
            }

            // 2. Check if we already have this specific data cached
            return (
              (isStandardDropdown || isSpecialDropdown) &&
              def.isQuery_id > 0 &&
              !this.dropdownData.has(cacheKey)
            );
          })
          .map((def: any) => {
            // 3. Prepare API Params
            const params: any = { query_id: def.isQuery_id };
            let cacheKey = def.isQuery_id.toString();

            // 4. Inject Parent ID for Query 259
            if (def.isQuery_id === 259 && rootParentId > 0) {
              params['Score_Field_Parent_Id'] = rootParentId;
              cacheKey = `${def.isQuery_id}_${rootParentId}`;
            }

            return this.HTTP.getParam(
              '/master/get/getDataByQueryId',
              params,
              'recruitement'
            ).pipe(
              map((res) => ({
                cacheKey: cacheKey, // Return the key so we know where to store it
                data: res?.body?.data || [],
              })),
              catchError(() => of({ cacheKey: cacheKey, data: [] }))
            );
          });

        const definitionsAndDropdowns$ =
          dropdownFetches.length > 0
            ? forkJoin<any[]>(dropdownFetches).pipe(
                map((dropdownResults: any[]) => {
                  dropdownResults.forEach((result: any) => {
                    // 5. Store using the composite key
                    if (!this.dropdownData.has(result.cacheKey)) {
                      this.dropdownData.set(result.cacheKey, result.data);
                    }
                  });
                  return { children, definitions };
                })
              )
            : of({ children, definitions });

        return definitionsAndDropdowns$;
      }),
      switchMap(({ children, definitions }) => {
        // Define the flag based on record existence
        const stepFlag = this.hasSRecord ? 'S' : 'E';

        // --- Case A: "University Medal" group (Mixed children and values)
        if (children.length > 0 && definitions.length > 0) {
          const childValueRequests = children.map((child: any) => {
            return this.HTTP.getParam(
              '/candidate/get/getParameterValues',
              {
                registration_no: this.applicantData.registration_no,
                a_rec_app_main_id: this.candidateAppMainId,
                score_field_parent_id: child.score_field_parent_id,
                m_rec_score_field_id: child.m_rec_score_field_id,
                Application_Step_Flag_CES: stepFlag,
              },
              'recruitement'
            ).pipe(
              map((res) => res?.body?.data || []),
              catchError(() => of([])),
              switchMap((values) => {
                // Pass rootParentId to process values for correct dropdown lookup
                const { parameterData, totalScore } =
                  this.processParameterValues(
                    definitions,
                    values,
                    rootParentId
                  );

                // Start Claim Check Logic
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
                // End Claim Check Logic
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

        // --- Case B: "Ph.D" leaf (Direct values)
        if (children.length === 0 && definitions.length > 0) {
          return this.HTTP.getParam(
            '/candidate/get/getParameterValues',
            {
              registration_no: this.applicantData.registration_no,
              a_rec_app_main_id: this.candidateAppMainId,
              score_field_parent_id: item.score_field_parent_id,
              m_rec_score_field_id: item.m_rec_score_field_id,
              Application_Step_Flag_CES: stepFlag,
            },
            'recruitement'
          ).pipe(
            map((res) => res?.body?.data || []),
            catchError(() => of([])),
            switchMap((values) => {
              // Pass rootParentId to process values
              const { parameterData, totalScore } = this.processParameterValues(
                definitions,
                values,
                rootParentId
              );

              // Start Claim Check Logic
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
              // End Claim Check Logic
            })
          );
        }

        // --- Case C: "Group" folder (Recursive children)
        if (children.length > 0 && definitions.length === 0) {
          const childRequests = children.map(
            (child: any) => this.resolveNode(child, rootParentId) // Pass rootParentId recursively
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

        // --- Case D: Empty leaf
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

    // 1. Prepare Parent Requests (Top Level Headings)
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

    // 2. Prepare Score Data Request (Determines S vs E and sets the global Flag)
    const scoreDataRequest = this.HTTP.getParam(
      '/candidate/get/getCandidateReportCard',
      {
        Flag_CES: 'S', // Try S first
        registration_no: registrationNo,
        app_main_id: candidateAppMainId,
      },
      'recruitement'
    ).pipe(
      catchError(() => of(null)),
      switchMap((res: any) => {
        const data = res?.body?.data;
        if (data && data.length > 0) {
          console.log(
            '✅ Found S Record. Switching to m_parameter_master3 mode.'
          );
          this.hasSRecord = true; // ✅ Flag set TRUE
          return of(res);
        }

        // ❗ No S data → call E
        console.log('⚠️ No S Record. Using E mode.');
        this.hasSRecord = false; // ✅ Flag set FALSE
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

    // 3. EXECUTE: First fetch ScoreData (to set flag), THEN fetch Structure
    forkJoin({
      scoreResponse: scoreDataRequest,
      parentData: forkJoin(parentRequests),
    })
      .pipe(
        // 4. The switchMap waits for step 2 to finish.
        // Now `this.hasSRecord` is guaranteed to be correct before resolveNode is called.
        switchMap(({ scoreResponse, parentData }) => {
          const validParentData = parentData.filter(Boolean);
          if (validParentData.length === 0) {
            this.scoringTableData = [];
            return of({ structure: [], scoreResponse });
          }

          const fullStructureRequests = validParentData.map((parentItem) => {
            if (!parentItem.a_rec_adv_post_detail_id) {
              return of({
                ...parentItem,
                subHeadings: [],
                score_field_calculated_value: 0,
              });
            }

            // 🌟 PASS THE PARENT ID (e.g., 1, 8, 34)
            // parentItem.m_rec_score_field_id is the loop variable ID (1, 8, etc.)
            return this.resolveNode(
              parentItem,
              parentItem.m_rec_score_field_id
            ).pipe(
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
          return forkJoin(fullStructureRequests).pipe(
            map((structure) => ({ structure, scoreResponse }))
          );
        })
      )
      .subscribe({
        next: ({ structure, scoreResponse }) => {
          const flatScoreData = scoreResponse?.body?.data || [];

          this.scoringTableData = this.mergeScoresIntoStructure(
            structure,
            flatScoreData
          );

          console.log(
            '✅ Final Merged Recursive Data:',
            JSON.stringify(this.scoringTableData, null, 2)
          );

          // Populate the list of already-applied claims
          this.appliedClaimsList = this.extractAppliedClaims(
            this.scoringTableData
          );

          console.log('✅ Extracted Applied Claims:', this.appliedClaimsList);
        },
        error: (err) => {
          console.error('❌ Error fetching full scoring structure:', err);
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
    formData.append('dawapatti_applied_after_ES', this.hasSRecord ? 'S' : 'E');
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
            `There was an error submitting your claim`
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
