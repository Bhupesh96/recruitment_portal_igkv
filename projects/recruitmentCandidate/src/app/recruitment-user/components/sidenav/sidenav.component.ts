import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [CommonModule, RouterOutlet], // Removed RouterLink
  templateUrl: './sidenav.component.html',
  styles: [],
})
export class SidenavComponent {
  isSidebarOpen: boolean = false;

  constructor(private router: Router) {}

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
    if (this.isSidebarOpen) {
      this.isSidebarOpen = false; // Close sidebar on mobile after navigation
    }
  }

  // Public method to check if a route is active
  isActive(path: string): boolean {
    return this.router.url === path;
  }
}
