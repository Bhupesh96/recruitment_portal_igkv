import {Component, OnInit} from '@angular/core';
import {Route, Router} from '@angular/router';
import {HttpService} from 'shared';
import {JsonPipe} from '@angular/common';

@Component({
  selector: 'app-update-routes',
  imports: [
    JsonPipe
  ],
  templateUrl: './update-routes.component.html',
  styleUrl: './update-routes.component.scss'
})
export class UpdateRoutesComponent implements OnInit {
  routeList: { path: string, component: string }[] = [];
  port: any;
  pathname: any;

  constructor(private router: Router, private http: HttpService) {
  }

  async ngOnInit() {
    this.pathname = window.location.pathname.split('/')[1]
    this.port = window.location.port
    this.routeList = await this.extractRoutes(this.router.config)
    this.updateRoutes();
  }

  extractRoutes(routes: Route[], parentPath: string = ''): Promise<any> {
    return new Promise(async (res) => {
      let result: {}[] = [];
      for (let i = 0; i < routes.length; i++) {
        let route: any = routes[i]
        const currentPath = parentPath + (route.path ? `/${route.path}` : '');
        if (route.component && `${route.component.name}`.replace('_', '') == "UpdateRoutesComponent") {
          continue
        }
        if (route.children) {
          let r = await this.extractRoutes(route.children, currentPath)
          result = result.concat(r)
          continue;
        }
        if (route.loadChildren) {
          continue;
        }
        if (route.component) {
          let path: any;
          if (route.parent) {
            path = ('/' + route.parent || '') + currentPath || '/'
          } else {
            path = currentPath || '/'
          }
          result.push({
            port: this.port,
            pathname: this.pathname,
            path: path,
            component: `${route.component.name}`.replace('_', ''),
          });
        }
      }
      res(result);
    })
  }

  updateRoutes() {
    this.http.postData('/accessControl/post/saveComponentDetails/', this.routeList, 'adminApi').subscribe(res => {
      console.log(res);
    })
  }
}
