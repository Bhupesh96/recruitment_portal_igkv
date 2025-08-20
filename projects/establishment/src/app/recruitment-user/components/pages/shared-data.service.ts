import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SharedDataService {
  private formData: { [key: number]: any } = {};
  private lookupData: any = {
    countries: [],
    states: [],
    districts: [],
    languages: [],
    languageTypes: [],
    languageSkills: [],
    salutations: [],
  };

  setFormData(data: { [key: number]: any }) {
    this.formData = { ...data };
  }

  getFormData(): { [key: number]: any } {
    return this.formData;
  }

  setLookupData(data: any) {
    this.lookupData = { ...data };
  }

  getLookupData(): any {
    return this.lookupData;
  }

  clearFormData() {
    this.formData = {};
    this.lookupData = {
      countries: [],
      states: [],
      districts: [],
      languages: [],
      languageTypes: [],
      languageSkills: [],
      salutations: [],
    };
  }
}
