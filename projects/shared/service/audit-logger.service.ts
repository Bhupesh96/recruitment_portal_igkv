import {Injectable, OnDestroy} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse} from '@angular/common/http';
import {NavigationEnd, Router} from '@angular/router';
import {filter, Observable, Subscription, tap} from 'rxjs';
import {HttpService} from './http.service';

@Injectable({providedIn: 'root'})
export class AuditLoggerService implements OnDestroy {
  private routerSubscription?: Subscription;
  private appName = 'public';
  private readonly originalValues = new WeakMap<Element, string>();
  private readonly pendingChanges = new Map<Element, string>();
  private readonly runtimeErrorHandler = (event: ErrorEvent): void => {
    this.logError('CLIENT_ERROR', event.message || 'Unhandled client error', {
      source: event.filename || null,
      line: event.lineno || null,
    });
  };
  private readonly rejectionHandler = (event: PromiseRejectionEvent): void => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || 'Unhandled promise rejection');
    this.logError('CLIENT_ERROR', reason);
  };
  private readonly focusHandler = (event: FocusEvent): void => {
    const control = this.getTrackedControl(event.target);
    if (control) this.originalValues.set(control, this.getControlValue(control));
  };
  private readonly changeHandler = (event: Event): void => {
    this.trackFieldChange(event.target);
  };
  private readonly inputHandler = (event: Event): void => {
    this.trackFieldChange(event.target);
  };
  private recordFieldChange(control: Element): void {
    const label = this.getControlLabel(control);
    const context = this.getAuditContext(control, label);
    const heading = context ? `${context} > ${label}` : label;
    const previousValue = this.originalValues.get(control) ?? '';
    const currentValue = this.getControlValue(control);
    if (previousValue === currentValue) return;
    const valuesAreSensitive = this.isSensitiveControl(control);
    this.log('FIELD_CHANGE', {
      button_key: this.getControlKey(control),
      action_label: valuesAreSensitive
        ? `${heading}: value changed`
        : `${heading}: "${this.displayValue(previousValue)}" to "${this.displayValue(currentValue)}"`,
      route_path: this.router.url,
      meta_json: JSON.stringify({
        section_context: context || null,
        field_label: label,
        previous_value: valuesAreSensitive ? '[REDACTED]' : previousValue,
        new_value: valuesAreSensitive ? '[REDACTED]' : currentValue,
      }),
    });
    this.originalValues.set(control, currentValue);
  }
  private readonly submitHandler = (event: SubmitEvent): void => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form) return;
    this.scanCustomSelects(form);
    this.flushPendingChanges(form);

    this.log('FORM_SUBMIT', {
      button_key: form.id ? `#${form.id}` : form.getAttribute('name') || 'form',
      action_label: form.getAttribute('aria-label') || form.getAttribute('name') || 'Form submitted',
      route_path: this.router.url,
    });
  };
  private readonly clickHandler = (event: MouseEvent): void => {
    const fieldControl = this.getTrackedControl(event.target);
    if (fieldControl) {
      if (fieldControl.matches('app-select, ng-select') && !this.originalValues.has(fieldControl)) {
        this.originalValues.set(fieldControl, this.getControlValue(fieldControl));
      }
      return;
    }

    const target = event.target instanceof Element
      ? event.target.closest('button, a, input[type="button"], input[type="submit"]')
      : null;
    if (!target) return;

    const actionLabel = this.getControlLabel(target);
    if (/save|submit|continue/i.test(actionLabel)) {
      this.scanCustomSelects();
      this.flushPendingChanges();
    }
    this.log('BUTTON_CLICK', {
      button_key: this.getControlKey(target),
      action_label: actionLabel,
      route_path: this.router.url,
    });
  };

  constructor(
    private router: Router,
    private http: HttpService,
  ) {}

  start(appName = 'public'): void {
    if (this.routerSubscription) return;
    this.appName = appName;

    this.log('PAGE_VIEW', {route_path: this.router.url});
    document.addEventListener('click', this.clickHandler, true);
    document.addEventListener('focusin', this.focusHandler, true);
    document.addEventListener('input', this.inputHandler, true);
    document.addEventListener('change', this.changeHandler, true);
    document.addEventListener('submit', this.submitHandler, true);
    window.addEventListener('error', this.runtimeErrorHandler);
    window.addEventListener('unhandledrejection', this.rejectionHandler);

    this.routerSubscription = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ).subscribe((event) => {
      this.log('PAGE_VIEW', {route_path: event.urlAfterRedirects});
    });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    document.removeEventListener('click', this.clickHandler, true);
    document.removeEventListener('focusin', this.focusHandler, true);
    document.removeEventListener('input', this.inputHandler, true);
    document.removeEventListener('change', this.changeHandler, true);
    document.removeEventListener('submit', this.submitHandler, true);
    window.removeEventListener('error', this.runtimeErrorHandler);
    window.removeEventListener('unhandledrejection', this.rejectionHandler);
  }

  logApiCall(request: HttpRequest<unknown>): void {
    if (request.url.includes('/audit/post/logClientEvent') || !/\/\w+Api(?:\/|$)/.test(request.url)) {
      return;
    }

    let apiPath = request.url;
    try {
      apiPath = new URL(request.url, window.location.origin).pathname;
    } catch {
      // Use the request URL when it cannot be normalized.
    }

    this.log('API_CALL', {
      button_key: request.method,
      action_label: `${request.method} ${apiPath}`,
      route_path: this.router.url,
    });
  }

  flushPendingChangesForSave(): void {
    this.scanCustomSelects();
    this.flushPendingChanges();
  }

  logError(eventType: 'VALIDATION_ERROR' | 'API_ERROR' | 'CLIENT_ERROR' | 'AUTHENTICATION_FAILURE', message: string, meta: Record<string, unknown> = {}): void {
    this.log(eventType, {
      button_key: eventType,
      action_label: message,
      route_path: this.router.url,
      meta_json: JSON.stringify(meta),
    });
  }

  logApiSuccess(request: HttpRequest<unknown>, status: number): void {
    this.log('API_SUCCESS', {
      button_key: request.method,
      action_label: `${request.method} ${request.url} succeeded`,
      route_path: this.router.url,
      meta_json: JSON.stringify({status}),
    });
  }

  private log(eventType: string, event: Record<string, string | null>): void {
    this.http.postData('/audit/post/logClientEvent', {
      event_type: eventType,
      app_name: this.appName,
      ...event,
    }, 'admin').subscribe();
  }

  private trackFieldChange(target: EventTarget | null): void {
    const control = this.getTrackedControl(target);
    if (!control || this.isIgnoredControl(control)) return;

    const previousValue = this.originalValues.get(control);
    const currentValue = this.getControlValue(control);
    if (previousValue === undefined) {
      this.originalValues.set(control, currentValue);
      return;
    }
    if (previousValue === currentValue) {
      this.pendingChanges.delete(control);
      return;
    }
    this.pendingChanges.set(control, previousValue);
  }

  private flushPendingChanges(form?: HTMLFormElement): void {
    for (const [control, previousValue] of this.pendingChanges.entries()) {
      if (form && control.closest('form') !== form) continue;
      this.originalValues.set(control, previousValue);
      this.recordFieldChange(control);
      this.pendingChanges.delete(control);
    }
  }

  private scanCustomSelects(form?: HTMLFormElement): void {
    document.querySelectorAll('app-select, ng-select').forEach((control) => {
      if (form && control.closest('form') !== form) return;
      const previousValue = this.originalValues.get(control);
      const currentValue = this.getControlValue(control);
      if (previousValue === undefined) {
        this.originalValues.set(control, currentValue);
      } else if (previousValue !== currentValue) {
        this.pendingChanges.set(control, previousValue);
      }
    });
  }

  private getControlKey(control: Element): string {
    const auditKey = control.getAttribute('data-audit');
    if (auditKey) return auditKey;
    if (control.id) return `#${control.id}`;

    const name = control.getAttribute('name');
    if (name) return `${control.tagName.toLowerCase()}[name="${name}"]`;

    const href = control.getAttribute('href');
    if (href) return href;

    const classes = Array.from(control.classList).slice(0, 3).join('.');
    return classes ? `${control.tagName.toLowerCase()}.${classes}` : control.tagName.toLowerCase();
  }

  private getControlLabel(control: Element): string {
    const nativeControl = control as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const isRadio = nativeControl instanceof HTMLInputElement && nativeControl.type === 'radio';
    const associatedLabel = isRadio ? undefined : Array.from(nativeControl.labels || [])
      .map((label) => label.textContent?.replace(/\s+/g, ' ').trim())
      .find(Boolean);
    const nearbyLabel = this.getWrappingLabel(control, isRadio);
    const tableHeader = this.getTableHeader(control);
    const label = [
      associatedLabel,
      tableHeader,
      nearbyLabel,
      control.getAttribute('data-audit-label'),
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      control.textContent?.replace(/\s+/g, ' ').trim(),
    ].find((value) => !!value?.trim());

    return label?.trim() || this.getControlKey(control);
  }

  private getWrappingLabel(control: Element, ignoreRadioOptionLabels = false): string | undefined {
    let wrapper = control.parentElement;
    while (wrapper && wrapper.tagName !== 'FORM') {
      if (wrapper.querySelector('form')) {
        break;
      }
      const label = Array.from(wrapper.querySelectorAll('label'))
        .find((candidate) => !ignoreRadioOptionLabels || !candidate.querySelector('input[type="radio"]'))
        ?.textContent?.replace(/\s+/g, ' ').trim();
      if (label) return label;
      wrapper = wrapper.parentElement;
    }
    return undefined;
  }

  private getTableHeader(control: Element): string | undefined {
    const cell = control.closest('td');
    const row = cell?.parentElement;
    const table = cell?.closest('table');
    if (!cell || !row || !table) return undefined;

    const cellIndex = Array.from(row.children).indexOf(cell);
    if (cellIndex < 0) return undefined;
    return table.querySelectorAll('thead tr:last-child th')[cellIndex]
      ?.textContent?.replace(/\s+/g, ' ').trim();
  }

  private getControlValue(control: Element): string {
    if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) {
      return String(control.checked);
    }
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
      return control.value;
    }
    return control.matches('app-select, ng-select')
      ? control.textContent?.replace(/\s+/g, ' ').trim() || ''
      : '';
  }

  private getTrackedControl(target: EventTarget | null): Element | null {
    if (!(target instanceof Element)) return null;
    const customSelect = target.closest('app-select, ng-select');
    if (customSelect) return customSelect;
    return target.closest('input, select, textarea');
  }

  private getAuditContext(control: Element, fieldLabel: string): string {
    const context: string[] = [];
    let current: Element | null = control.parentElement;

    while (current) {
      const explicitLabel = current.getAttribute('data-audit-section')
        || current.getAttribute('data-audit-group')
        || current.getAttribute('data-audit-subheading');
      const heading = explicitLabel
        || current.querySelector(':scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > .card-title, :scope > .accordion-button')
          ?.textContent?.replace(/\s+/g, ' ').trim();

      if (heading && heading !== fieldLabel && !context.includes(heading)) {
        context.unshift(heading);
      }
      if (current.tagName === 'FORM') break;
      current = current.parentElement;
    }

    return context.join(' > ');
  }

  private isSensitiveControl(control: Element): boolean {
    if (control.getAttribute('data-audit-sensitive') === 'true') return true;
    if (control instanceof HTMLInputElement && ['file', 'hidden', 'password'].includes(control.type)) return true;
    const identifier = `${control.id} ${control.getAttribute('name') || ''}`.toLowerCase();
    return /password|token|secret|otp|aadhar|aadhaar|pan|email|mobile|phone/.test(identifier);
  }

  private isIgnoredControl(control: Element): boolean {
    const identifier = `${control.id} ${control.getAttribute('name') || ''} ${control.getAttribute('formcontrolname') || ''}`.toLowerCase();
    return /captcha/.test(identifier);
  }

  private displayValue(value: string): string {
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  }
}

@Injectable()
export class AuditHttpInterceptor implements HttpInterceptor {
  constructor(private auditLogger: AuditLoggerService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (request.url.includes('/audit/post/logClientEvent')) {
      return next.handle(request);
    }
    this.auditLogger.logApiCall(request);
    return next.handle(request).pipe(tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          this.auditLogger.logApiSuccess(request, event.status);
        }
      },
      error: (error) => {
        this.auditLogger.logError('API_ERROR', `${request.method} ${request.url}`, {
          status: error?.status || null,
          message: error?.message || null,
        });
      },
    }));
  }
}
