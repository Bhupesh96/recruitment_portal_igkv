import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpService } from 'shared';
@Injectable({
  providedIn: 'root',
})
export class Step1Service {
  // private apiUrl = 'http://192.168.1.52:3000/api/get-applicant'; // your backend endpoint
  postList: any[] = [];

  constructor(private http: HttpClient, private HTTP: HttpService) {}

  //get data through session after login
  getUserData(): Observable<any> {
    const registrationNo = 24000001; // 🔒 Hardcoded for now
    return this.HTTP.getParam(
      '/master/get/getApplicant',
      { registration_no: registrationNo },
      'recruitement'
    );
  }

  getSalutations() {
    return this.http.get<any[]>('http://192.168.1.52:3000/form/get-salutation');
  }
  getSubjectsByPostCode(
    postCode: number
  ): Observable<{ subject_id: number; Subject_Name_E: string }[]> {
    return this.HTTP.getParam(
      '/master/get/getSubjectsByPost',
      { post_code: postCode },
      'recruitement'
    );
  }
  getReligions() {
    return this.HTTP.getParam(
      '/master/get/getReligionCode',
      {},
      'recruitement'
    );
  }

  getCountries() {
    return this.HTTP.getParam('/master/get/getCountryList', {}, 'recruitement');
  }

  getStates() {
    return this.HTTP.getParam('/master/get/getStateList', {}, 'recruitement');
  }
  // getAdvertisement() {
  //   return this.HTTP.getParam(
  //     '/master/get/getAdvertismentDetails',
  //     {},
  //     'recruitement'
  //   );
  // }
  getPostByAdvertisement(
    advertisementId: number
  ): Observable<{ a_rec_adv_main_id: number; advertisment_name: string }[]> {
    return this.HTTP.getParam(
      '/master/get/getPostByAdvertiment',
      { a_rec_adv_main_id: advertisementId },
      'recruitement'
    );
  }
  getDistrictsByState(
    stateId: number
  ): Observable<{ district_id: number; name: string }[]> {
    return this.HTTP.getParam(
      '/master/get/getDistrictsByState',
      { state_id: stateId },
      'recruitement'
    );
  }

  // 🔹 Get all language types
  getLanguageTypes() {
    return this.HTTP.getParam(
      '/master/get/getLanguageType',
      {},
      'recruitement'
    );
  }

  // 🔹 Get all languages
  getLanguages() {
    return this.HTTP.getParam('/master/get/getLanguages', {}, 'recruitement');
  }

  // 🔹 Get all language skills
  getLanguageSkills() {
    return this.HTTP.getParam(
      '/master/get/getLanguagesSkill',
      {},
      'recruitement'
    );
  }

  // 🔹 Save language details array
  // saveLanguages(languageDetails: any[]): Observable<any> {
  //   return this.http.post(
  //     'http://192.168.1.52:3000/form/save-languages',
  //     languageDetails
  //   );
  // }
  getSavedLanguages() {
    const registrationNo = 24000001;
    return this.HTTP.getParam(
      '/master/get/getLanguagesByRegistration',
      { registration_no: registrationNo },
      'recruitement'
    );
  }
  // uploadPhotoAndSignature(
  //   photoFile: File,
  //   signatureFile: File
  // ): Observable<any> {
  //   const formData = new FormData();
  //   formData.append('photo', photoFile);
  //   formData.append('signature', signatureFile);

  //   return this.http.post(
  //     'http://192.168.1.52:3000/form/upload-files',
  //     formData
  //   );
  // }

  saveStep1Data(payload: any) {
    return this.http.post(
      'http://192.168.1.52:3000/api/saveApplicant',
      payload
    );
  }
  saveCandidateDetail(
    payload: any,
    table = 'a_rec_app_main',
    db = 'igkv_Recruitment'
  ) {
    const body = { ...payload, table_name: table, database_name: db };
    return this.HTTP.postData(
      '/master/post/saveCandidateDetail',
      body,
      'recruitement'
    );
  }
  updateCandidateDetail(
    payload: any,
    table: string = 'a_rec_app_main',
    db: string = 'igkv_Recruitment'
  ) {
    const body = { ...payload, table_name: table, database_name: db };
    return this.HTTP.putData(
      '/master/update/updateCandidateDetail',
      body,
      'recruitement'
    );
  }

  //  this.HTTP.postData('/scorecardentry/post/saveAdvertisementDetail', formData, 'recruitement').subscribe(res => {
  //     if (!res.body.error) {
  //       this.alert.alertMessage("Record Inserted...!", "", "success");
  //     } else {
  //       this.alert.alertMessage("Something went wrong!", res.body.error?.message, "warning");
  //     }
  //   });
}
