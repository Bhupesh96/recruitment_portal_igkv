import {
  AfterContentChecked,
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ContentChild,
  ElementRef,
  Input,
  OnInit,
  TemplateRef,
  ViewChild
} from '@angular/core';
import {AuthService, HttpService, PrintService} from 'shared';
import {take} from 'rxjs';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {NgForOf, NgIf, NgTemplateOutlet} from '@angular/common';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {FormsModule} from '@angular/forms';
import {MatIcon} from '@angular/material/icon';
import {MatTooltip} from '@angular/material/tooltip';
import * as XLSX from 'xlsx';
import {ActivatedRoute, Router} from '@angular/router';

interface Option {
  is_read: boolean,
  orientation: string
  listLength: number,
  is_pagination: boolean,
  is_server_pagination: boolean,
  is_filter: boolean,
  dataSource: any;
  button: string[],
  is_render: boolean,
  page: number,
  pageSize: number
}

@Component({
  selector: 'app-reporttable',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatPaginatorModule,
    NgIf,
    NgForOf,
    FormsModule,
    NgTemplateOutlet,
    MatIcon,
    MatTooltip
  ],
  templateUrl: './reporttable.component.html',
  styleUrl: './reporttable.component.scss',
})
export class ReporttableComponent implements OnInit, AfterViewInit, AfterContentChecked {
  @ViewChild('print_content') print_content!: ElementRef;
  @ViewChild('table') table!: ElementRef;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @Input() options!: Option;
  @ContentChild('headerTemplate', {static: true}) headerTemplate!: TemplateRef<any>;
  @ContentChild('rowTemplate') rowTemplate!: TemplateRef<any>;

  user: any
  filterText: string = ''
  pageSize: number = 10;
  filteredData: any[] = [];
  currentPage: number = 0;
  totalItems: number = 0;

  constructor(private http: HttpService, private print: PrintService, private auth: AuthService, private router: Router,
              private route: ActivatedRoute, private cdr: ChangeDetectorRef) {
    this.user = this.auth.currentUser;
  }

  ngOnInit() {
    this.route.queryParams.subscribe((params: any) => {
      this.options.page = +params['page'] || this.options.page;
      this.options.pageSize = +params['pageSize'] || this.options.pageSize;
    })
  }

  ngAfterViewInit() {
    this.renderData();
  }

  ngAfterContentChecked() {
    if ((this.totalItems == 0 || this.filteredData[0] != this.options.dataSource[0]) && !this.filterText) {
      this.renderData()
    }
  }

  renderData() {
    this.filteredData = this.options.dataSource;
    this.totalItems = this.options.is_read ? this.options.listLength : 0;
    this.currentPage = this.options.page;
    this.pageSize = this.options.pageSize
    this.resetOrChange()
  }

  onFilterChange(filterText: string) {
    this.filterText = filterText;
    this.filterData();
  }

  filterData() {
    if (this.filterText) {
      this.currentPage = 0;
      this.pageSize = 10;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {page: this.currentPage, pageSize: this.pageSize},
        queryParamsHandling: 'merge' // Merge with existing params
      }).then();
      this.resetOrChange()
      this.filteredData = this.options.dataSource.filter((item: any) => {
        return Object.values(item).some((value: any) => {
            if (value) {
              return value.toString().toLowerCase().includes(this.filterText.toLowerCase())
            }
          }
        );

      });
    } else {
      this.filteredData = this.options.dataSource;
    }
    this.totalItems = this.filteredData.length; // Update the total items count after filtering
    this.currentPage = 0; // Reset to first page when filter changes
  }

  printData(): void {
    let htmlContent = this.print_content.nativeElement.innerHTML;
    this.print.printHTML(htmlContent).then(() => {
      // if (res) this.fs_id = null
    }).catch((error) => {
      console.error('Print error:', error);
    });
  }

  getPdf(): void {
    const html = this.print_content.nativeElement.innerHTML;
    this.http.postBlob(`/file/htmltoPdf/`, {
      html: html,
      orientation: this.options.orientation
    }, null).pipe(take(1)).subscribe(() => {
      console.log("html to pdf")
    })
  }

  copyTableData() {
    if (!this.table) return;

    let tableText = '';
    const rows = this.table.nativeElement.querySelectorAll('tr');
    rows.forEach((row: any) => {
      const cells = row.querySelectorAll('th, td');
      let rowText: string[] = [];
      cells.forEach((cell: HTMLElement) => {
        if (cell && !cell.classList.contains('d-print-none')) {
          rowText.push(cell.innerText.trim());
        } else {
          console.log(cell)
        }
      });

      tableText += rowText.join('\t') + '\n';
    });

    // Fallback for older browsers or if Clipboard API fails
    if (navigator.clipboard) {
      navigator.clipboard.writeText(tableText).then(() => {
        alert('Table copied successfully!');
      }).catch(err => {
        console.error('Clipboard API failed:', err);
        this.fallbackCopy(tableText);
      });
    } else {
      this.fallbackCopy(tableText);
    }
  }

  fallbackCopy(tableText: string) {
    const textArea = document.createElement('textarea');
    textArea.value = tableText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }

  getExcel() {
    const htmlContent = this.table.nativeElement;
    const ws: XLSX.WorkSheet = XLSX.utils.table_to_sheet(htmlContent);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `Report.xlsx`);
  }

  resetOrChange() {
    if (this.options.is_server_pagination && this.options.is_pagination) {
      if (this.paginator) {
        this.paginator.pageIndex = this.currentPage ?? 0;
        this.paginator.pageSize = this.pageSize ?? 10;
        this.cdr.detectChanges();
      }
    }
  }

  onPageChange(event: any) {
    if (this.options.is_pagination) {
      this.currentPage = event.pageIndex;
      this.pageSize = event.pageSize;
      // Update the URL query parameters
      if (this.options.is_server_pagination && this.options.is_pagination) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {page: this.currentPage, pageSize: this.pageSize},
          queryParamsHandling: 'merge' // Merge with existing params
        }).then();
      }

    }
  }
}
