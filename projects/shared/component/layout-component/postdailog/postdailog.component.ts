import {Component, Inject, OnInit} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import {MatSelectModule} from '@angular/material/select';
import {MatListOption, MatSelectionList} from '@angular/material/list';
import {FormsModule} from '@angular/forms';
import {AuthService, HttpService, StateService} from 'shared';

@Component({
  selector: 'app-postdailog',
  templateUrl: './postdailog.component.html',
  imports: [
    MatDialogModule,
    MatSelectModule,
    MatSelectionList,
    MatListOption,
    FormsModule
  ],
  styleUrl: './postdailog.component.scss'
})
export class PostDialogComponent {
  selectedDesignation: any;
  designationList: any = []

  constructor(@Inject(MAT_DIALOG_DATA) data: any, private dialog: MatDialogRef<any>,
              private auth: AuthService, private state: StateService) {
    this.designationList = data;
  }

  setDesignation() {
    this.auth.setDesignationID(this.selectedDesignation[0])
    let filter = this.designationList.find((item: any) => item.designation_id == this.selectedDesignation[0])
    if (filter && filter.condition) {
      this.state.updateState(filter.condition)
    }
    this.dialog.close(true);
  }
}
