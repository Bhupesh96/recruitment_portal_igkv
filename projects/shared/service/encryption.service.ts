import {Injectable} from '@angular/core';
import CryptoJS from 'crypto-js';
import {environment} from "../../environments/environment.dev";

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  private secretKey = environment.PASSWORD_SECRET_KEY;

  constructor() {
  }

  encrypt(value: string): string {
    return CryptoJS.AES.encrypt(JSON.stringify(value), this.secretKey).toString();
  }

  decrypt(value: string): any | null {
    const bytes = CryptoJS.AES.decrypt(value, this.secretKey);
    try {
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (e) {
      return null
    }

  }
}
