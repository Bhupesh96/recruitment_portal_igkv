import {Injectable} from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import {AuthService} from "./auth.service";
import {HttpService} from './http.service';
import {PostDialogComponent} from '../component/layout-component/postdailog/postdailog.component';
import {AlertService} from './alert.service';
import {MatDialog} from '@angular/material/dialog';
import {StateService} from './state.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {

  constructor(private authService: AuthService, private router: Router, private http: HttpService,
              private alert: AlertService, private dialog: MatDialog, private state: StateService) {

  }

  private checkPermission(route: any, state: any): any {
    let state_url: any = state.url
    if (state.url.includes('?')) {
      state_url = state.url.split('?')[0]
    }
    return new Promise((resolve: any) => {
      let params: any = {
        route: state_url,
        module_id: this.authService.getModuleID(),
      }
      this.http.getParam('/master/get/getMenuPermissionDetailsByMenuRoute/', params).subscribe(res => {
        let designationList = res.body.data.data;
        if (res.body.error || !res.body.data.isMenuPermissioned) {
          this.alert.alertMessage("You have not access...", "Please connect to Admin", 'error');
          resolve(false);
        }
        if (res.body.data.isExtraaMenuPermissioned) {
          this.authService.setDesignationID(null)
          resolve(true);
        } else {
          if (designationList.length == 1) {
            if (designationList[0].condition) {
              this.state.updateState(designationList[0].condition)
            }
            this.authService.setDesignationID(designationList[0].designation_id)
            resolve(true)
          } else if (designationList.length > 1) {
            const dialogRef: any = this.dialog.open(PostDialogComponent, {
              width: '450px',
              data: designationList,
              backdropClass: 'custom-backdrop',
              disableClose: true,
            });
            dialogRef.afterClosed().subscribe((result: any) => {
              if (result) {
                resolve(true);
              } else {
                resolve(false);
              }
            });
          } else {
            resolve(false);
          }
        }
      })
    })
  }

  async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<any> {
    let permission: any = await this.checkPermission(route, state)
    if (permission) return true
    this.router.navigate(['/404']).then()
    return false
  }

  async canActivateChild(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<any> {
    let permission: any = await this.checkPermission(route, state)
    if (permission) return true
    this.router.navigate(['/404']).then()
    return false
  }
}
