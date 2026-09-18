import {Component, OnInit} from '@angular/core';
import {AuditLoggerService} from 'shared';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'establishment';

  constructor(private auditLogger: AuditLoggerService) {}

  ngOnInit(): void {
    this.auditLogger.start('recruitmentCandidate');
  }
}
