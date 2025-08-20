import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { apiPort } from 'environment';
import { throwError } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class HttpService {
  private readonly httpOptions: any = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    observe: 'response',
    withCredentials: true,
  };
  private readonly getOptions: any = {
    observe: 'response',
    withCredentials: true,
  };
  protected currentDate: string;
  private cleanArray: any = (str: any) => {
    return str
      .split(/[\n,]/)
      .map((item: any) => item.trim())
      .filter((item: any) => item.length > 0);
  };

  baseUrl(type: string): any {
    return apiPort[type.includes('Api') ? type : type + 'Api'];
  }

  constructor(private http: HttpClient, private datePipe: DatePipe) {
    this.currentDate = this.formatCurrentDate(new Date());
  }

  private formatCurrentDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-4);
    return `${day}-${month}-${year}`;
  }

  private handleError(e: any) {
    return throwError(() => e);
  }

  getData(url: string, type: string = 'common'): Observable<any> {
    return this.http.get(this.baseUrl(type) + url, this.getOptions).pipe(
      map((res) => res),
      catchError(this.handleError)
    );
  }

  postData(url: string, data: any, type: string = 'common'): Observable<any> {
    return this.http
      .post(this.baseUrl(type) + url, data, this.httpOptions)
      .pipe(
        map((res) => res),
        catchError(this.handleError)
      );
  }

  postForm(url: string, data: any, type: string = 'common'): Observable<any> {
    return this.http
      .post(this.baseUrl(type) + url, data, {
        observe: 'response',
        withCredentials: true,
      })
      .pipe(
        map((res) => {
          return res;
        }),
        catchError((e) => {
          throw new Error(e);
        })
      );
  }

  postFile(url: string, data: any, type: string = 'common'): Observable<any> {
    return this.http
      .post(this.baseUrl(type) + url, data, {
        reportProgress: true,
        observe: 'events',
        withCredentials: true,
      })
      .pipe(
        map((res: any) => {
          return res;
        }),
        catchError((e) => {
          return of(e); // Use `of()` to wrap the error as an observable
        })
      );
  }

  putData(url: string, data: any, type: string = 'common'): Observable<any> {
    return this.http.put(this.baseUrl(type) + url, data, this.httpOptions).pipe(
      map((res) => {
        return res;
      }),
      catchError((e) => {
        return of(e); // Use `of()` to wrap the error as an observable
      })
    );
  }

  deleteData(
    url: string,
    params: any,
    type: string = 'common'
  ): Observable<any> {
    return this.http
      .delete(this.baseUrl(type) + url, {
        params: params,
        observe: 'response',
        withCredentials: true,
      })
      .pipe(
        map((res) => {
          return res;
        }),
        catchError((e) => {
          return of(e); // Use `of()` to wrap the error as an observable
        })
      );
  }

  getParam(url: string, params: any, type: string = 'common'): Observable<any> {
    return this.http
      .get(this.baseUrl(type) + url, {
        params: params,
        observe: 'response',
        withCredentials: true,
      })
      .pipe(
        map((res) => res),
        catchError(this.handleError)
      );
  }

  postBlob(
    url: string,
    data: any,
    filename: string | null = null,
    type: string = 'common'
  ): Observable<any> {
    console.log('blob called');
    return this.http
      .post(this.baseUrl(type) + url, data, {
        reportProgress: true,
        responseType: 'blob',
        observe: 'response',
        withCredentials: true,
      })
      .pipe(
        map((res: HttpResponse<any>) => {
          this.handlePdfResponse(res, filename);
          return res;
        }),
        catchError((e) => {
          return of(e); // Use `of()` to wrap the error as an observable
        })
      );
  }

  private handlePdfResponse(response: any, name: string | null) {
    let file_name: string = 'response.pdf';
    if (name) {
      file_name = name;
    } else {
      const contentDispositionHeader = response.headers.get(
        'Content-Disposition'
      );
      if (contentDispositionHeader) {
        const matches = contentDispositionHeader.match(/filename="([^"]+)"/);
        if (matches && matches[1]) {
          file_name = matches[1];
        }
      }
    }
    const file_name_with_date = this.appendDateToFilename(
      file_name,
      this.currentDate
    );
    console.log(file_name_with_date);
    const blob = new Blob([response.body], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file_name_with_date;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private appendDateToFilename(filename: string, date: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // No extension found
      return `${filename}_${date}`;
    }
    const name = filename.substring(0, lastDotIndex);
    const extension = filename.substring(lastDotIndex);
    return `${name}_${date}${extension}`;
  }

  convertDate(datetime: any) {
    return this.datePipe.transform(datetime, 'yyyy-MM-dd');
  }

  checkTypeAndSplit(input: any) {
    return typeof input == 'string' ? this.cleanArray(input) : input;
  }

  checkTypeAndSplitNumber(input: any) {
    if (!input) return [];
    let data: any;
    data = typeof input == 'string' ? this.cleanArray(input) : input;
    data = data.map((item: any) => +item);
    return data;
  }
}
