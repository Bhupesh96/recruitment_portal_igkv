import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  getItem(key: string): string | null {
    return this.isBrowser ? globalThis.localStorage.getItem(key) : null;
  }

  setItem(key: string, value: string): void {
    if (this.isBrowser) {
      globalThis.localStorage.setItem(key, value);
    }
  }

  removeItem(key: string): void {
    if (this.isBrowser) {
      globalThis.localStorage.removeItem(key);
    }
  }

  clear(): void {
    if (this.isBrowser) {
      globalThis.localStorage.clear();
    }
  }
  getAllKeys(): string[] {
    if (!this.isBrowser) {
      return [];
    }

    const keys: string[] = [];

    for (let i = 0; i < globalThis.localStorage.length; i++) {
      const key = globalThis.localStorage.key(i);

      if (key !== null) {
        keys.push(key);
      }
    }

    return keys;
  }

  getAll(): Record<string, string | null> {
    if (!this.isBrowser) {
      return {};
    }

    const data: Record<string, string | null> = {};

    for (let i = 0; i < globalThis.localStorage.length; i++) {
      const key = globalThis.localStorage.key(i);

      if (key !== null) {
        data[key] = globalThis.localStorage.getItem(key);
      }
    }

    return data;
  }
}
