import {AfterViewInit, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {LoaderService} from "shared";
import {CommonModule} from "@angular/common";

@Component({
  selector: 'app-dotLoader',
  templateUrl: './dot-loader.component.html',
  styleUrls: ['./dot-loader.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class DotLoaderComponent implements OnInit, AfterViewInit {
  dotLoading: boolean = false;

  constructor(private loaderService: LoaderService, private changeDetector: ChangeDetectorRef) {
  }

  ngOnInit(): void {
    this.loaderService.dotLoading.subscribe(res => {
      this.dotLoading = res;
      this.changeDetector.detectChanges();
    });
  }

  ngAfterViewInit() {
    this.loaderService.dotLoading.subscribe(res => {
      this.dotLoading = res;
      this.changeDetector.detectChanges();
    });
  }

}
