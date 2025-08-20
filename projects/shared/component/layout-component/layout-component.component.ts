import {AfterViewInit, Component, Inject, OnInit, signal, ViewChild} from '@angular/core';
import {Router, RouterModule} from "@angular/router";
import {CommonModule, DOCUMENT} from "@angular/common";
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatExpansionModule} from '@angular/material/expansion';
import {KTScrollService} from '../../service/KTscroll';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {MatListModule} from '@angular/material/list';
import {FormsModule} from '@angular/forms';
import {AuthService} from '../../service/auth.service';
import {HttpService} from '../../service/http.service';
import {MatMenuModule} from '@angular/material/menu';
import {moduleMapping} from 'environment';
import {LoaderComponent} from '../loader/loader.component';
import {SharedModule} from '../../shared.module';
import {AlertService} from '../../service/alert.service';

@Component({
  selector: 'app-layout-component',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatTooltipModule,
    MatExpansionModule,
    MatDialogModule,
    MatListModule,
    FormsModule,
    MatMenuModule,
    LoaderComponent,
    SharedModule
  ],
  templateUrl: './layout-component.component.html',
  styleUrl: './layout-component.component.scss'
})
export class LayoutComponent implements OnInit, AfterViewInit {
  moduleList: any = []
  step: any = signal(0);
  selectedModule_id: any
  searchList: any = []

  setStep(index: number) {
    this.step.set(index);
  }

  docElement!: HTMLElement;
  isFullScreen = false;
  public user: any
  @ViewChild('dialogContent') dialogContent!: any;

  constructor(@Inject(DOCUMENT) private document: Document, private alert: AlertService,
              private http: HttpService, private router: Router, private dialog: MatDialog,
              private ktScrollService: KTScrollService, private auth: AuthService) {
    this.user = this.auth.currentUser
  }

  ngAfterViewInit(): void {
    this.ktScrollService.init();
  }

  ngOnInit(): void {
    this.loadScript('scripts.bundle.js');
    this.docElement = document.documentElement;
    this.getAllMenu();
  }

  private loadScript(scriptUrl: string) {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.onload = () => {
      console.log('Script loaded successfully!');
      // You can call any functions from the script here if needed
    };
    script.onerror = () => console.error('Error loading script');
    document.body.appendChild(script);
  }

  checkModule() {
    let origin = window.location.origin
    const key: any = Object.keys(moduleMapping).find(key => moduleMapping[key] === origin) || 'homeModule';
    let module_obj: any = this.moduleList.find((item: any) => item.module_route == key)
    this.auth.setModuleID(module_obj?.module_id ?? 10)
    if (module_obj) {
      let path: any = window.location.pathname
      this.selectedModule_id = module_obj.module_id
      module_obj.menu.forEach((item: any, index: number) => {
        let is_exist: any = item.child.find((sub: any) => sub.route == path)
        if (is_exist) this.setStep(index + 1)
      })
    } else this.selectedModule_id = 10
  }

  toggleSidebar(): void {
    let body = this.document.body
    const currentValue = body.getAttribute('data-kt-aside-minimize');
    const btn: any = this.document.querySelector('.aside-toggle')
    if (currentValue === 'on') {
      body.setAttribute('data-kt-aside-minimize', 'off');
      btn.classList.remove('active')
    } else {
      body.setAttribute('data-kt-aside-minimize', 'on');
      btn.classList.add('active')
    }
  }

  userManual(): void {
    let mm = this.moduleList.find((item: any) => item.module_id == this.selectedModule_id)
    if (mm.manual) {
      window.open(mm.manual, '_blank');
    } else {
      this.alert.alert(true, "Manual Not Exist...!")
    }
  }

  toggleFullScreen(): void {
    if (!this.isFullScreen) {
      this.docElement.requestFullscreen().then();
    } else {
      document.exitFullscreen().then();
    }
    this.isFullScreen = !this.isFullScreen;
  }

  selectPage(menu: any) {
    let origin = window.location.origin;
    let module = menu.module_route
    let path = moduleMapping[module]
    this.auth.setModuleID(menu.module_id);
    this.proceedWithNavigation(menu, origin, path);
  }

  private proceedWithNavigation(menu: any, origin: string, path: string) {
    if (path == origin) {
      this.router.navigate([menu.route]).then();
    } else {
      window.location.href = path + '/' + menu.route;
    }
  }

  getAllMenu() {
    this.http.getData("/master/get/getAllMenuByEmpId").subscribe(res => {
      if (!res.body.error) {
        this.moduleList = res.body.data;
        this.addSearchList()
        this.checkModule()
      }
    })
  }

  addSearchList() {
    this.moduleList.forEach((module: any) => {
      module.menu.forEach((menu: any) => {
        menu.children == 1 ? this.searchList.push(...menu.child) : this.searchList.push(menu);
      });
    });
  }

  logout(): void {
    this.auth.logout();
  }

  protected readonly window = window;
}
